"""Tests for the agricultural advisor agent.

Bedrock Converse and the KB retrieval are mocked; AROME/AIFS fetches are
monkeypatched with canned payloads, so these run deterministically offline.
Focus: grounding, correct structured output, honest unavailable states, and
anti-fabrication guarantees (no invented citations / economic / yield claims).
"""
from __future__ import annotations

import pytest

from src.advisor import agent, tools
from src.weather import arome, aifs
from tests.fixtures import arome_raw, aifs_raw


# ---- fakes -----------------------------------------------------------------
class FakeConverse:
    def __init__(self, text="Réponse en français fondée sur les faits fournis."):
        self.text = text

    def converse(self, **kwargs):
        return {"output": {"message": {"content": [{"text": self.text}]}}}


class FakeKB:
    def __init__(self, results=None):
        self._results = results if results is not None else [{
            "content": {"text": "La floraison du pois est sensible : au-delà de 25°C la photosynthèse est perturbée."},
            "score": 0.82,
            "location": {"s3Location": {"uri": "s3://b/sources/pois_proteagineux.md"}},
        }]

    def retrieve(self, **kwargs):
        return {"retrievalResults": self._results}


@pytest.fixture
def mock_forecast(monkeypatch):
    monkeypatch.setattr(arome, "fetch_arome", lambda *a, **k: arome_raw())
    monkeypatch.setattr(aifs, "fetch_ensemble", lambda *a, **k: aifs_raw(n_members=3, n_hours=48))


FIELD = {"latitude": 47.32, "longitude": 5.04, "crop": "pois", "growth_stage": "floraison",
         "field_name": "Dijon"}
QUESTION = "Mes pois sont en floraison près de Dijon. La chaleur est-elle dangereuse ?"


# ---- validation ------------------------------------------------------------
def test_empty_question_raises():
    with pytest.raises(agent.AdvisorInputError):
        agent.run_advisor(FIELD, "   ")


def test_bad_latitude_raises():
    with pytest.raises(agent.AdvisorInputError):
        agent.run_advisor({"latitude": 999, "longitude": 5.0}, "question")


# ---- grounded happy path ---------------------------------------------------
def test_grounded_structure(mock_forecast):
    r = agent.run_advisor(FIELD, QUESTION, bedrock=FakeConverse(), kb_client=FakeKB())
    assert r["answer"]
    assert r["model_id"] == agent.MODEL_ID
    assert r["grounded"] is True
    assert set(r["tools_used"]) == {"search_documents", "get_forecast", "explain_risk", "explain_harvest"}
    # citation resolves to the real Terres Inovia document
    urls = [c.get("source_url") for c in r["citations"]]
    assert any(u and "terresinovia.fr" in u for u in urls)
    assert r["forecast_provenance"]["arome"]["available"] is True
    assert r["uncertainty"]["ensemble_members"] == 3


# ---- missing field data ----------------------------------------------------
def test_missing_coords_and_crop():
    # no coords, no crop -> KB-only; honest limitations; no crash
    r = agent.run_advisor({}, "Quels sont les risques de chaleur sur le pois ?",
                          bedrock=FakeConverse(), kb_client=FakeKB())
    assert r["forecast_provenance"]["arome"]["available"] is False
    assert any("Coordonnées" in l for l in r["limitations"])
    assert any("manquant" in l.lower() for l in r["limitations"])
    assert "get_forecast" not in r["tools_used"]


# ---- missing documents -----------------------------------------------------
def test_missing_documents(mock_forecast):
    r = agent.run_advisor(FIELD, QUESTION, bedrock=FakeConverse(), kb_client=FakeKB(results=[]))
    assert any("base de connaissances" in l.lower() for l in r["limitations"])
    # no fabricated agronomic-evidence citations when KB empty
    assert all(c["type"] != "agronomic_evidence" for c in r["citations"])


# ---- unavailable forecast --------------------------------------------------
def test_unavailable_forecast(monkeypatch):
    def arome_boom(*a, **k):
        raise arome.AromeFetchError("outage")
    def aifs_boom(*a, **k):
        raise aifs.AifsFetchError("outage")
    monkeypatch.setattr(arome, "fetch_arome", arome_boom)
    monkeypatch.setattr(aifs, "fetch_ensemble", aifs_boom)
    r = agent.run_advisor(FIELD, QUESTION, bedrock=FakeConverse(), kb_client=FakeKB())
    assert r["forecast_provenance"]["arome"]["available"] is False
    assert r["forecast_provenance"]["aifs"]["available"] is False
    assert any("indisponible" in l.lower() for l in r["limitations"])
    assert r["answer"]  # still returns an answer


# ---- unsupported crop ------------------------------------------------------
def test_unsupported_crop(mock_forecast):
    bad = dict(FIELD, crop="tomate", growth_stage="floraison")
    r = agent.run_advisor(bad, "La tomate craint-elle la chaleur ?",
                          bedrock=FakeConverse(), kb_client=FakeKB())
    assert r["risk"]["available"] is False if "risk" in r else True
    assert any("non reconnu" in l.lower() for l in r["limitations"])


# ---- anti-fabrication guarantees -------------------------------------------
def test_no_fabricated_structured_fields(mock_forecast):
    # Even if the model text fabricates, structured fields are deterministic.
    fabricating = FakeConverse(text="Vous gagnerez 3 800 € et +20% de rendement garanti !")
    r = agent.run_advisor(FIELD, QUESTION, bedrock=fabricating, kb_client=FakeKB())
    # citations only from provided docs/rules
    for c in r["citations"]:
        assert c["type"] in ("agronomic_evidence", "agronomic_rule")
    # actions carry no economic/yield fields and are marked unverified
    for a in r["actions"]:
        assert a.get("verified") is False
        assert "€" not in str(a) and "rendement" not in str(a).lower()
    # limitations always disclaim economic/yield estimates
    assert any("économie" in l.lower() or "rendement" in l.lower() for l in r["limitations"])


def test_thinking_block_stripped(mock_forecast):
    r = agent.run_advisor(FIELD, QUESTION,
                          bedrock=FakeConverse(text="<thinking>plan</thinking>Réponse finale."),
                          kb_client=FakeKB())
    assert "<thinking>" not in r["answer"]
    assert "Réponse finale." in r["answer"]


def test_model_failure_safe_fallback(mock_forecast):
    class Boom:
        def converse(self, **k):
            raise RuntimeError("bedrock down")
    r = agent.run_advisor(FIELD, QUESTION, bedrock=Boom(), kb_client=FakeKB())
    assert r["model_id"] is None
    assert r["answer"]  # safe fallback text
    assert any("synthèse" in l.lower() for l in r["limitations"])


# ---- FastAPI endpoint ------------------------------------------------------
def test_endpoint_validation_422():
    from fastapi.testclient import TestClient
    from src.api.main import app
    c = TestClient(app)
    r = c.post("/advisor/ask", json={"field": {}, "question": ""})
    assert r.status_code == 422  # pydantic min_length


def test_endpoint_happy_path(monkeypatch):
    from fastapi.testclient import TestClient
    from src.api.main import app
    from src.advisor import agent as advisor_agent

    canned = {
        "answer": "Réponse de test.", "actions": [], "citations": [],
        "forecast_provenance": {"arome": {"available": False}, "aifs": {"available": False},
                                "data_kind": "real_weather_forecast", "retrieved_at_utc": None},
        "uncertainty": {"ensemble_members": None, "rain_probability_pct_range": None, "note": "x"},
        "limitations": ["demo"], "grounded": False, "tools_used": ["search_documents"],
        "model_id": "amazon.nova-lite-v1:0", "knowledge_base_id": "C5WRYFYF1O",
        "generated_at_utc": "2026-10-31T00:00:00+00:00",
    }
    monkeypatch.setattr(advisor_agent, "run_advisor", lambda *a, **k: canned)
    c = TestClient(app)
    r = c.post("/advisor/ask", json={
        "field": {"latitude": 47.32, "longitude": 5.04, "crop": "pois", "growth_stage": "floraison"},
        "question": "La chaleur est-elle dangereuse ?",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["knowledge_base_id"] == "C5WRYFYF1O"
    assert body["model_id"] == "amazon.nova-lite-v1:0"
