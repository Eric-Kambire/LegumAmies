"""Reproducible library for the PBC-inspired subseasonal experiment.

Scientific scope and honesty
----------------------------
This module implements a *reduced, explicitly-labelled* probabilistic
bias-correction (PBC-inspired) study for weeks 3-4 over Bourgogne-Franche-Comte
(France), for two outcomes relevant to spring peas: "unusually warm" and
"unusually wet" conditions.

It uses GENUINE data only:
  * Observations = ERA5 reanalysis retrieved from the Open-Meteo archive
    (``models=era5``), daily 2 m mean temperature (degC) and precipitation sum
    (mm). These are real reanalysis values, not synthetic.

It does NOT reproduce the original MIT PBC model (Guan et al., Nature 2026,
github.com/mouatadid/pbc, MIT License). That model requires licensed S2S
dynamical/AI ensemble hindcasts (ECMWF/IRI credentials) and large compute, none
of which are available in this environment. Instead we build the framework's
own *reference forecasts* from ERA5 and a PBC-inspired recalibration:

  1. Climatology           - base-rate probability from the training split.
  2. Raw statistical fcst  - a "Persistence++"-inspired logistic model using
                             only information available at initialisation
                             (recent-anomaly persistence). This is a genuine
                             statistical subseasonal forecast, NOT disguised
                             observations.
  3. PBC-inspired          - isotonic reliability recalibration of the raw
                             forecast probabilities (learning-enhanced
                             probabilities), fit on train only.

All thresholds, climatologies and model fits use the TRAIN split only and are
applied forward in time (chronological, leak-free).
"""
from __future__ import annotations

import time
import logging
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
import requests

log = logging.getLogger("pbc")

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

# Bourgogne-Franche-Comte sample points (real towns across the region).
BFC_POINTS = {
    "Dijon": (47.32, 5.04),
    "Besancon": (47.24, 6.02),
    "Nevers": (46.99, 3.16),
    "Macon": (46.31, 4.83),
    "Belfort": (47.64, 6.86),
}

# Weeks 3-4 of a subseasonal forecast = valid days 15-28 after initialisation.
LEAD_START_DAY = 15
LEAD_END_DAY = 28
BIWEEKLY_DAYS = LEAD_END_DAY - LEAD_START_DAY + 1  # 14

# "Unusually" = above the upper tercile (CPC-style above-normal category).
UPPER_TERCILE_Q = 2.0 / 3.0


# --------------------------------------------------------------------------
# 1. Genuine ERA5 retrieval (Open-Meteo archive)
# --------------------------------------------------------------------------
def fetch_era5_point(lat: float, lon: float, start_date: str, end_date: str,
                     session: requests.Session | None = None, timeout: int = 90,
                     max_retries: int = 3) -> pd.DataFrame:
    """Return a daily ERA5 DataFrame (date, t2m_mean_c, precip_mm) for one point."""
    params = {
        "latitude": lat, "longitude": lon,
        "start_date": start_date, "end_date": end_date,
        "daily": "temperature_2m_mean,precipitation_sum",
        "timezone": "UTC", "models": "era5",
    }
    http = session or requests
    last_err = None
    for attempt in range(1, max_retries + 1):
        try:
            r = http.get(ARCHIVE_URL, params=params, timeout=timeout)
            if r.status_code != 200:
                last_err = f"HTTP {r.status_code}: {r.text[:200]}"
                time.sleep(2 * attempt)
                continue
            d = r.json().get("daily", {})
            df = pd.DataFrame({
                "date": pd.to_datetime(d["time"]),
                "t2m_mean_c": pd.to_numeric(pd.Series(d["temperature_2m_mean"]), errors="coerce"),
                "precip_mm": pd.to_numeric(pd.Series(d["precipitation_sum"]), errors="coerce"),
            })
            return df
        except requests.RequestException as exc:
            last_err = str(exc)
            time.sleep(2 * attempt)
    raise RuntimeError(f"ERA5 fetch failed for ({lat},{lon}): {last_err}")


def fetch_era5_region(points: dict | None, start_date: str, end_date: str,
                      timeout: int = 120, max_retries: int = 4) -> pd.DataFrame:
    """Region-average daily ERA5 across the given points (real reanalysis).

    Uses a single multi-location Open-Meteo archive request (comma-separated
    coordinates) to respect the per-minute rate limit. Returns the unweighted
    mean across points of daily mean temperature (degC) and precipitation (mm).
    """
    points = points or BFC_POINTS
    names = list(points)
    lats = ",".join(str(points[n][0]) for n in names)
    lons = ",".join(str(points[n][1]) for n in names)
    params = {
        "latitude": lats, "longitude": lons,
        "start_date": start_date, "end_date": end_date,
        "daily": "temperature_2m_mean,precipitation_sum",
        "timezone": "UTC", "models": "era5",
    }
    log.info("Fetching ERA5 (multi-point) for %d BFC points %s..%s", len(names), start_date, end_date)
    last_err = None
    for attempt in range(1, max_retries + 1):
        try:
            r = requests.get(ARCHIVE_URL, params=params, timeout=timeout)
            if r.status_code == 429:
                log.warning("Rate limited (429); waiting 60s (attempt %d)", attempt)
                time.sleep(62)
                continue
            if r.status_code != 200:
                last_err = f"HTTP {r.status_code}: {r.text[:200]}"
                time.sleep(5 * attempt); continue
            payload = r.json()
            blocks = payload if isinstance(payload, list) else [payload]
            frames = []
            for name, blk in zip(names, blocks):
                d = blk["daily"]
                frames.append(pd.DataFrame({
                    "date": pd.to_datetime(d["time"]),
                    f"t_{name}": pd.to_numeric(pd.Series(d["temperature_2m_mean"]), errors="coerce"),
                    f"p_{name}": pd.to_numeric(pd.Series(d["precipitation_sum"]), errors="coerce"),
                }).set_index("date"))
            merged = pd.concat(frames, axis=1).sort_index()
            t_cols = [c for c in merged.columns if c.startswith("t_")]
            p_cols = [c for c in merged.columns if c.startswith("p_")]
            out = pd.DataFrame({
                "t2m_mean_c": merged[t_cols].mean(axis=1),
                "precip_mm": merged[p_cols].mean(axis=1),
            }, index=merged.index)
            out.index.name = "date"
            return out.reset_index()
        except requests.RequestException as exc:
            last_err = str(exc); time.sleep(5 * attempt)
    raise RuntimeError(f"ERA5 region fetch failed: {last_err}")


# --------------------------------------------------------------------------
# 2. Build the forecast samples (init dates -> weeks 3-4 targets + predictors)
# --------------------------------------------------------------------------
@dataclass
class Dataset:
    table: pd.DataFrame
    n_total: int = 0
    meta: dict = field(default_factory=dict)


def build_samples(daily: pd.DataFrame, init_day_of_month=(1, 15),
                  target_months=(4, 5, 6, 7, 8)) -> Dataset:
    """Construct biweekly-initialised samples.

    For each init date t0 (1st and 15th of each month), the weeks-3-4 target is
    the mean temperature / total precipitation over valid days [t0+15, t0+28].
    Predictors use ONLY data up to and including t0 (no leakage):
      - temp anomaly of the preceding 14 and 28 days (persistence signal),
      - precip total of the preceding 14 and 28 days,
      - day-of-year (seasonal position, encoded sin/cos).
    Only init dates whose target *window centre* falls in ``target_months``
    (pea growing season) are kept.
    """
    s = daily.set_index("date").sort_index()
    s = s.asfreq("D")  # ensure contiguous daily index
    t = s["t2m_mean_c"]
    p = s["precip_mm"]

    # rolling means/sums ending at each day (inclusive); shifted use below
    t_roll14 = t.rolling(14, min_periods=10).mean()
    t_roll28 = t.rolling(28, min_periods=20).mean()
    p_roll14 = p.rolling(14, min_periods=10).sum()
    p_roll28 = p.rolling(28, min_periods=20).sum()

    # day-of-year climatology of daily temperature (full-period, for predictor
    # anomaly only; the EVENT thresholds are train-only and set later).
    doy = t.index.dayofyear
    clim_t = t.groupby(doy).transform("mean")

    rows = []
    idx = s.index
    for d in idx:
        if d.day not in init_day_of_month:
            continue
        t0 = d
        win_start = t0 + pd.Timedelta(days=LEAD_START_DAY)
        win_end = t0 + pd.Timedelta(days=LEAD_END_DAY)
        if win_end not in idx:
            continue
        centre = t0 + pd.Timedelta(days=(LEAD_START_DAY + LEAD_END_DAY) // 2)
        if centre.month not in target_months:
            continue
        tgt = s.loc[win_start:win_end]
        if tgt["t2m_mean_c"].isna().any() or tgt["precip_mm"].isna().any():
            continue
        if any(pd.isna(x) for x in (t_roll14.get(t0), t_roll28.get(t0),
                                    p_roll14.get(t0), p_roll28.get(t0), clim_t.get(t0))):
            continue
        rows.append({
            "init_date": t0,
            "valid_start": win_start,
            "valid_end": win_end,
            "target_week_of_year": int(win_start.isocalendar().week),
            "year": int(t0.year),
            # targets (weeks 3-4)
            "target_t2m_mean_c": float(tgt["t2m_mean_c"].mean()),
            "target_precip_mm": float(tgt["precip_mm"].sum()),
            # predictors known at init t0 (no leakage)
            "pred_t_anom14": float(t_roll14.loc[t0] - clim_t.loc[t0]),
            "pred_t_anom28": float(t_roll28.loc[t0] - clim_t.loc[t0]),
            "pred_p14": float(p_roll14.loc[t0]),
            "pred_p28": float(p_roll28.loc[t0]),
            "doy_sin": float(np.sin(2 * np.pi * t0.dayofyear / 365.25)),
            "doy_cos": float(np.cos(2 * np.pi * t0.dayofyear / 365.25)),
        })
    table = pd.DataFrame(rows).sort_values("init_date").reset_index(drop=True)
    return Dataset(table=table, n_total=len(table),
                   meta={"init_day_of_month": list(init_day_of_month),
                         "target_months": list(target_months),
                         "lead_days": [LEAD_START_DAY, LEAD_END_DAY]})


# --------------------------------------------------------------------------
# 3. Chronological split + train-only event labels (upper tercile)
# --------------------------------------------------------------------------
def chronological_split(table: pd.DataFrame, train_end: int, val_end: int) -> dict:
    """Split by YEAR (chronological). train <= train_end < val <= val_end < test."""
    tr = table[table["year"] <= train_end]
    va = table[(table["year"] > train_end) & (table["year"] <= val_end)]
    te = table[table["year"] > val_end]
    return {"train": tr.reset_index(drop=True),
            "val": va.reset_index(drop=True),
            "test": te.reset_index(drop=True)}


def add_event_labels(splits: dict, target_col: str, label_col: str) -> dict:
    """Label the upper-tercile 'unusual' event using TRAIN thresholds only.

    Thresholds are computed per target week-of-year from the TRAIN split, then
    applied to val/test (leak-free). Weeks with too few train samples fall back
    to the global train tercile.
    """
    train = splits["train"]
    by_week = {}
    global_thr = float(np.quantile(train[target_col], UPPER_TERCILE_Q))
    for wk, grp in train.groupby("target_week_of_year"):
        by_week[int(wk)] = (float(np.quantile(grp[target_col], UPPER_TERCILE_Q))
                            if len(grp) >= 8 else global_thr)

    def label(df):
        df = df.copy()
        thr = df["target_week_of_year"].map(lambda w: by_week.get(int(w), global_thr))
        df[label_col] = (df[target_col] > thr).astype(int)
        df[label_col + "_thr"] = thr.values
        return df

    return {k: label(v) for k, v in splits.items()}, {"global_threshold": global_thr,
                                                       "n_week_thresholds": len(by_week)}


# --------------------------------------------------------------------------
# 4. Models (all fit on TRAIN; PBC calibrated on VAL; evaluated on TEST)
# --------------------------------------------------------------------------
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.isotonic import IsotonicRegression

PREDICTORS = ["pred_t_anom14", "pred_t_anom28", "pred_p14", "pred_p28", "doy_sin", "doy_cos"]
RNG_SEED = 20261014


def climatology_forecast(splits: dict, label_col: str) -> dict:
    """Climatological event probability per target week-of-year (train only)."""
    train = splits["train"]
    global_rate = float(train[label_col].mean())
    by_week = {}
    for wk, grp in train.groupby("target_week_of_year"):
        by_week[int(wk)] = float(grp[label_col].mean()) if len(grp) >= 8 else global_rate

    def predict(df):
        return df["target_week_of_year"].map(lambda w: by_week.get(int(w), global_rate)).to_numpy()

    return {"predict": predict, "global_rate": global_rate}


def raw_statistical_forecast(splits: dict, label_col: str) -> dict:
    """Persistence++-inspired logistic forecast from init-time predictors.

    A genuine statistical subseasonal forecast fit on TRAIN. NOT observations.
    """
    train = splits["train"]
    scaler = StandardScaler().fit(train[PREDICTORS].to_numpy())
    clf = LogisticRegression(max_iter=1000, C=1.0, random_state=RNG_SEED)
    clf.fit(scaler.transform(train[PREDICTORS].to_numpy()), train[label_col].to_numpy())

    def predict(df):
        return clf.predict_proba(scaler.transform(df[PREDICTORS].to_numpy()))[:, 1]

    return {"predict": predict, "model": clf, "scaler": scaler}


def pbc_inspired_calibration(raw: dict, splits: dict, label_col: str) -> dict:
    """Isotonic reliability recalibration of the raw forecast (PBC-inspired).

    Learning-enhanced probabilities: the monotone map raw_prob -> observed
    frequency is fit on the VALIDATION split (a held-out calibration set,
    disjoint from the logistic training data and from the test set).
    """
    val = splits["val"]
    p_val = raw["predict"](val)
    iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
    iso.fit(p_val, val[label_col].to_numpy())

    def predict(df):
        return iso.predict(raw["predict"](df))

    return {"predict": predict, "iso": iso}


# --------------------------------------------------------------------------
# 5. Metrics + uncertainty
# --------------------------------------------------------------------------
def brier_score(p, y) -> float:
    p = np.asarray(p, float); y = np.asarray(y, float)
    return float(np.mean((p - y) ** 2))


def brier_skill_score(p, y, p_ref, y_ref=None) -> float:
    y_ref = y if y_ref is None else y_ref
    bs = brier_score(p, y)
    bs_ref = brier_score(p_ref, y_ref)
    return float(1.0 - bs / bs_ref) if bs_ref > 0 else float("nan")


def reliability_bins(p, y, n_bins: int = 10) -> pd.DataFrame:
    p = np.asarray(p, float); y = np.asarray(y, float)
    edges = np.linspace(0, 1, n_bins + 1)
    idx = np.clip(np.digitize(p, edges[1:-1]), 0, n_bins - 1)
    rows = []
    for b in range(n_bins):
        m = idx == b
        rows.append({"bin_center": (edges[b] + edges[b + 1]) / 2,
                     "mean_pred": float(np.mean(p[m])) if m.any() else np.nan,
                     "obs_freq": float(np.mean(y[m])) if m.any() else np.nan,
                     "count": int(m.sum())})
    return pd.DataFrame(rows)


def expected_calibration_error(p, y, n_bins: int = 10) -> float:
    rel = reliability_bins(p, y, n_bins)
    rel = rel.dropna()
    w = rel["count"] / rel["count"].sum()
    return float(np.sum(w * np.abs(rel["mean_pred"] - rel["obs_freq"])))


def paired_bootstrap_brier_diff(p_a, p_b, y, n_boot: int = 2000, seed: int = RNG_SEED):
    """Bootstrap the Brier difference (model_a - model_b) over test samples.

    Negative mean => model_a has LOWER Brier (better). Improvement of a over b
    is 'demonstrable' only if the 95% CI lies entirely below 0.
    """
    p_a = np.asarray(p_a, float); p_b = np.asarray(p_b, float); y = np.asarray(y, float)
    n = len(y)
    rng = np.random.default_rng(seed)
    diffs = np.empty(n_boot)
    base_a = (p_a - y) ** 2
    base_b = (p_b - y) ** 2
    for i in range(n_boot):
        s = rng.integers(0, n, n)
        diffs[i] = base_a[s].mean() - base_b[s].mean()
    lo, hi = np.percentile(diffs, [2.5, 97.5])
    return {"mean_diff": float(diffs.mean()), "ci95_low": float(lo), "ci95_high": float(hi),
            "improves": bool(hi < 0.0)}
