"""Harvest Window Optimizer.

Ranks candidate harvest dates for a field using the AIFS-derived daily rainfall
probabilities, subject to machinery availability and crop harvest-readiness.

The scoring function is DETERMINISTIC with documented weights. It is a
transparent weather-based decision aid, NOT an agronomically validated
optimisation model. When grain moisture or soil trafficability information is
absent, the ranking is explicitly labelled weather-only and provisional.
"""
from __future__ import annotations

import pandas as pd

from .. import config

# ------------------------------------------------------------------
# Documented scoring weights (sum to 1.0). Lower score = better day.
#   - probability term: share of ensemble members exceeding the rain threshold
#   - amount term: expected (mean) daily rain, normalised by REFERENCE_RAIN_MM
# ------------------------------------------------------------------
WEIGHT_RAIN_PROBABILITY = 0.70
WEIGHT_RAIN_AMOUNT = 0.30
REFERENCE_RAIN_MM = 20.0  # mm/day treated as "fully wet" for normalisation
SCORE_SCALE = 100.0


def _weather_risk_score(probability_pct: float, expected_rain_mm: float) -> float:
    """Deterministic 0-100 weather risk score (higher = worse harvest day)."""
    prob_term = max(0.0, min(probability_pct / 100.0, 1.0))
    amount_term = max(0.0, min(expected_rain_mm / REFERENCE_RAIN_MM, 1.0))
    score = WEIGHT_RAIN_PROBABILITY * prob_term + WEIGHT_RAIN_AMOUNT * amount_term
    return round(SCORE_SCALE * score, 2)


def rank_harvest_windows(
    field_id: str,
    crop: str,
    growth_stage: str,
    harvest_ready: bool,
    rain_prob_df: pd.DataFrame,
    machinery_df: pd.DataFrame,
    grain_moisture: dict | None = None,
    constraints: dict | None = None,
) -> pd.DataFrame:
    """Rank feasible harvest dates by weather risk.

    Columns: field_id, date_local, feasible, rain_probability_pct,
    expected_rain_mm, weather_risk_score, rank, explanation, limitations.
    """
    rp = rain_prob_df[rain_prob_df["field_id"] == field_id].copy()
    mach = machinery_df[machinery_df["field_id"] == field_id].copy()

    avail_map = dict(zip(mach["date_local"].astype(str), mach["available"]))
    blocked_dates = set((constraints or {}).get("blocked_dates", []))

    weather_only = grain_moisture is None
    base_limitation = (
        "weather-only, provisional (no grain-moisture / soil-trafficability data)"
        if weather_only
        else "weather + grain-moisture inputs; still provisional"
    )

    rows = []
    for _, r in rp.iterrows():
        date_local = str(r["date_local"])
        probability = float(r["probability_pct"])
        expected_rain = float(r["mean_precipitation_mm"])
        machine_ok = bool(avail_map.get(date_local, False))
        not_blocked = date_local not in blocked_dates

        feasible = bool(harvest_ready and machine_ok and not_blocked)
        score = _weather_risk_score(probability, expected_rain)

        reasons = []
        if not harvest_ready:
            reasons.append("crop not declared harvest-ready")
        if not machine_ok:
            reasons.append("harvesting machinery unavailable")
        if not not_blocked:
            reasons.append("date excluded by farmer constraint")
        if feasible:
            reasons.append(
                f"feasible: {probability:.0f}% ensemble rain-prob >"
                f"{config.DEFAULT_RAIN_THRESHOLD_MM:g}mm, "
                f"expected {expected_rain:.1f}mm, risk score {score:.1f}/100"
            )

        rows.append(
            {
                "field_id": field_id,
                "date_local": date_local,
                "feasible": feasible,
                "rain_probability_pct": probability,
                "expected_rain_mm": round(expected_rain, 3),
                "weather_risk_score": score,
                "rank": pd.NA,
                "explanation": "; ".join(reasons),
                "limitations": base_limitation,
            }
        )

    out = pd.DataFrame(
        rows,
        columns=[
            "field_id",
            "date_local",
            "feasible",
            "rain_probability_pct",
            "expected_rain_mm",
            "weather_risk_score",
            "rank",
            "explanation",
            "limitations",
        ],
    )
    if out.empty:
        return out

    out = out.sort_values("date_local").reset_index(drop=True)

    # Rank only feasible dates: ascending weather risk, ties broken by earliest date.
    feasible_mask = out["feasible"]
    feasible = out[feasible_mask].sort_values(
        ["weather_risk_score", "date_local"]
    ).copy()
    feasible["rank"] = range(1, len(feasible) + 1)
    out.loc[feasible.index, "rank"] = feasible["rank"].values

    # Baseline comparison: earliest feasible date vs the top-ranked date.
    if not feasible.empty:
        baseline_date = out[feasible_mask].sort_values("date_local")["date_local"].iloc[0]
        best = feasible.sort_values("rank").iloc[0]
        for idx in out.index[feasible_mask]:
            tag = []
            if out.at[idx, "date_local"] == baseline_date:
                tag.append("baseline = earliest feasible date")
            if out.at[idx, "rank"] == 1:
                saved = _weather_risk_score(
                    out.loc[out["date_local"] == baseline_date, "rain_probability_pct"].iloc[0],
                    out.loc[out["date_local"] == baseline_date, "expected_rain_mm"].iloc[0],
                )
                tag.append(
                    f"recommended (best weather risk {best['weather_risk_score']:.1f} "
                    f"vs baseline {saved:.1f})"
                )
            if tag:
                out.at[idx, "explanation"] += " | " + "; ".join(tag)

    return out


def run(
    field: dict,
    rain_prob_df: pd.DataFrame,
    machinery_df: pd.DataFrame | None = None,
    grain_moisture: dict | None = None,
    constraints: dict | None = None,
    harvest_ready_override: bool | None = None,
    save: bool = True,
) -> tuple[pd.DataFrame, dict]:
    """Rank harvest windows for a field and optionally export CSV."""
    if machinery_df is None:
        machinery_df = config.load_machinery()

    harvest_ready = (
        bool(field.get("harvest_ready"))
        if harvest_ready_override is None
        else bool(harvest_ready_override)
    )

    ranking = rank_harvest_windows(
        field_id=field["field_id"],
        crop=field["crop"],
        growth_stage=field["growth_stage"],
        harvest_ready=harvest_ready,
        rain_prob_df=rain_prob_df,
        machinery_df=machinery_df,
        grain_moisture=grain_moisture,
        constraints=constraints,
    )
    if save:
        config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        ranking.to_csv(config.HARVEST_RANKING_CSV, index=False)

    n_feasible = int(ranking["feasible"].sum()) if not ranking.empty else 0
    recommended = (
        ranking.loc[ranking["rank"] == 1, "date_local"].iloc[0]
        if n_feasible
        else None
    )
    meta = {
        "dataset": "Harvest window ranking",
        "data_kind": "weather_only_decision_aid",
        "harvest_ready": harvest_ready,
        "weights": {
            "rain_probability": WEIGHT_RAIN_PROBABILITY,
            "rain_amount": WEIGHT_RAIN_AMOUNT,
            "reference_rain_mm": REFERENCE_RAIN_MM,
        },
        "n_candidate_days": int(len(ranking)),
        "n_feasible_days": n_feasible,
        "recommended_date_local": recommended,
        "note": "Deterministic weather-based aid; not an agronomically validated optimiser.",
    }
    return ranking, meta
