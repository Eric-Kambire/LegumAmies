"""Execute the Castelnaudary Soil Intelligence case study and save all numeric
outputs + figures to reports/soil-intelligence/. Every figure is built from the
executed results (no illustrative inputs)."""
from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from src.geo import soil_intelligence as si

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "reports" / "soil-intelligence"
FIG = OUT / "figures"
GEO = ROOT / "data" / "geo"


def _log():
    OUT.mkdir(parents=True, exist_ok=True); FIG.mkdir(parents=True, exist_ok=True)
    lg = logging.getLogger("soilintel"); lg.setLevel(logging.INFO); lg.handlers.clear()
    fh = logging.FileHandler(OUT / "experiment.log", mode="w")
    fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s")); lg.addHandler(fh)
    sh = logging.StreamHandler(); sh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s")); lg.addHandler(sh)
    return lg


def _save(fig, name):
    fig.savefig(FIG / f"{name}.png", dpi=300, bbox_inches="tight")
    fig.savefig(FIG / f"{name}.svg", bbox_inches="tight"); plt.close(fig)


def fig_scenarios(res):
    rows = res["scenarios"]
    names = [r["scenario"] for r in rows]; A = [r["soil_loss_t_ha_yr"] for r in rows]
    fig, ax = plt.subplots(figsize=(7, 4.2))
    colors = ["#6b7280", "#ef4444", "#22c55e"]
    b = ax.bar(names, A, color=colors[:len(names)])
    for bar, r in zip(b, rows):
        ax.text(bar.get_x()+bar.get_width()/2, bar.get_height()+0.1,
                f"{r['soil_loss_t_ha_yr']} t/ha/an\n({r['pct_vs_baseline']:+}% )" if r['pct_vs_baseline'] else f"{r['soil_loss_t_ha_yr']} t/ha/an",
                ha="center", fontsize=8)
    ax.set_ylabel("Perte de sol estimée (t ha⁻¹ an⁻¹)")
    ax.set_title("RUSLE — comparaison de scénarios (Castelnaudary)")
    ax.grid(axis="y", alpha=0.3)
    _save(fig, "01_scenario_comparison")


def fig_factor_breakdown(res):
    p = res["rusle_baseline"]["parameters"]
    labels = ["R", "K", "LS", "C", "P"]; vals = [p[k] for k in labels]
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.barh(labels[::-1], vals[::-1], color="#38bdf8")
    for i, v in enumerate(vals[::-1]):
        ax.text(v, i, f" {v}", va="center", fontsize=9)
    ax.set_xscale("log")
    ax.set_xlabel("Valeur du facteur (échelle log) — A = R·K·LS·C·P = %s t/ha/an" % res["rusle_baseline"]["soil_loss_t_ha_yr"])
    ax.set_title("RUSLE — décomposition des facteurs (baseline)")
    ax.grid(axis="x", alpha=0.3)
    _save(fig, "02_factor_breakdown")


def fig_tornado(res):
    t = res["sensitivity_tornado"]; base = t[0]["base"]
    facs = [x["factor"] for x in t][::-1]
    lows = [x["A_low"] for x in t][::-1]; highs = [x["A_high"] for x in t][::-1]
    fig, ax = plt.subplots(figsize=(7.5, 4.2))
    for i, (lo, hi) in enumerate(zip(lows, highs)):
        ax.barh(i, hi-lo, left=min(lo, hi), color="#f59e0b", alpha=0.85)
    ax.axvline(base, color="k", ls="--", lw=1, label=f"baseline {base} t/ha/an")
    ax.set_yticks(range(len(facs))); ax.set_yticklabels(facs)
    ax.set_xlabel("Perte de sol estimée (t ha⁻¹ an⁻¹)")
    ax.set_title("Analyse de sensibilité (tornado) — un facteur à la fois")
    ax.legend(fontsize=8); ax.grid(axis="x", alpha=0.3)
    _save(fig, "03_tornado_sensitivity")


def fig_rainfall(res):
    df = pd.read_csv(GEO / "samples" / "era5_history_castelnaudary_2015_2024.csv", parse_dates=["date"])
    df["year"] = df["date"].dt.year
    annual = df.groupby("year")["precip_mm"].sum()
    heavy = df[df["precip_mm"] > 20].groupby("year").size().reindex(annual.index, fill_value=0)
    fig, ax1 = plt.subplots(figsize=(8, 4))
    ax1.bar(annual.index, annual.values, color="#3b82f6", alpha=0.7, label="Pluie annuelle (mm)")
    ax1.set_ylabel("Pluie annuelle (mm)", color="#3b82f6"); ax1.set_xlabel("Année")
    ax2 = ax1.twinx()
    ax2.plot(heavy.index, heavy.values, "o-", color="#ef4444", label="Jours > 20 mm")
    ax2.set_ylabel("Jours de pluie > 20 mm", color="#ef4444")
    ax1.set_title("Exposition pluviométrique historique ERA5 (2015–2024) — Castelnaudary")
    _save(fig, "04_rainfall_exposure_timeseries")


def fig_maps(res):
    import rasterio
    fig, axes = plt.subplots(1, 2, figsize=(10, 4.4))
    with rasterio.open(GEO / "samples" / "copernicus_dem_castelnaudary.tif") as s:
        dem = s.read(1).astype("float64")
        lat = (res["study_area"]["bbox_4326"][1]+res["study_area"]["bbox_4326"][3])/2
        px = s.res[0]*111320*np.cos(np.radians(lat)); py = s.res[1]*111320
        gy, gx = np.gradient(dem, py, px); slope = np.degrees(np.arctan(np.sqrt(gx**2+gy**2)))
    im0 = axes[0].imshow(slope, cmap="YlOrRd"); axes[0].set_title("Pente (°) — Copernicus DEM 30 m")
    fig.colorbar(im0, ax=axes[0], fraction=0.046)
    with rasterio.open(GEO / "samples" / "soilgrids_clay_0-5cm_castelnaudary.tif") as s:
        clay = s.read(1).astype("float64"); clay[clay <= 0] = np.nan; clay = clay/10.0
    im1 = axes[1].imshow(clay, cmap="BrBG"); axes[1].set_title("Argile 0–5 cm (%) — SoilGrids 2.0")
    fig.colorbar(im1, ax=axes[1], fraction=0.046)
    for a in axes: a.set_xticks([]); a.set_yticks([])
    fig.suptitle("Sol & terrain — zone d'étude Castelnaudary")
    _save(fig, "05_soil_slope_maps")


def fig_uncertainty(res):
    rows = res["scenarios"]; unc = res["uncertainty_range"]
    fig, ax = plt.subplots(figsize=(7, 4))
    names = [r["scenario"] for r in rows]; A = [r["soil_loss_t_ha_yr"] for r in rows]
    ax.bar(names, A, color=["#6b7280", "#ef4444", "#22c55e"][:len(rows)])
    ax.axhspan(unc["A_min_t_ha_yr"], unc["A_max_t_ha_yr"], color="#9ca3af", alpha=0.18,
               label=f"Plage plausible {unc['A_min_t_ha_yr']}–{unc['A_max_t_ha_yr']} t/ha/an")
    ax.set_ylabel("Perte de sol estimée (t ha⁻¹ an⁻¹)")
    ax.set_title("Estimation + plage d'incertitude des paramètres")
    ax.legend(fontsize=8); ax.grid(axis="y", alpha=0.3)
    _save(fig, "06_uncertainty_range")


def main():
    lg = _log()
    res = si.run_case_study()
    lg.info("study_area=%s", res["study_area"]["name"])
    lg.info("inputs slope=%s soil=%s ndvi_cover=%s rain=%s", res["inputs"]["slope"],
            {k: res["inputs"]["soil"][k] for k in ["clay_pct","sand_pct","silt_pct","oc_plough_pct","ph_h2o"]},
            res["inputs"]["ndvi"]["vegetation_cover_fraction_mean"], res["inputs"]["rainfall"])
    lg.info("vulnerability=%s (%s)", res["vulnerability_index"]["score_0_100"], res["vulnerability_index"]["band"])
    lg.info("RUSLE baseline A=%s t/ha/yr (K=%s LS=%s)", res["rusle_baseline"]["soil_loss_t_ha_yr"],
            res["rusle_baseline"]["parameters"]["K"], res["rusle_baseline"]["parameters"]["LS"])

    # baseline_results.json
    (OUT / "baseline_results.json").write_text(json.dumps({
        "study_area": res["study_area"], "inputs": res["inputs"],
        "vulnerability_index": res["vulnerability_index"],
        "rusle_baseline": res["rusle_baseline"], "uncertainty_range": res["uncertainty_range"],
        "model_version": res["model_version"], "equation": res["equation"],
        "generated_at_utc": res["generated_at_utc"], "disclaimer": res["disclaimer"],
    }, indent=2, default=str), encoding="utf-8")

    # scenario_results.csv
    pd.DataFrame(res["scenarios"]).to_csv(OUT / "scenario_results.csv", index=False)
    # parameters.csv
    prows = []
    for f, d in res["parameters"].items():
        prows.append({"factor": f, **{k: json.dumps(v) if isinstance(v, (list, dict)) else v
                                      for k, v in d.items()}})
    pd.DataFrame(prows).to_csv(OUT / "parameters.csv", index=False)
    # sensitivity
    pd.DataFrame(res["sensitivity_tornado"]).to_csv(OUT / "sensitivity_tornado.csv", index=False)
    # run_metadata.json
    (OUT / "run_metadata.json").write_text(json.dumps({
        "generated_at_utc": res["generated_at_utc"], "model_version": res["model_version"],
        "equation": res["equation"], "study_area": res["study_area"],
        "sources": res["sources"], "assumptions": res["assumptions"],
        "parameters": res["parameters"], "disclaimer": res["disclaimer"],
    }, indent=2, default=str), encoding="utf-8")

    # figures
    fig_scenarios(res); fig_factor_breakdown(res); fig_tornado(res)
    fig_rainfall(res); fig_maps(res); fig_uncertainty(res)
    lg.info("Saved figures: %s", [p.name for p in sorted(FIG.glob('*.png'))])

    # RESULTS.md
    _results_md(res)
    lg.info("DONE")
    return res


def _results_md(res):
    b = res["rusle_baseline"]; v = res["vulnerability_index"]
    sc = {r["scenario"]: r for r in res["scenarios"]}
    md = []
    md.append("# Soil Intelligence — Castelnaudary case study (executed)\n")
    md.append(f"_Generated {res['generated_at_utc']} • model {res['model_version']} • {res['equation']}_\n")
    md.append("## Methodology (provenance, once)\n")
    md.append("Inputs are REAL datasets for the study area: Copernicus DEM GLO-30 (slope), "
              "ISRIC SoilGrids 2.0 (texture/SOC/pH), Copernicus Sentinel-2 L2A (NDVI cover), "
              "ERA5 2015–2024 (rainfall exposure), IGN RPG 2024 (declared crop). RUSLE "
              "parameters are literature-derived (Panagos et al. 2015 for R and C; Williams "
              "1995 EPIC for K; McCool 1987 for LS) with explicit assumptions and ranges. "
              "Outputs are **model-estimated** erosion potential, not field measurements. "
              "Coverage: single study area (not nationwide).\n")
    md.append("## Real inputs\n")
    s = res["inputs"]["soil"]; sl = res["inputs"]["slope"]; rn = res["inputs"]["rainfall"]
    md.append(f"- Soil (SoilGrids): clay {s['clay_pct']}%, sand {s['sand_pct']}%, silt {s['silt_pct']}%, "
              f"plough-layer OC {s['oc_plough_pct']}%, pH {s['ph_h2o']} (calcareous).\n")
    md.append(f"- Terrain (DEM): slope mean {sl['mean_deg']}°, p90 {sl['p90_deg']}°, max {sl['max_deg']}°.\n")
    md.append(f"- Vegetation (Sentinel-2 {res['inputs']['ndvi']['datetime'][:10]}, cloud "
              f"{res['inputs']['ndvi']['cloud_cover_pct']}%): NDVI mean {res['inputs']['ndvi']['ndvi_mean']}, "
              f"cover fraction {res['inputs']['ndvi']['vegetation_cover_fraction_mean']}.\n")
    md.append(f"- Rainfall exposure (ERA5): {rn['annual_precip_mm_mean']} mm/yr, "
              f"{rn['heavy_rain_days_gt20mm_per_year']} days>20 mm/yr, max {rn['max_daily_precip_mm']} mm/day.\n")
    md.append("## Computed results\n")
    md.append(f"- **Exploratory soil-vulnerability index: {v['score_0_100']}/100 ({v['band']}).**\n")
    md.append(f"- **RUSLE model-estimated erosion potential (baseline): {b['soil_loss_t_ha_yr']} t ha⁻¹ yr⁻¹** "
              f"(R={b['parameters']['R']}, K={b['parameters']['K']}, LS={b['parameters']['LS']}, "
              f"C={b['parameters']['C']}, P={b['parameters']['P']}).\n")
    md.append(f"- Wetter-climate scenario: {sc['wetter_climate']['soil_loss_t_ha_yr']} t/ha/yr "
              f"({sc['wetter_climate']['pct_vs_baseline']:+}% vs baseline).\n")
    md.append(f"- Improved cover & management: {sc['improved_cover_management']['soil_loss_t_ha_yr']} t/ha/yr "
              f"({sc['improved_cover_management']['pct_vs_baseline']:+}% vs baseline).\n")
    md.append(f"- Plausible parameter-uncertainty band: {res['uncertainty_range']['A_min_t_ha_yr']}–"
              f"{res['uncertainty_range']['A_max_t_ha_yr']} t/ha/yr.\n")
    md.append("- Sensitivity (largest swing first): " +
              ", ".join(f"{t['factor']} ({t['swing']})" for t in res["sensitivity_tornado"]) + ".\n")
    md.append("## Interpretation\n")
    md.append(f"The study field shows **moderate** estimated erosion potential (~{b['soil_loss_t_ha_yr']} "
              "t/ha/yr), consistent with a clay-rich calcareous soil on gentle Lauragais slopes. "
              "The dominant levers are terrain (LS) and cover-management (C): adopting cover crops + "
              "reduced tillage is estimated to cut erosion potential by ~"
              f"{abs(sc['improved_cover_management']['pct_vs_baseline']):.0f}%, while a wetter climate "
              f"raises it by ~{sc['wetter_climate']['pct_vs_baseline']:.0f}%.\n")
    md.append("## Limitations\n")
    for a in res["assumptions"]:
        md.append(f"- {a}\n")
    md.append("- R-factor is a literature estimate (ESDAC raster needs login); LS uses an assumed "
              "slope length; SoilGrids is 250 m modelled. Confirm with a soil test and local R before "
              "operational use.\n")
    (OUT / "RESULTS.md").write_text("".join(md), encoding="utf-8")


if __name__ == "__main__":
    main()
