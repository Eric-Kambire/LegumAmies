"""Pipeline orchestration helpers and run-metadata emission.

Provides a single ``run_pipeline`` entry point (used by tests and callable from
anywhere) plus a ``write_run_metadata`` helper that records provenance for a
run: retrieval timestamps, exact model identifiers, input coordinates, returned
date ranges, response availability and source URLs.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone as _tz
from pathlib import Path

import pandas as pd
import requests

from . import config
from .weather import arome, aifs, ensemble_processing
from .risk import rules
from .harvest import ranking

# Evidence sources backing the ACTIVE (published) agronomic rules.
AGRONOMIC_SOURCES = [
    {
        "crop": "fava_bean",
        "hazard": "heat_stress / frost",
        "institution": "Terres Inovia",
        "url": "https://www.terresinovia.fr/fr/informations-techniques/feverole-de-printemps/accidents-climatiques-de-la-feverole-secheresse-et",
    },
    {
        "crop": "fava_bean",
        "hazard": "frost (winter hardiness)",
        "institution": "Terres Inovia",
        "url": "https://www.terresinovia.fr/fr/informations-techniques/feverole-dhiver/accidents-climatiques-de-la-feverole-gel-et-basses",
    },
    {
        "crop": "pea",
        "hazard": "heat_stress",
        "institution": "Terres Inovia",
        "url": "https://www.terresinovia.fr/fr/informations-techniques/pois-dhiver/accidents-climatiques-du-pois-secheresse-et-temperatures",
    },
]


def write_run_metadata(
    field: dict,
    arome_meta: dict,
    aifs_meta: dict,
    prob_meta: dict,
    risk_meta: dict,
    harvest_meta: dict,
    path: Path | str = config.RUN_METADATA_JSON,
) -> Path:
    """Write a provenance record for the run and return its path."""
    metadata = {
        "generated_at_utc": datetime.now(_tz.utc).isoformat(),
        "field": {
            "field_id": field["field_id"],
            "latitude": field["latitude"],
            "longitude": field["longitude"],
            "crop": field["crop"],
            "growth_stage": field["growth_stage"],
            "data_kind": "user_provided_hypothetical_farm_information",
        },
        "datasets": {
            "arome": arome_meta,
            "aifs_ensemble": aifs_meta,
            "rain_probabilities": prob_meta,
            "risk_alerts": risk_meta,
            "harvest_ranking": harvest_meta,
        },
        "agronomic_evidence_sources": AGRONOMIC_SOURCES,
        "data_kind_legend": {
            "real_weather_forecast": "AROME & AIFS forecasts retrieved live from the APIs",
            "derived_from_real_forecast": "computed from the real forecasts (e.g. probabilities)",
            "risk_detection_from_real_forecast_and_agronomic_evidence": "threshold flags, not damage predictions",
            "user_provided_hypothetical_farm_information": "demo field/machinery, not a real observed farm",
            "weather_only_decision_aid": "ranking uses weather only; provisional",
        },
    }
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def run_pipeline(
    field_id: str = "DEMO_001",
    arome_forecast_days: int = 2,
    aifs_forecast_days: int = 10,
    rain_threshold_mm: float = config.DEFAULT_RAIN_THRESHOLD_MM,
    harvest_ready_override: bool | None = None,
    session: requests.Session | None = None,
    save: bool = True,
) -> dict:
    """Execute the full ClimateShield pipeline for one field.

    Returns a dict of DataFrames and metadata. Performs REAL API calls.
    """
    config.ensure_dirs()
    field = config.get_field(field_id)

    weather_df, arome_meta = arome.run(
        field, forecast_days=arome_forecast_days, session=session, save=save
    )
    ensemble_df, aifs_meta = aifs.run(
        field, forecast_days=aifs_forecast_days, session=session, save=save
    )
    prob_df, prob_meta = ensemble_processing.run(
        ensemble_df, threshold_mm=rain_threshold_mm, save=save
    )
    alerts_df, risk_meta = rules.run(weather_df, field, save=save)
    ranking_df, harvest_meta = ranking.run(
        field, prob_df, harvest_ready_override=harvest_ready_override, save=save
    )

    if save:
        write_run_metadata(
            field, arome_meta, aifs_meta, prob_meta, risk_meta, harvest_meta
        )

    return {
        "field": field,
        "weather_df": weather_df,
        "ensemble_df": ensemble_df,
        "prob_df": prob_df,
        "alerts_df": alerts_df,
        "ranking_df": ranking_df,
        "metadata": {
            "arome": arome_meta,
            "aifs": aifs_meta,
            "rain_probabilities": prob_meta,
            "risk": risk_meta,
            "harvest": harvest_meta,
        },
    }
