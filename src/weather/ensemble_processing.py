"""Dataset B post-processing - daily rainfall exceedance probabilities.

Converts the long-format AIFS ensemble precipitation series into a
per-calendar-day probability that 24 h rainfall exceeds a configurable
threshold, derived from the spread across *individual* ensemble members.

    P(rain > T in 24 h) = (members with daily total > T) / (valid members)

The threshold (default 5 mm) is an operational DEMONSTRATION value, not a
scientifically established universal harvest limit. Interpolated hourly
forecast values are summed per member to a daily total; they are NOT treated
as independent observations. Incomplete local days (fewer than 24 hourly
steps) and members that do not cover a full day are excluded.
"""
from __future__ import annotations

import pandas as pd

from .. import config

HOURS_PER_COMPLETE_DAY = 24


def compute_daily_rain_probabilities(
    long_df: pd.DataFrame,
    threshold_mm: float = config.DEFAULT_RAIN_THRESHOLD_MM,
    model_id: str = config.AIFS_MODEL_ID,
) -> pd.DataFrame:
    """Compute per-day exceedance probability from ensemble members.

    Parameters
    ----------
    long_df : DataFrame
        Long-format ensemble data with columns ``field_id``, ``member_id``,
        ``valid_time_local`` and ``precipitation_mm``.
    threshold_mm : float
        Daily-total rainfall threshold (mm) that defines an "exceedance".
    model_id : str
        Model identifier recorded in the output.

    Returns
    -------
    DataFrame with columns: field_id, date_local, rain_threshold_mm,
    probability_pct, ensemble_members_used, mean_precipitation_mm,
    median_precipitation_mm, model_id.
    """
    if long_df.empty:
        return _empty_frame()

    df = long_df.copy()
    local = pd.to_datetime(df["valid_time_local"], utc=False)
    # When read from CSV the column is tz-aware; normalise to the calendar date.
    df["date_local"] = local.dt.date

    # Per (field, member, day): hourly count + precipitation total.
    per_member_day = (
        df.groupby(["field_id", "member_id", "date_local"])
        .agg(
            n_hours=("precipitation_mm", "size"),
            daily_total=("precipitation_mm", "sum"),
            n_valid=("precipitation_mm", "count"),
        )
        .reset_index()
    )

    # Keep only complete days with no missing hourly values for that member.
    complete = per_member_day[
        (per_member_day["n_hours"] == HOURS_PER_COMPLETE_DAY)
        & (per_member_day["n_valid"] == HOURS_PER_COMPLETE_DAY)
    ].copy()

    if complete.empty:
        return _empty_frame()

    complete["exceeds"] = complete["daily_total"] > threshold_mm

    rows = []
    for (field_id, date_local), grp in complete.groupby(["field_id", "date_local"]):
        members_used = int(grp["member_id"].nunique())
        exceeding = int(grp["exceeds"].sum())
        probability = 100.0 * exceeding / members_used if members_used else float("nan")
        rows.append(
            {
                "field_id": field_id,
                "date_local": pd.Timestamp(date_local).strftime("%Y-%m-%d"),
                "rain_threshold_mm": float(threshold_mm),
                "probability_pct": round(probability, 1),
                "ensemble_members_used": members_used,
                "mean_precipitation_mm": round(float(grp["daily_total"].mean()), 3),
                "median_precipitation_mm": round(float(grp["daily_total"].median()), 3),
                "model_id": model_id,
            }
        )

    out = pd.DataFrame(rows).sort_values(["field_id", "date_local"]).reset_index(drop=True)
    return out


def _empty_frame() -> pd.DataFrame:
    return pd.DataFrame(
        columns=[
            "field_id",
            "date_local",
            "rain_threshold_mm",
            "probability_pct",
            "ensemble_members_used",
            "mean_precipitation_mm",
            "median_precipitation_mm",
            "model_id",
        ]
    )


def run(
    long_df: pd.DataFrame,
    threshold_mm: float = config.DEFAULT_RAIN_THRESHOLD_MM,
    save: bool = True,
) -> tuple[pd.DataFrame, dict]:
    """Compute probabilities and optionally export rain_probabilities.csv."""
    out = compute_daily_rain_probabilities(long_df, threshold_mm=threshold_mm)
    if save:
        config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        out.to_csv(config.RAIN_PROBABILITIES_CSV, index=False)
    meta = {
        "dataset": "AIFS ensemble daily rainfall probabilities",
        "data_kind": "derived_from_real_forecast",
        "rain_threshold_mm": float(threshold_mm),
        "threshold_note": "5 mm/24h is an operational demo threshold, not a validated harvest limit",
        "n_days": int(len(out)),
        "members_used_min": int(out["ensemble_members_used"].min()) if len(out) else None,
        "members_used_max": int(out["ensemble_members_used"].max()) if len(out) else None,
    }
    return out, meta
