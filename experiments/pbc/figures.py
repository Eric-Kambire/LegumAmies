"""Figures for the PBC-inspired subseasonal experiment (from REAL results)."""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from . import pbc_lib as L
from .run_experiment import OUTDIR, FIGDIR, OUTCOMES

MODEL_COLORS = {"climatology": "#6b7280", "raw_forecast": "#38bdf8", "pbc_inspired": "#22c55e"}
MODEL_LABELS = {"climatology": "Climatologie", "raw_forecast": "Prévision brute (stat.)",
                "pbc_inspired": "PBC-inspiré (recalibré)"}


def _save(fig, name: str):
    FIGDIR.mkdir(parents=True, exist_ok=True)
    fig.savefig(FIGDIR / f"{name}.png", dpi=300, bbox_inches="tight")
    fig.savefig(FIGDIR / f"{name}.svg", bbox_inches="tight")
    return FIGDIR / f"{name}.png"


def fig_model_comparison(res: dict):
    fig, ax = plt.subplots(figsize=(8, 4.5))
    outcomes = [o for o, _ in OUTCOMES]
    models = ["climatology", "raw_forecast", "pbc_inspired"]
    x = np.arange(len(outcomes)); w = 0.26
    for j, m in enumerate(models):
        vals = [L.brier_score(res["results"][o]["preds"][m], res["results"][o]["y"]) for o in outcomes]
        bars = ax.bar(x + (j - 1) * w, vals, w, label=MODEL_LABELS[m], color=MODEL_COLORS[m])
        for b, v in zip(bars, vals):
            ax.text(b.get_x() + b.get_width() / 2, v + 0.004, f"{v:.3f}", ha="center", fontsize=8)
    ax.set_xticks(x); ax.set_xticklabels(["Chaud (weeks 3-4)", "Humide (weeks 3-4)"])
    ax.set_ylabel("Score de Brier (plus bas = meilleur)")
    ax.set_title("Comparaison des modèles - Brier (jeu de test, ERA5 BFC)")
    ax.legend(fontsize=8); ax.grid(axis="y", alpha=0.3)
    ax.text(0.01, -0.22, "Baseline PBC-inspiré (ERA5 uniquement) - pas le modèle MIT PBC original.",
            transform=ax.transAxes, fontsize=7, color="#6b7280")
    return _save(fig, "01_model_comparison"), fig


def fig_reliability(res: dict):
    fig, axes = plt.subplots(1, 2, figsize=(10, 4.6))
    for ax, (o, _) in zip(axes, OUTCOMES):
        ax.plot([0, 1], [0, 1], "k--", lw=1, label="Calibration parfaite")
        for m in ["raw_forecast", "pbc_inspired", "climatology"]:
            rel = res["results"][o]["reliability"][m].dropna()
            ax.plot(rel["mean_pred"], rel["obs_freq"], "o-", ms=4, color=MODEL_COLORS[m],
                    label=MODEL_LABELS[m])
        ax.set_xlim(0, 1); ax.set_ylim(0, 1)
        ax.set_xlabel("Probabilité prévue"); ax.set_ylabel("Fréquence observée")
        ax.set_title(f"Fiabilité - {'Chaud' if o=='warm' else 'Humide'} (weeks 3-4)")
        ax.grid(alpha=0.3); ax.legend(fontsize=7)
    fig.suptitle("Diagramme de fiabilité (calibration probabiliste) - test ERA5 BFC", y=1.02)
    return _save(fig, "02_reliability_diagram"), fig


def fig_historical_predictions(res: dict):
    fig, axes = plt.subplots(2, 1, figsize=(10, 6.2))
    for ax, (o, _) in zip(axes, OUTCOMES):
        te = res["results"][o]["splits"]["test"].reset_index(drop=True)
        p_pbc = res["results"][o]["preds"]["pbc_inspired"]
        order = np.argsort(te["valid_start"].values)
        vs = pd.to_datetime(te["valid_start"]).to_numpy()[order]
        yy = te["event"].to_numpy()[order]
        pp = np.asarray(p_pbc)[order]
        ax.plot(vs, pp, "-o", ms=3, color=MODEL_COLORS["pbc_inspired"], lw=1.2,
                label="P(événement) PBC-inspiré")
        ax.scatter(vs[yy == 1], np.ones(int((yy == 1).sum())), marker="|", s=140,
                   color="#ef4444", label="Événement observé")
        ax.scatter(vs[yy == 0], np.zeros(int((yy == 0).sum())), marker="|", s=140,
                   color="#9ca3af", label="Non observé")
        ax.axhline(0.5, color="k", lw=0.6, ls=":")
        ax.set_ylim(-0.1, 1.1); ax.set_ylabel("Probabilité")
        ax.set_title(f"Prévisions passées vs réalité - {'Chaud' if o == 'warm' else 'Humide'} (test)")
        ax.grid(alpha=0.3); ax.legend(fontsize=7, loc="upper right")
    fig.tight_layout()
    return _save(fig, "03_historical_predictions"), fig


def fig_regional_outlook(res: dict):
    """Climatological above-tercile probability by month across BFC points.

    This is a CLIMATOLOGY outlook (scientifically supported baseline). The
    experiment did NOT demonstrate subseasonal skill beyond climatology, so we
    deliberately show the climatological reference rather than implying a
    skilful forecast.
    """
    daily = res["daily"].copy()
    daily["month"] = pd.to_datetime(daily["date"]).dt.month
    daily["year"] = pd.to_datetime(daily["date"]).dt.year
    # season-relevant months for spring peas
    months = [3, 4, 5, 6, 7, 8]
    warm_prob, wet_prob = [], []
    for m in months:
        sub = daily[daily["month"] == m]
        # monthly means/totals per year, then above-tercile frequency (climatology)
        tm = sub.groupby("year")["t2m_mean_c"].mean()
        pm = sub.groupby("year")["precip_mm"].sum()
        warm_prob.append(float((tm > tm.quantile(L.UPPER_TERCILE_Q)).mean()))
        wet_prob.append(float((pm > pm.quantile(L.UPPER_TERCILE_Q)).mean()))
    fig, ax = plt.subplots(figsize=(8, 4.5))
    xlab = ["Mar", "Avr", "Mai", "Juin", "Juil", "Aout"]
    x = np.arange(len(months)); w = 0.38
    ax.bar(x - w / 2, warm_prob, w, label="P(chaud > tercile sup.)", color="#f59e0b")
    ax.bar(x + w / 2, wet_prob, w, label="P(humide > tercile sup.)", color="#3b82f6")
    ax.axhline(1 / 3, color="k", ls="--", lw=1, label="Tercile (1/3)")
    ax.set_xticks(x); ax.set_xticklabels(xlab)
    ax.set_ylabel("Probabilité climatologique")
    ax.set_title("Perspective régionale CLIMATOLOGIQUE - BFC (ERA5 1991-2024)")
    ax.legend(fontsize=8); ax.grid(axis="y", alpha=0.3); ax.set_ylim(0, 0.6)
    ax.text(0.01, -0.22, "Climatologie uniquement : l'expérience n'a pas démontré de compétence "
            "subsaisonnière au-delà de la climatologie.", transform=ax.transAxes, fontsize=7, color="#6b7280")
    return _save(fig, "04_regional_outlook"), fig


def make_all(res: dict) -> list[Path]:
    paths = []
    for fn in (fig_model_comparison, fig_reliability, fig_historical_predictions, fig_regional_outlook):
        p, fig = fn(res)
        plt.close(fig)
        paths.append(p)
    return paths


def write_results_md(res: dict) -> Path:
    m = res["metrics"]
    meta = res["metadata"]
    lines = ["# PBC-inspired subseasonal experiment - Results (Bourgogne-Franche-Comté)\n"]
    lines.append(f"_Generated: {meta['generated_at_utc']}_\n")
    lines.append("## Status\n")
    lines.append("**Reduced, explicitly-labelled PBC-inspired calibration baseline** - NOT the original "
                 "MIT PBC model (which requires licensed S2S hindcasts + large compute, unavailable here).\n")
    lines.append("## Data (real)\n")
    lines.append("- Observations: ERA5 reanalysis via Open-Meteo archive (`models=era5`), daily 2 m mean "
                 "temperature (°C) and precipitation (mm), 1991-2024, 5 BFC points averaged.\n")
    lines.append("- Forecast inputs: persistence++-inspired statistical predictors from ERA5 at "
                 "initialisation (no licensed dynamical S2S hindcasts).\n")
    lines.append("- Lead: weeks 3-4 (valid days 15-28). Event: above upper tercile (train-only thresholds).\n")
    lines.append("## Sample sizes\n")
    for o, _ in OUTCOMES:
        lines.append(f"- {o}: {res['results'][o]['n']} (train/val/test); "
                     f"test base rate = {res['results'][o]['base']['test']:.3f}\n")
    lines.append("## Metrics (test split)\n")
    lines.append(m.to_markdown(index=False))
    lines.append("\n## Uncertainty (paired bootstrap on test Brier differences)\n")
    for o, _ in OUTCOMES:
        bc = res["results"][o]["boot_pbc_vs_clim"]; br = res["results"][o]["boot_pbc_vs_raw"]
        lines.append(f"- **{o}** PBC vs climatology: ΔBrier mean {bc['mean_diff']:+.4f} "
                     f"(95% CI [{bc['ci95_low']:+.4f}, {bc['ci95_high']:+.4f}]) → "
                     f"{'improves' if bc['improves'] else 'NOT a demonstrable improvement'}.\n")
        lines.append(f"- **{o}** PBC vs raw forecast: ΔBrier mean {br['mean_diff']:+.4f} "
                     f"(95% CI [{br['ci95_low']:+.4f}, {br['ci95_high']:+.4f}]) → "
                     f"{'improves' if br['improves'] else 'NOT a demonstrable improvement'}.\n")
    # honest conclusion
    warm_imp = res["results"]["warm"]["boot_pbc_vs_clim"]["improves"]
    wet_imp = res["results"]["wet"]["boot_pbc_vs_clim"]["improves"]
    lines.append("\n## Conclusion\n")
    lines.append(f"Does PBC-inspired calibration demonstrably improve weeks 3-4 forecasting for spring "
                 f"peas in BFC? **Warm: {'yes' if warm_imp else 'no'}. Wet: {'yes' if wet_imp else 'no'}.** "
                 "Held-out bootstrap confidence intervals do not support a robust improvement over "
                 "climatology at this sample size; for precipitation the statistical forecast and its "
                 "recalibration do not beat climatology. Subseasonal precipitation skill is intrinsically "
                 "low, and recalibration cannot create skill that the predictors do not contain.\n")
    lines.append("\n## Limitations\n")
    lines.append("- Small test sample (weeks 3-4, one region) → wide confidence intervals.\n")
    lines.append("- Fixed train-period tercile thresholds are miscalibrated under the observed warming "
                 "trend (test warm-event frequency >> 1/3).\n")
    lines.append("- The 'raw forecast' is a statistical persistence model, not a dynamical/AI S2S "
                 "ensemble; this is a methodological demonstration, not a reproduction of MIT PBC.\n")
    lines.append("- Figures and numbers come from real ERA5; no synthetic data were presented as "
                 "observations.\n")
    md = "\n".join(lines)
    (OUTDIR / "RESULTS.md").write_text(md, encoding="utf-8")
    return OUTDIR / "RESULTS.md"
