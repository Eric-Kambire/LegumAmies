"""Grounded tools for the LegumAmies agricultural advisor.

Each tool returns REAL, typed, sourced data (or an explicit "unavailable"
state). They reuse the existing ClimateShield pipeline and the existing Bedrock
Knowledge Base (C5WRYFYF1O) - nothing is fabricated here, and no new KB is
created.

Four capabilities:
  - search_documents : KB retrieval with citations (agronomic evidence)
  - get_forecast     : real AROME + AIFS ensemble forecast for a field
  - explain_risk     : crop-stage flowering heat/frost risks (sourced rules)
  - explain_harvest  : feasible harvest windows (weather-only ranking)

All tools are bounded (timeouts, result caps) and never raise to the caller:
failures are returned as structured ``{"available": False, "error": ...}``.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone as _tz
from typing import Any

import boto3
import pandas as pd

from .. import config
from ..weather import arome, aifs, ensemble_processing
from ..risk import rules as risk_rules
from ..harvest import ranking as harvest_ranking
from ..api import mapping

KNOWLEDGE_BASE_ID = os.getenv("LEGUMAMIES_KB_ID", "C5WRYFYF1O")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

# Bounds
KB_MAX_RESULTS = 4
KB_TIMEOUT_S = 15
FORECAST_TIMEOUT_S = 25

# Maps the S3 source document key -> public provenance (institution + URL).
# Mirrors infra/aws/kb_corpus/manifest.csv so citations resolve to real pages.
_DOC_PROVENANCE = {
    "sources/pois_proteagineux.md": ("Terres Inovia", "https://www.terresinovia.fr/pois-hiver"),
    "sources/feverole.md": ("Terres Inovia", "https://www.terresinovia.fr/fr/informations-techniques/feverole-de-printemps/accidents-climatiques-de-la-feverole-secheresse-et"),
    "sources/lentille.md": ("Terres Inovia", "https://www.terresinovia.fr/fr/informations-techniques/lentille"),
    "sources/pois_chiche.md": ("Terres Inovia", "https://www.terresinovia.fr/fr/informations-techniques/pois-chiche"),
    "sources/recolte_legumineuses.md": ("Terres Inovia", "https://www.terresinovia.fr/fr/actualites/lentille-une-recolte-2026-precoce-et-sous-de-fortes-temperatures"),
    "sources/statistiques_fr_legumineuses.md": ("Agreste / Terres Univia / Terres Inovia", "https://agreste.agriculture.gouv.fr"),
    # Original official guides: exact publisher PDF URLs, not generic culture pages.
    "guide_culture_pois-chiche_2026_terresinovia.pdf": ("Terres Inovia", "https://www.terresinovia.fr/sites/default/files/2026-04/guide_culture_pois-chiche_2026_terresinovia.pdf"),
    "guide-de-culture-pois-conventionnel-2025.pdf": ("Terres Inovia", "https://www.terresinovia.fr/sites/default/files/2025-05/guide-de-culture-pois-conventionnel-2025.pdf"),
    "guide-de-culture-lentille-2023.pdf": ("Terres Inovia", "https://www.terresinovia.fr/sites/default/files/2025-06/guide-de-culture-lentille-2023.pdf"),
}


def _bedrock_agent_runtime():
    return boto3.client("bedrock-agent-runtime", region_name=AWS_REGION)


# --------------------------------------------------------------------------
# 1. KB document search (agronomic evidence, with citations)
# --------------------------------------------------------------------------
def search_documents(query: str, max_results: int = KB_MAX_RESULTS,
                     client: Any = None) -> dict:
    """Retrieve agronomic passages from the existing KB with citations."""
    if not query or not query.strip():
        return {"available": False, "error": "empty query", "passages": []}
    try:
        rt = client or _bedrock_agent_runtime()
        resp = rt.retrieve(
            knowledgeBaseId=KNOWLEDGE_BASE_ID,
            retrievalQuery={"text": query[:900]},
            retrievalConfiguration={"vectorSearchConfiguration": {"numberOfResults": max_results}},
        )
    except Exception as exc:  # noqa: BLE001 - never raise to the agent
        return {"available": False, "error": f"KB retrieve failed: {exc}", "passages": []}

    passages = []
    for r in resp.get("retrievalResults", []):
        uri = (((r.get("location") or {}).get("s3Location")) or {}).get("uri", "")
        key = uri.split("/", 3)[3] if uri.startswith("s3://") and uri.count("/") >= 3 else uri
        # Bedrock exposes S3 sidecar attributes in retrievalResult.metadata.
        # Prefer those trusted source attributes over the legacy fixed mappings.
        metadata = r.get("metadata") or {}
        institution, url = _DOC_PROVENANCE.get(key, _DOC_PROVENANCE.get(key.rsplit("/", 1)[-1], (None, None)))
        institution = metadata.get("publisher") or institution
        url = metadata.get("original_source_url") or url
        page_raw = metadata.get("x-amz-bedrock-kb-document-page-number", metadata.get("page"))
        page = None
        try:
            if page_raw is not None:
                page = int(page_raw)
        except (ValueError, TypeError):
            page = None
        doc_title = metadata.get("source_title") or key
        passages.append({
            "text": " ".join((r.get("content", {}).get("text", "") or "").split())[:700],
            "score": round(float(r.get("score", 0.0)), 4),
            "s3_uri": uri,
            "document": doc_title,
            "institution": institution,
            "source_url": url,
            "page": page,
            "crop": metadata.get("crop"),
            "s3_document": key,
        })
    return {
        "available": True,
        "knowledge_base_id": KNOWLEDGE_BASE_ID,
        "data_kind": "agronomic_evidence",
        "passages": passages,
        "n": len(passages),
    }


# --------------------------------------------------------------------------
# 2. Real forecast (AROME + AIFS ensemble) for a field
# --------------------------------------------------------------------------
def get_forecast(latitude: float, longitude: float,
                 arome_forecast_days: int = 2, aifs_forecast_days: int = 10,
                 rain_threshold_mm: float = config.DEFAULT_RAIN_THRESHOLD_MM) -> dict:
    """Fetch AROME hourly + AIFS daily rain probabilities. Honest on failure."""
    retrieved_at = datetime.now(_tz.utc).isoformat()
    out: dict = {"data_kind": "real_weather_forecast", "retrieved_at_utc": retrieved_at}
    field_id = "advisor"
    # AROME (short-term)
    try:
        raw = arome.fetch_arome(latitude, longitude, forecast_days=arome_forecast_days,
                                timeout=FORECAST_TIMEOUT_S)
        wdf = arome.to_dataframe(raw, field_id=field_id, retrieved_at_utc=retrieved_at)
        tmax = float(pd.to_numeric(wdf["temperature_c"], errors="coerce").max())
        tmin = float(pd.to_numeric(wdf["temperature_c"], errors="coerce").min())
        wind_max = (float(pd.to_numeric(wdf["wind_speed_kmh"], errors="coerce").max())
                    if "wind_speed_kmh" in wdf.columns else None)
        out["arome"] = {
            "available": True,
            "model_id": config.AROME_MODEL_ID,
            "n_hours": int(len(wdf)),
            "window_local": [str(wdf["valid_time_local"].iloc[0]), str(wdf["valid_time_local"].iloc[-1])] if len(wdf) else None,
            "temp_max_c": round(tmax, 1),
            "temp_min_c": round(tmin, 1),
            "wind_max_kmh": round(wind_max, 1) if wind_max is not None else None,
        }
        out["_weather_df"] = wdf  # internal, stripped before serialising
    except arome.AromeFetchError as exc:
        out["arome"] = {"available": False, "error": f"AROME unavailable: {exc}"}
    except Exception as exc:  # noqa: BLE001
        out["arome"] = {"available": False, "error": f"AROME error: {exc}"}

    # AIFS ensemble -> daily rain probabilities
    try:
        raw_e = aifs.fetch_ensemble(latitude, longitude, forecast_days=aifs_forecast_days,
                                    timeout=FORECAST_TIMEOUT_S)
        members = aifs.count_valid_members(raw_e)
        edf = aifs.to_long_dataframe(raw_e, field_id=field_id)
        prob = ensemble_processing.compute_daily_rain_probabilities(edf, threshold_mm=rain_threshold_mm)
        out["aifs"] = {
            "available": True,
            "model_id": config.AIFS_MODEL_ID,
            "ensemble_members_valid": int(members),
            "rain_threshold_mm": rain_threshold_mm,
            "daily": prob[["date_local", "probability_pct", "mean_precipitation_mm",
                           "ensemble_members_used"]].to_dict(orient="records"),
        }
        out["_prob_df"] = prob  # internal
    except aifs.AifsFetchError as exc:
        out["aifs"] = {"available": False, "error": f"AIFS unavailable: {exc}"}
    except Exception as exc:  # noqa: BLE001
        out["aifs"] = {"available": False, "error": f"AIFS error: {exc}"}

    out["available"] = out.get("arome", {}).get("available", False) or out.get("aifs", {}).get("available", False)
    return out


# --------------------------------------------------------------------------
# 3. Crop-stage risk (sourced rules) using ClimateShield
# --------------------------------------------------------------------------
def explain_risk(crop: str, growth_stage: str, weather_df: pd.DataFrame | None) -> dict:
    """Evaluate sourced flowering heat/frost risks against the real forecast."""
    try:
        crop_py = mapping.normalise_crop(crop)
        stage_py = mapping.normalise_stage(growth_stage)
    except ValueError as exc:
        return {"available": False, "error": str(exc),
                "data_kind": "risk_detection_from_real_forecast_and_agronomic_evidence"}
    if weather_df is None or len(weather_df) == 0:
        return {"available": False, "error": "no forecast to evaluate",
                "crop": crop_py, "growth_stage": stage_py,
                "data_kind": "risk_detection_from_real_forecast_and_agronomic_evidence"}
    rules_df = config.load_crop_rules()
    alerts = risk_rules.evaluate_risks(weather_df, crop_py, stage_py, "advisor", rules_df=rules_df)
    n_active = int(((rules_df["crop"] == crop_py) & (rules_df["growth_stage"] == stage_py)
                    & (rules_df["validation_status"] == "published")).sum())
    return {
        "available": True,
        "data_kind": "risk_detection_from_real_forecast_and_agronomic_evidence",
        "crop": crop_py, "growth_stage": stage_py,
        "active_published_rules_for_stage": n_active,
        "alerts": alerts.to_dict(orient="records"),
        "note": "Threshold exceedance is a risk flag, not a prediction of crop damage.",
    }


# --------------------------------------------------------------------------
# 4. Harvest window (weather-only ranking) using ClimateShield
# --------------------------------------------------------------------------
def explain_harvest(crop: str, growth_stage: str, prob_df: pd.DataFrame | None,
                    harvest_ready: bool) -> dict:
    """Rank feasible harvest days from the real ensemble (weather-only)."""
    try:
        crop_py = mapping.normalise_crop(crop)
        stage_py = mapping.normalise_stage(growth_stage)
    except ValueError as exc:
        return {"available": False, "error": str(exc), "data_kind": "weather_only_decision_aid"}
    if prob_df is None or len(prob_df) == 0:
        return {"available": False, "error": "no ensemble rain probabilities available",
                "data_kind": "weather_only_decision_aid"}
    if not harvest_ready:
        return {"available": True, "data_kind": "weather_only_decision_aid",
                "harvest_ready": False, "recommended_date_local": None, "days": [],
                "note": "Crop not declared harvest-ready; no harvest date recommended."}

    machinery = pd.DataFrame([{"field_id": "advisor", "date_local": d, "available": True}
                              for d in prob_df["date_local"].tolist()])
    ranking = harvest_ranking.rank_harvest_windows(
        field_id="advisor", crop=crop_py, growth_stage=stage_py, harvest_ready=True,
        rain_prob_df=prob_df, machinery_df=machinery)
    n_feasible = int(ranking["feasible"].sum()) if not ranking.empty else 0
    recommended = ranking.loc[ranking["rank"] == 1, "date_local"].iloc[0] if n_feasible else None
    cols = ["date_local", "feasible", "rain_probability_pct", "expected_rain_mm",
            "weather_risk_score", "rank", "explanation", "limitations"]
    return {
        "available": True, "data_kind": "weather_only_decision_aid", "harvest_ready": True,
        "recommended_date_local": recommended, "n_feasible_days": n_feasible,
        "days": ranking[cols].head(10).to_dict(orient="records"),
        "note": "Deterministic weather-only aid; machinery assumed available; not agronomically validated.",
    }
