"""Tests for Phase 2 Soil Intelligence: the quantitative RUSLE model, the
Castelnaudary case study, and the bounded /geo API endpoints.

Covered:
  * RUSLE factor math (Williams K, McCool/RUSLE LS) and the full A = R·K·LS·C·P.
  * Scenario deltas vs baseline and one-at-a-time tornado sensitivity ordering.
  * Parameter uncertainty band.
  * The executed case study on REAL downloaded inputs (physically reasonable).
  * API coverage bounding (422 out_of_coverage) and in-coverage structure.
  * Backward compatibility: existing /health, /meta routes still respond and the
    core ClimateShield routes remain mounted.
"""
from __future__ import annotations

import math

import pytest
from fastapi.testclient import TestClient

from src.geo import rusle, soil_intelligence as si
from src.api.main import app

client = TestClient(app)

IN_COV = {"lat": si.STUDY_AREA["lat"], "lon": si.STUDY_AREA["lon"]}
OUT_COV = {"lat": 48.8566, "lon": 2.3522}  # Paris — outside the study bbox


# -------------------- RUSLE factor math --------------------
def test_williams_k_in_physical_range():
    # Loamy soil with moderate organic carbon -> K in the usual 0.0-0.07 SI band.
    k = rusle.williams_k_si(sand_pct=30, silt_pct=45, clay_pct=25, organic_carbon_pct=2.0)
    assert 0.0 < k < 0.07


def test_williams_k_decreases_with_organic_carbon():
    low_oc = rusle.williams_k_si(30, 45, 25, 0.5)
    high_oc = rusle.williams_k_si(30, 45, 25, 4.0)
    assert high_oc < low_oc  # more organic carbon -> more stable -> lower erodibility


def test_ls_factor_monotonic_in_slope():
    flat = rusle.ls_factor(1.0, 100.0)
    steep = rusle.ls_factor(15.0, 100.0)
    assert steep > flat
    assert flat >= 0.0


def test_ls_factor_increases_with_slope_length():
    short = rusle.ls_factor(8.0, 50.0)
    long = rusle.ls_factor(8.0, 150.0)
    assert long > short


def test_compute_soil_loss_is_product_and_bounded():
    res = rusle.compute_soil_loss(R=1000.0, K=0.03, LS=1.0, C=0.2, P=1.0)
    assert math.isclose(res["soil_loss_t_ha_yr"], round(1000.0 * 0.03 * 1.0 * 0.2 * 1.0, 2))
    assert res["units"] == "t ha-1 yr-1"
    assert res["plausibility_ok"] is True
    assert res["model_version"] == rusle.MODEL_VERSION


# -------------------- scenarios & sensitivity --------------------
def test_scenario_table_deltas():
    base = {"R": 1000.0, "K": 0.03, "LS": 1.0, "C": 0.2, "P": 1.0}
    scen = {"wetter": {"R": 1300.0, "K": 0.03, "LS": 1.0, "C": 0.2, "P": 1.0},
            "cover": {"R": 1000.0, "K": 0.03, "LS": 1.0, "C": 0.07, "P": 1.0}}
    rows = rusle.scenario_table(base, scen)
    by = {r["scenario"]: r for r in rows}
    assert by["baseline"]["delta_vs_baseline_t_ha_yr"] == 0.0
    assert by["wetter"]["pct_vs_baseline"] == pytest.approx(30.0, abs=0.5)  # +30% R -> +30% A
    assert by["cover"]["soil_loss_t_ha_yr"] < by["baseline"]["soil_loss_t_ha_yr"]


def test_tornado_sorted_by_swing_descending():
    base = {"R": 1000.0, "K": 0.03, "LS": 1.0, "C": 0.2, "P": 1.0}
    ranges = {"R": (700, 1800), "K": (0.02, 0.04), "LS": (0.3, 3.0),
              "C": (0.1, 0.45), "P": (0.6, 1.0)}
    tor = rusle.tornado_sensitivity(base, ranges)
    swings = [t["swing"] for t in tor]
    assert swings == sorted(swings, reverse=True)
    assert {t["factor"] for t in tor} == {"R", "K", "LS", "C", "P"}


def test_uncertainty_range_brackets_baseline():
    ranges = {"R": (700, 1800), "K": (0.02, 0.04), "LS": (0.3, 3.0),
              "C": (0.1, 0.45), "P": (0.6, 1.0)}
    unc = rusle.uncertainty_range(ranges)
    assert unc["A_min_t_ha_yr"] < unc["A_max_t_ha_yr"]
    assert unc["A_min_t_ha_yr"] >= 0.0


# -------------------- executed case study (REAL inputs) --------------------
@pytest.fixture(scope="module")
def case():
    return si.run_case_study()


def test_case_study_structure(case):
    for key in ("model_version", "equation", "study_area", "inputs",
                "vulnerability_index", "rusle_baseline", "scenarios",
                "sensitivity_tornado", "uncertainty_range", "parameters",
                "sources", "assumptions", "disclaimer"):
        assert key in case, f"missing {key}"
    assert case["study_area"]["coverage"] == "single_study_area"


def test_case_study_vulnerability_and_rusle_reasonable(case):
    v = case["vulnerability_index"]
    assert 0 <= v["score_0_100"] <= 100
    assert v["band"] in ("faible", "modéré", "élevé")
    A = case["rusle_baseline"]["soil_loss_t_ha_yr"]
    assert 0.0 < A < 500.0  # physically plausible annual soil-loss estimate
    assert case["rusle_baseline"]["plausibility_ok"] is True


def test_case_study_scenarios_present(case):
    names = {s["scenario"] for s in case["scenarios"]}
    assert "baseline" in names
    assert "wetter_climate" in names
    assert "improved_cover_management" in names
    wetter = next(s for s in case["scenarios"] if s["scenario"] == "wetter_climate")
    improved = next(s for s in case["scenarios"] if s["scenario"] == "improved_cover_management")
    assert wetter["pct_vs_baseline"] > 0      # wetter climate increases erosion potential
    assert improved["pct_vs_baseline"] < 0    # improved cover reduces it


def test_case_study_assumptions_recorded(case):
    # Missing/uncertain inputs must be documented, never silently zeroed.
    assert len(case["assumptions"]) >= 3
    assert any("R-factor" in a or "R factor" in a.lower() for a in case["assumptions"])


# -------------------- API: coverage bounding --------------------
def test_geo_layers_lists_live_layers():
    r = client.get("/geo/layers")
    assert r.status_code == 200
    layers = r.json()["layers"]
    assert len(layers) >= 3
    assert all("provenance" in l for l in layers)


def test_geo_soil_in_coverage():
    r = client.get("/geo/soil", params=IN_COV)
    assert r.status_code == 200
    body = r.json()
    assert body["modelled"], "expected at least one modelled soil layer"
    assert body["modelled"][0]["clay_pct"] is not None


def test_geo_soil_out_of_coverage_returns_422():
    r = client.get("/geo/soil", params=OUT_COV)
    assert r.status_code == 422
    assert r.json()["detail"]["error"] == "out_of_coverage"


def test_geo_soil_risk_in_coverage_structure():
    body = {"location": {"field_id": "demo", "latitude": IN_COV["lat"],
                         "longitude": IN_COV["lon"]}, "exposure": {}}
    r = client.post("/geo/soil-risk", json=body)
    assert r.status_code == 200
    d = r.json()
    assert d["coverage"] == "castelnaudary_study_area"
    assert d["model_version"] == rusle.MODEL_VERSION
    assert 0.0 < d["rusle_baseline"]["soil_loss_t_ha_yr"] < 500.0
    assert len(d["scenarios"]) >= 3
    assert len(d["sensitivity_tornado"]) == 5


def test_geo_soil_risk_out_of_coverage_returns_422():
    body = {"location": {"field_id": "x", "latitude": OUT_COV["lat"],
                         "longitude": OUT_COV["lon"]}, "exposure": {}}
    r = client.post("/geo/soil-risk", json=body)
    assert r.status_code == 422
    assert r.json()["detail"]["error"] == "out_of_coverage"


# -------------------- backward compatibility --------------------
def test_existing_routes_still_mounted():
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for p in ("/health", "/meta", "/assess", "/advisor/ask"):
        assert p in paths, f"core route {p} missing after mounting geo router"


def test_health_still_ok():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
