"""Dataset D - crop-stage-specific weather risk evaluator.

Compares an hourly AROME forecast against agronomic threshold rules
(``data/raw/crop_rules.csv``) and emits alerts when a hazard condition is met
for at least its minimum exposure duration.

Design principles enforced here:
  * Every ACTIVE rule must carry a traceable ``source_url``. By default only
    rules with ``validation_status == 'published'`` are evaluated; unvalidated
    or demo rules are ignored unless ``include_unvalidated=True``.
  * Each alert carries its evidence source and validation status, so the
    output never presents an unsourced threshold as established fact.
  * Detecting that a weather threshold is exceeded is NOT the same as predicting
    actual crop damage. No yield reductions are estimated or implied.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .. import config

# Map rule weather_variable -> column in the processed AROME frame.
_VARIABLE_COLUMN = {
    "temperature_2m": "temperature_c",
    "precipitation": "precipitation_mm",
    "relative_humidity_2m": "relative_humidity_pct",
    "wind_speed_10m": "wind_speed_kmh",
}

_OPERATORS = {
    "gt": lambda s, t: s > t,
    "ge": lambda s, t: s >= t,
    "lt": lambda s, t: s < t,
    "le": lambda s, t: s <= t,
}

ALERT_COLUMNS = [
    "field_id",
    "crop",
    "growth_stage",
    "hazard_type",
    "weather_variable",
    "forecast_start_local",
    "forecast_end_local",
    "threshold_value",
    "comparison_operator",
    "observed_value",
    "exposure_hours",
    "minimum_exposure_hours",
    "source_url",
    "validation_status",
]


def _consecutive_runs(mask: pd.Series) -> list[tuple[int, int]]:
    """Return (start_idx, end_idx_inclusive) for each run of True values."""
    runs = []
    values = mask.to_numpy()
    n = len(values)
    i = 0
    while i < n:
        if values[i]:
            j = i
            while j + 1 < n and values[j + 1]:
                j += 1
            runs.append((i, j))
            i = j + 1
        else:
            i += 1
    return runs


def evaluate_risks(
    weather_df: pd.DataFrame,
    crop: str,
    growth_stage: str,
    field_id: str,
    rules_df: pd.DataFrame | None = None,
    include_unvalidated: bool = False,
) -> pd.DataFrame:
    """Evaluate hazard rules for a crop/stage against an hourly forecast.

    Returns a DataFrame with :data:`ALERT_COLUMNS`. An empty (headers-only)
    frame means no active hazard condition was met - a valid, honest result.
    """
    if rules_df is None:
        rules_df = config.load_crop_rules()

    selected = rules_df[
        (rules_df["crop"] == crop) & (rules_df["growth_stage"] == growth_stage)
    ].copy()

    if not include_unvalidated:
        selected = selected[selected["validation_status"] == "published"]

    # An active rule must have a traceable source.
    selected = selected[selected["source_url"].astype(str).str.strip() != ""]

    df = weather_df.reset_index(drop=True)
    local_times = pd.to_datetime(df["valid_time_local"])

    alerts = []
    for _, rule in selected.iterrows():
        col = _VARIABLE_COLUMN.get(rule["weather_variable"])
        op = _OPERATORS.get(str(rule["comparison_operator"]))
        if col is None or op is None or col not in df.columns:
            # Variable not available in this forecast -> cannot evaluate; skip.
            continue

        series = pd.to_numeric(df[col], errors="coerce")
        threshold = float(rule["threshold_value"])
        mask = op(series, threshold) & series.notna()
        min_hours = int(rule["minimum_exposure_hours"])
        descending = str(rule["comparison_operator"]) in ("lt", "le")

        for start, end in _consecutive_runs(mask):
            exposure_hours = end - start + 1
            if exposure_hours < min_hours:
                continue
            window = series.iloc[start : end + 1]
            observed = float(window.min() if descending else window.max())
            alerts.append(
                {
                    "field_id": field_id,
                    "crop": crop,
                    "growth_stage": growth_stage,
                    "hazard_type": rule["hazard_type"],
                    "weather_variable": rule["weather_variable"],
                    "forecast_start_local": str(local_times.iloc[start]),
                    "forecast_end_local": str(local_times.iloc[end]),
                    "threshold_value": threshold,
                    "comparison_operator": rule["comparison_operator"],
                    "observed_value": round(observed, 3),
                    "exposure_hours": int(exposure_hours),
                    "minimum_exposure_hours": min_hours,
                    "source_url": rule["source_url"],
                    "validation_status": rule["validation_status"],
                }
            )

    if not alerts:
        return pd.DataFrame(columns=ALERT_COLUMNS)
    return pd.DataFrame(alerts, columns=ALERT_COLUMNS)


def run(
    weather_df: pd.DataFrame,
    field: dict,
    rules_df: pd.DataFrame | None = None,
    include_unvalidated: bool = False,
    save: bool = True,
) -> tuple[pd.DataFrame, dict]:
    """Evaluate risks for a field and optionally export flowering_alerts.csv."""
    if rules_df is None:
        rules_df = config.load_crop_rules()

    alerts = evaluate_risks(
        weather_df,
        crop=field["crop"],
        growth_stage=field["growth_stage"],
        field_id=field["field_id"],
        rules_df=rules_df,
        include_unvalidated=include_unvalidated,
    )
    if save:
        config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        alerts.to_csv(config.FLOWERING_ALERTS_CSV, index=False)

    n_active = int(
        (
            (rules_df["crop"] == field["crop"])
            & (rules_df["growth_stage"] == field["growth_stage"])
            & (rules_df["validation_status"] == "published")
        ).sum()
    )
    meta = {
        "dataset": "Crop-stage weather risk alerts",
        "data_kind": "risk_detection_from_real_forecast_and_agronomic_evidence",
        "crop": field["crop"],
        "growth_stage": field["growth_stage"],
        "active_published_rules_for_stage": n_active,
        "n_alerts": int(len(alerts)),
        "note": "Threshold exceedance is a risk flag, not a prediction of crop damage.",
    }
    return alerts, meta
