"""API contract tests for the FastAPI integration layer.

Upstream weather fetches are monkeypatched with canned payloads so these run
deterministically offline. They assert the typed contract, FR<->EN mapping,
validation and error handling.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.api import mapping
from src.weather import arome, aifs
from tests.fixtures import arome_raw, aifs_raw

client = TestClient(app)


@pytest.fixture(autouse=True)
def _mock_upstream(monkeypatch):
    monkeypatch.setattr(arome, "fetch_arome", lambda *a, **k: arome_raw())
    monkeypatch.setattr(aifs, "fetch_ensemble", lambda *a, **k: aifs_raw(n_members=3, n_hours=48))


# -------------------- mapping --------------------
def test_mapping_fr_and_en():
    assert mapping.normalise_crop("feverole") == "fava_bean"
    assert mapping.normalise_crop("fava_bean") == "fava_bean"
    assert mapping.normalise_stage("floraison") == "flowering"
    assert mapping.normalise_stage("flowering") == "flowering"


def test_mapping_unknown_raises():
    with pytest.raises(ValueError):
        mapping.normalise_crop("banana")


# -------------------- basic endpoints --------------------
def test_health():
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_meta_has_mappings_and_rules():
    j = client.get("/meta").json()
    assert j["crop_fr_to_py"]["pois"] == "pea"
    assert "fava_bean" in j["supported_crops_py"]
    assert len(j["rule_catalogue"]) >= 1


# -------------------- /assess contract --------------------
def test_assess_contract_french_ids():
    r = client.post("/assess", json={
        "latitude": 48.70, "longitude": 2.20,
        "crop": "feverole", "growth_stage": "floraison",
    })
    assert r.status_code == 200
    j = r.json()
    # field echo maps FR -> PY
    assert j["field"]["crop_py"] == "fava_bean"
    assert j["field"]["growth_stage_py"] == "flowering"
    # typed blocks present with honest data_kind labels
    assert j["weather"]["data_kind"] == "real_weather_forecast"
    assert j["ensemble"]["data_kind"] == "derived_from_real_forecast"
    assert j["risk"]["data_kind"].startswith("risk_detection")
    assert j["harvest"]["data_kind"] == "weather_only_decision_aid"
    # provenance carries model ids + sources
    assert j["provenance"]["arome_model_id"]
    assert isinstance(j["provenance"]["agronomic_sources"], list)


def test_assess_validation_error_on_bad_crop():
    r = client.post("/assess", json={
        "latitude": 48.7, "longitude": 2.2, "crop": "banana", "growth_stage": "floraison",
    })
    assert r.status_code == 422


def test_assess_rejects_out_of_range_coords():
    r = client.post("/assess", json={
        "latitude": 999, "longitude": 2.2, "crop": "pois", "growth_stage": "floraison",
    })
    assert r.status_code == 422


def test_assess_upstream_failure_returns_502(monkeypatch):
    def boom(*a, **k):
        raise arome.AromeFetchError("simulated outage")
    monkeypatch.setattr(arome, "fetch_arome", boom)
    r = client.post("/assess", json={
        "latitude": 48.7, "longitude": 2.2, "crop": "pois", "growth_stage": "floraison",
    })
    assert r.status_code == 502
    assert "AROME" in r.json()["detail"]
