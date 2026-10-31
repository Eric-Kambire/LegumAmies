"""Orchestrates the PBC-inspired experiment and saves all artifacts.

Importable by the notebook (keeps notebook cells readable) and runnable
standalone:  python -m experiments.pbc.run_experiment
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from . import pbc_lib as L

REPO_ROOT = Path(__file__).resolve().parents[2]
OUTDIR = REPO_ROOT / "reports" / "pbc"
FIGDIR = OUTDIR / "figures"

TRAIN_END = 2014
VAL_END = 2018
START_DATE = "1991-01-01"
END_DATE = "2024-12-31"
OUTCOMES = [("warm", "target_t2m_mean_c"), ("wet", "target_precip_mm")]


def _logger() -> logging.Logger:
    OUTDIR.mkdir(parents=True, exist_ok=True)
    FIGDIR.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("pbc")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    fh = logging.FileHandler(OUTDIR / "experiment.log", mode="w")
    fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(fh)
    sh = logging.StreamHandler()
    sh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(sh)
    return logger


def load_or_fetch_era5(log: logging.Logger) -> pd.DataFrame:
    cache = OUTDIR / "era5_bfc_daily.csv"
    if cache.exists():
        log.info("Loading cached ERA5 from %s", cache)
        df = pd.read_csv(cache, parse_dates=["date"])
    else:
        log.info("Fetching ERA5 (Open-Meteo archive, models=era5)")
        df = L.fetch_era5_region(L.BFC_POINTS, START_DATE, END_DATE)
        df.to_csv(cache, index=False)
    return df


def run(log: logging.Logger | None = None) -> dict:
    log = log or _logger()
    daily = load_or_fetch_era5(log)
    log.info("ERA5 daily rows=%d range=%s..%s nan=%d", len(daily),
             daily["date"].min().date(), daily["date"].max().date(),
             int(daily[["t2m_mean_c", "precip_mm"]].isna().sum().sum()))

    ds = L.build_samples(daily)
    log.info("samples=%d init_months=%s", ds.n_total, sorted(set(ds.table["init_date"].dt.month)))

    metrics_rows, pred_rows, results = [], [], {}
    for outcome, target in OUTCOMES:
        splits = L.chronological_split(ds.table, TRAIN_END, VAL_END)
        splits, thr = L.add_event_labels(splits, target, "event")
        n = {k: len(v) for k, v in splits.items()}
        base = {k: float(v["event"].mean()) for k, v in splits.items()}
        log.info("[%s] n=%s base_rate=%s", outcome, n, {k: round(b, 3) for k, b in base.items()})

        clim = L.climatology_forecast(splits, "event")
        raw = L.raw_statistical_forecast(splits, "event")
        pbc = L.pbc_inspired_calibration(raw, splits, "event")

        te = splits["test"]
        y = te["event"].to_numpy()
        preds = {"climatology": clim["predict"](te), "raw_forecast": raw["predict"](te),
                 "pbc_inspired": pbc["predict"](te)}

        for model, p in preds.items():
            bs = L.brier_score(p, y)
            bss = L.brier_skill_score(p, y, preds["climatology"])
            ece = L.expected_calibration_error(p, y)
            metrics_rows.append({"outcome": outcome, "model": model,
                                 "n_train": n["train"], "n_val": n["val"], "n_test": n["test"],
                                 "test_base_rate": round(base["test"], 4),
                                 "brier_score": round(bs, 5),
                                 "brier_skill_score_vs_clim": round(bss, 5),
                                 "expected_calibration_error": round(ece, 5)})

        boot_clim = L.paired_bootstrap_brier_diff(preds["pbc_inspired"], preds["climatology"], y)
        boot_raw = L.paired_bootstrap_brier_diff(preds["pbc_inspired"], preds["raw_forecast"], y)
        log.info("[%s] PBC vs clim diff=%.5f CI[%.5f,%.5f] improves=%s", outcome,
                 boot_clim["mean_diff"], boot_clim["ci95_low"], boot_clim["ci95_high"], boot_clim["improves"])
        log.info("[%s] PBC vs raw  diff=%.5f CI[%.5f,%.5f] improves=%s", outcome,
                 boot_raw["mean_diff"], boot_raw["ci95_low"], boot_raw["ci95_high"], boot_raw["improves"])

        for i in range(len(te)):
            pred_rows.append({"outcome": outcome,
                              "init_date": te["init_date"].iloc[i].date().isoformat(),
                              "valid_start": te["valid_start"].iloc[i].date().isoformat(),
                              "valid_end": te["valid_end"].iloc[i].date().isoformat(),
                              "observed_event": int(y[i]),
                              "p_climatology": round(float(preds["climatology"][i]), 4),
                              "p_raw_forecast": round(float(preds["raw_forecast"][i]), 4),
                              "p_pbc_inspired": round(float(preds["pbc_inspired"][i]), 4)})

        results[outcome] = {"splits": splits, "preds": preds, "y": y, "n": n, "base": base,
                            "boot_pbc_vs_clim": boot_clim, "boot_pbc_vs_raw": boot_raw,
                            "reliability": {m: L.reliability_bins(p, y) for m, p in preds.items()}}

    metrics = pd.DataFrame(metrics_rows)
    predictions = pd.DataFrame(pred_rows)
    metrics.to_csv(OUTDIR / "metrics.csv", index=False)
    predictions.to_csv(OUTDIR / "predictions.csv", index=False)
    log.info("Saved metrics.csv (%d rows) and predictions.csv (%d rows)", len(metrics), len(predictions))

    metadata = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "experiment": "PBC-inspired subseasonal calibration (weeks 3-4), Bourgogne-Franche-Comte",
        "status": "reduced_pbc_inspired_baseline (NOT the original MIT PBC model)",
        "observations": {"dataset": "ERA5 reanalysis", "source": "Open-Meteo archive (models=era5)",
                         "url": L.ARCHIVE_URL, "variables": {"t2m_mean_c": "degC", "precip_mm": "mm"},
                         "points": L.BFC_POINTS, "date_range": [START_DATE, END_DATE]},
        "forecast_inputs": "Statistical (persistence++-inspired) predictors derived from ERA5 at "
                           "initialisation; NO licensed S2S dynamical hindcasts (credentials/compute "
                           "unavailable).",
        "lead": {"weeks": "3-4", "valid_days_after_init": [L.LEAD_START_DAY, L.LEAD_END_DAY]},
        "event_definition": "above upper tercile (per target week-of-year, TRAIN-only thresholds)",
        "splits": {"train_years": f"<= {TRAIN_END}", "val_years": f"{TRAIN_END+1}-{VAL_END}",
                   "test_years": f"> {VAL_END}"},
        "sample_sizes": {o: results[o]["n"] for o, _ in OUTCOMES},
        "reference": {"mit_pbc_repo": "https://github.com/mouatadid/pbc", "license": "MIT",
                      "paper": "Guan et al., Nature 2026, doi:10.1038/s41586-026-11126-x"},
    }
    (OUTDIR / "run_metadata.json").write_text(json.dumps(metadata, indent=2, default=str), encoding="utf-8")
    log.info("Saved run_metadata.json")

    return {"daily": daily, "dataset": ds, "metrics": metrics, "predictions": predictions,
            "results": results, "metadata": metadata}


if __name__ == "__main__":
    run()
