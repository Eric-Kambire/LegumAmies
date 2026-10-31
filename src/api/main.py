"""LegumAmies integration API (FastAPI) over the ClimateShield backend.

Thin, stateless layer around the existing Python functions. Each request is
handled fully in memory (no shared/global CSV writes between users): forecasts
are fetched live, risks evaluated against the sourced rule catalogue (read-only),
and harvest windows ranked per request.

Run locally:
    uvicorn src.api.main:app --reload --port 8000
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone as _tz

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .. import config
from ..weather import arome, aifs, ensemble_processing
from ..risk import rules as risk_rules
from ..harvest import ranking as harvest_ranking
from . import mapping, schemas

# Arrêté du 4 mai 2017 (France): phytosanitary spraying is prohibited when wind
# reaches 3 Beaufort (~19 km/h). Real, published regulation.
SPRAYING_WIND_LIMIT_KMH = 19.0
SPRAYING_SOURCE = "Arrêté du 4 mai 2017 (France) - pulvérisation interdite à vent >= 19 km/h (3 Beaufort)"

AGRONOMIC_SOURCES = [
    {"crop": "pea", "hazard": "heat_stress", "institution": "Terres Inovia",
     "url": "https://www.terresinovia.fr/fr/informations-techniques/pois-dhiver/accidents-climatiques-du-pois-secheresse-et-temperatures"},
    {"crop": "fava_bean", "hazard": "heat_stress/frost", "institution": "Terres Inovia",
     "url": "https://www.terresinovia.fr/fr/informations-techniques/feverole-de-printemps/accidents-climatiques-de-la-feverole-secheresse-et"},
    {"crop": "spraying", "hazard": "regulatory", "institution": "Légifrance",
     "url": "https://www.legifrance.gouv.fr/"},
]

app = FastAPI(
    title="LegumAmies ClimateShield API",
    version="0.1.0",
    description="Real weather-risk & harvest decision support for French legumes.",
)

# CORS: configurable allow-list (comma-separated) via env; permissive default
# for the hackathon test deployment.
_origins = os.getenv("LEGUMAMIES_CORS_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _origins == "*" else [o.strip() for o in _origins.split(",")],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "legumamies-climateshield-api", "version": app.version}


@app.get("/meta")
def meta() -> dict:
    """Supported vocabulary, FR<->PY mappings and the sourced rule catalogue."""
    rules = config.load_crop_rules()
    return {
        "supported_crops_py": list(config.SUPPORTED_CROPS),
        "growth_stages_py": list(config.GROWTH_STAGES),
        "crop_fr_to_py": mapping.CROP_FR_TO_PY,
        "stage_fr_to_py": mapping.STAGE_FR_TO_PY,
        "rule_catalogue": rules.to_dict(orient="records"),
        "agronomic_sources": AGRONOMIC_SOURCES,
        "rain_threshold_default_mm": config.DEFAULT_RAIN_THRESHOLD_MM,
        "arome_model_id": config.AROME_MODEL_ID,
        "aifs_model_id": config.AIFS_MODEL_ID,
    }


def _spraying_windows(weather_df: pd.DataFrame) -> list[schemas.RegulatoryWindow]:
    if "wind_speed_kmh" not in weather_df.columns or weather_df.empty:
        return []
    df = weather_df.copy()
    df["date_local"] = pd.to_datetime(df["valid_time_local"]).dt.date
    out = []
    for date_local, grp in df.groupby("date_local"):
        wmax = float(pd.to_numeric(grp["wind_speed_kmh"], errors="coerce").max())
        out.append(schemas.RegulatoryWindow(
            date_local=str(date_local),
            max_wind_speed_kmh=round(wmax, 1),
            spraying_allowed=bool(wmax < SPRAYING_WIND_LIMIT_KMH),
            threshold_kmh=SPRAYING_WIND_LIMIT_KMH,
            source=SPRAYING_SOURCE,
        ))
    return out


@app.post("/assess", response_model=schemas.AssessResponse)
def assess(req: schemas.AssessRequest) -> schemas.AssessResponse:
    crop = mapping.normalise_crop(req.crop)
    stage = mapping.normalise_stage(req.growth_stage)
    field_id = f"req-{uuid.uuid4().hex[:10]}"
    retrieved_at = datetime.now(_tz.utc).isoformat()
    field = {
        "field_id": field_id,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "crop": crop,
        "growth_stage": stage,
        "harvest_ready": req.harvest_ready if req.harvest_ready is not None else (stage == "harvest_ready"),
    }

    # --- 1. AROME short-term forecast (real, in-memory) ---
    try:
        raw_arome = arome.fetch_arome(req.latitude, req.longitude, forecast_days=req.arome_forecast_days)
        var_report = arome.check_variables(raw_arome, config.AROME_HOURLY_VARS)
        weather_df = arome.to_dataframe(raw_arome, field_id=field_id, retrieved_at_utc=retrieved_at)
    except arome.AromeFetchError as exc:
        raise HTTPException(status_code=502, detail=f"AROME forecast unavailable: {exc}")

    # --- 2. AIFS ensemble + daily rain probabilities (real, in-memory) ---
    try:
        raw_aifs = aifs.fetch_ensemble(req.latitude, req.longitude, forecast_days=req.aifs_forecast_days)
        members = aifs.count_valid_members(raw_aifs)
        ensemble_df = aifs.to_long_dataframe(raw_aifs, field_id=field_id)
    except aifs.AifsFetchError as exc:
        raise HTTPException(status_code=502, detail=f"AIFS ensemble unavailable: {exc}")

    prob_df = ensemble_processing.compute_daily_rain_probabilities(
        ensemble_df, threshold_mm=req.rain_threshold_mm
    )

    # --- 3. Sourced risk assessment (read-only rule catalogue) ---
    rules_df = config.load_crop_rules()
    alerts_df = risk_rules.evaluate_risks(weather_df, crop, stage, field_id, rules_df=rules_df)
    n_active = int(
        ((rules_df["crop"] == crop) & (rules_df["growth_stage"] == stage)
         & (rules_df["validation_status"] == "published")).sum()
    )

    # --- 4. Harvest ranking (weather-only, per request) ---
    if req.machinery:
        machinery_df = pd.DataFrame(
            [{"field_id": field_id, "date_local": m.date_local, "available": m.available}
             for m in req.machinery]
        )
        machinery_note = "machinery availability provided by caller"
    else:
        # No machinery info: assume all forecast days available, flagged below.
        machinery_df = pd.DataFrame(
            [{"field_id": field_id, "date_local": d, "available": True}
             for d in prob_df["date_local"].tolist()]
        )
        machinery_note = "machinery availability not provided; all days assumed available (provisional)"

    ranking_df = harvest_ranking.rank_harvest_windows(
        field_id=field_id, crop=crop, growth_stage=stage,
        harvest_ready=bool(field["harvest_ready"]),
        rain_prob_df=prob_df, machinery_df=machinery_df,
    )
    n_feasible = int(ranking_df["feasible"].sum()) if not ranking_df.empty else 0
    recommended = (
        ranking_df.loc[ranking_df["rank"] == 1, "date_local"].iloc[0] if n_feasible else None
    )

    # ---- Assemble typed response ----
    weather_block = schemas.WeatherBlock(
        model_id=config.AROME_MODEL_ID, url=config.AROME_URL,
        available_variables=var_report["available"], missing_variables=var_report["missing"],
        units=var_report["units"],
        valid_time_local_start=str(weather_df["valid_time_local"].iloc[0]) if len(weather_df) else None,
        valid_time_local_end=str(weather_df["valid_time_local"].iloc[-1]) if len(weather_df) else None,
        n_hours=int(len(weather_df)),
        hourly=[
            schemas.HourlyPoint(
                valid_time_utc=str(r["valid_time_utc"]),
                valid_time_local=str(r["valid_time_local"]),
                temperature_c=_num(r.get("temperature_c")),
                precipitation_mm=_num(r.get("precipitation_mm")),
                relative_humidity_pct=_num(r.get("relative_humidity_pct")),
                wind_speed_kmh=_num(r.get("wind_speed_kmh")),
            )
            for r in weather_df.to_dict(orient="records")
        ],
    )

    ensemble_block = schemas.EnsembleBlock(
        model_id=config.AIFS_MODEL_ID, url=config.AIFS_URL,
        ensemble_members_valid=members, rain_threshold_mm=req.rain_threshold_mm,
        threshold_note="Operational demo threshold, not a validated harvest limit.",
        daily=[schemas.RainProbabilityDay(**row) for row in _prob_records(prob_df)],
    )

    risk_block = schemas.RiskBlock(
        active_published_rules_for_stage=n_active,
        alerts=[schemas.RiskAlert(**_alert_record(r)) for r in alerts_df.to_dict(orient="records")],
        note="Threshold exceedance is a risk flag, not a prediction of crop damage.",
    )

    harvest_block = schemas.HarvestBlock(
        available=bool(field["harvest_ready"]),
        harvest_ready=bool(field["harvest_ready"]),
        weights={
            "rain_probability": harvest_ranking.WEIGHT_RAIN_PROBABILITY,
            "rain_amount": harvest_ranking.WEIGHT_RAIN_AMOUNT,
            "reference_rain_mm": harvest_ranking.REFERENCE_RAIN_MM,
        },
        recommended_date_local=recommended,
        n_feasible_days=n_feasible,
        days=[schemas.HarvestDay(**_harvest_record(r)) for r in ranking_df.to_dict(orient="records")],
        note=("Deterministic weather-only decision aid; not an agronomically validated "
              "optimiser. " + machinery_note),
    )

    field_echo = schemas.FieldEcho(
        field_id=field_id, field_name=req.field_name,
        latitude=req.latitude, longitude=req.longitude,
        crop_py=crop, crop_fr=mapping.CROP_PY_TO_FR[crop], crop_label_fr=mapping.CROP_LABEL_FR[crop],
        growth_stage_py=stage, growth_stage_fr=mapping.STAGE_PY_TO_FR[stage],
        growth_stage_label_fr=mapping.STAGE_LABEL_FR[stage],
    )

    provenance = schemas.Provenance(
        retrieved_at_utc=retrieved_at,
        arome_model_id=config.AROME_MODEL_ID, aifs_model_id=config.AIFS_MODEL_ID,
        agronomic_sources=AGRONOMIC_SOURCES,
        data_kinds={
            "weather": "real_weather_forecast",
            "ensemble": "derived_from_real_forecast",
            "risk": "risk_detection_from_real_forecast_and_agronomic_evidence",
            "harvest": "weather_only_decision_aid",
            "regulatory": "published_regulation",
        },
    )

    return schemas.AssessResponse(
        field=field_echo, weather=weather_block, ensemble=ensemble_block,
        risk=risk_block, harvest=harvest_block,
        regulatory_windows=_spraying_windows(weather_df), provenance=provenance,
    )


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def _num(v):
    try:
        if v is None or pd.isna(v):
            return None
        return float(v)
    except (TypeError, ValueError):
        return None


def _prob_records(df: pd.DataFrame) -> list[dict]:
    cols = ["date_local", "rain_threshold_mm", "probability_pct", "ensemble_members_used",
            "mean_precipitation_mm", "median_precipitation_mm"]
    return [{c: r[c] for c in cols} for r in df.to_dict(orient="records")]


def _alert_record(r: dict) -> dict:
    return {
        "hazard_type": r["hazard_type"], "weather_variable": r["weather_variable"],
        "threshold_value": float(r["threshold_value"]), "comparison_operator": r["comparison_operator"],
        "observed_value": float(r["observed_value"]),
        "forecast_start_local": str(r["forecast_start_local"]),
        "forecast_end_local": str(r["forecast_end_local"]),
        "exposure_hours": int(r["exposure_hours"]),
        "minimum_exposure_hours": int(r["minimum_exposure_hours"]),
        "source_url": r["source_url"], "validation_status": r["validation_status"],
    }


def _harvest_record(r: dict) -> dict:
    rank = r.get("rank")
    return {
        "date_local": str(r["date_local"]), "feasible": bool(r["feasible"]),
        "rain_probability_pct": float(r["rain_probability_pct"]),
        "expected_rain_mm": float(r["expected_rain_mm"]),
        "weather_risk_score": float(r["weather_risk_score"]),
        "rank": int(rank) if pd.notna(rank) else None,
        "explanation": str(r["explanation"]), "limitations": str(r["limitations"]),
    }


# AWS Lambda entrypoint (used by the backend deployment). Optional import so the
# app also runs under plain uvicorn without mangum installed.
try:  # pragma: no cover
    from mangum import Mangum
    handler = Mangum(app)
except ImportError:  # pragma: no cover
    handler = None
