"""Castelnaudary Soil Intelligence case study: assemble REAL inputs and run the
exploratory vulnerability index + the quantitative RUSLE model with documented,
literature-derived parameters and scenario/sensitivity analysis.

All inputs are the actual datasets downloaded in `data/geo/`:
  - Copernicus DEM slope, SoilGrids 2.0 texture/SOC/pH, Sentinel-2 NDVI,
    ERA5 2015-2024 rainfall exposure, IGN RPG 2024 declared crop.
Missing/uncertain inputs are handled with explicitly recorded assumptions and
ranges (never silently zeroed).
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from . import rusle, vulnerability
from .schemas import ExposureInputs, SoilTextureCarbon, Provenance, DataKind

ROOT = Path(__file__).resolve().parents[2]
GEO = ROOT / "data" / "geo"

STUDY_AREA = {
    "name": "Castelnaudary / Lauragais (Aude, FR)",
    "field": "Parcelle du Moulin (Lauragais) — demo field",
    "lat": 43.31, "lon": 1.95,
    "bbox_4326": [1.93, 43.29, 1.97, 43.33],
    "coverage": "single_study_area",  # NOT nationwide
}

# ---- Documented parameter registry (values, ranges, provenance) ----
PARAM_REGISTRY = {
    "R": {"baseline": 1000.0, "range": [700.0, 1800.0], "unit": "MJ mm ha-1 h-1 yr-1",
          "source": "Panagos et al. 2015, Rainfall erosivity in Europe (STOTEN 511:801-814)",
          "assumption": "Literature-derived estimate for SW France / Aude; ESDAC R raster "
                        "requires login (not accessed). Scenario range stated explicitly. "
                        "NOT derived from raw ERA5 rainfall totals."},
    "K": {"method": "Williams (1995) EPIC from SoilGrids sand/silt/clay/OC x0.1317 -> SI",
          "range_driver": "organic carbon 1.37-4.09 % (SoilGrids 0-5 / 5-15 cm)",
          "unit": "t ha h ha-1 MJ-1 mm-1",
          "assumption": "Texture normalised to 100%; plough-layer OC depth-weighted (0-15 cm). "
                        "Structure/permeability not required by the Williams estimator."},
    "LS": {"method": "McCool 1987 (S) + RUSLE L with slope-dependent m",
           "slope_length_m_baseline": 100.0, "slope_length_range_m": [50.0, 150.0],
           "source": "Copernicus DEM GLO-30 slope",
           "assumption": "Representative slope length 100 m (field-scale); varied 50-150 m."},
    "C": {"baseline": 0.20, "range": [0.10, 0.45], "improved": 0.07, "improved_range": [0.03, 0.12],
          "source": "Panagos et al. 2015, C-factor at European scale (Land Use Policy 48:38-50)",
          "assumption": "Conventional arable legume/cereal baseline; improved = cover crops + "
                        "reduced tillage."},
    "P": {"baseline": 1.0, "range": [0.6, 1.0],
          "assumption": "P=1 when no support practice declared; contour/strip practices lower P."},
}

SOURCES = [
    {"name": "Copernicus DEM GLO-30", "use": "slope / LS", "licence": "Copernicus free"},
    {"name": "ISRIC SoilGrids 2.0", "use": "texture/SOC/pH -> K", "licence": "CC-BY 4.0"},
    {"name": "Copernicus Sentinel-2 L2A", "use": "NDVI vegetation cover", "licence": "Copernicus free"},
    {"name": "ERA5 (Open-Meteo archive)", "use": "rainfall exposure series", "licence": "CC-BY 4.0"},
    {"name": "IGN RPG 2024", "use": "declared crop / parcel", "licence": "Etalab/IGN"},
    {"name": "Panagos et al. 2015 (R & C factors)", "use": "RUSLE parameters", "licence": "literature"},
    {"name": "Williams 1995 EPIC; McCool 1987", "use": "K & LS methods", "licence": "literature"},
]


# --------------------------------------------------------------------------
def _slope_stats_from_dem() -> dict:
    import rasterio
    f = GEO / "samples" / "copernicus_dem_castelnaudary.tif"
    with rasterio.open(f) as s:
        a = s.read(1).astype("float64")
        lat = (STUDY_AREA["bbox_4326"][1] + STUDY_AREA["bbox_4326"][3]) / 2
        px = s.res[0] * 111320 * np.cos(np.radians(lat)); py = s.res[1] * 111320
        gy, gx = np.gradient(a, py, px)
        slope = np.degrees(np.arctan(np.sqrt(gx ** 2 + gy ** 2)))
    return {"mean_deg": round(float(slope.mean()), 2),
            "p90_deg": round(float(np.percentile(slope, 90)), 2),
            "max_deg": round(float(slope.max()), 2)}


def _load_soil() -> dict:
    d = json.loads((GEO / "soilgrids_extra_summary.json").read_text())
    import rasterio
    with rasterio.open(GEO / "samples" / "soilgrids_clay_0-5cm_castelnaudary.tif") as s:
        a = s.read(1).astype("float64"); v = a[a > 0]
        clay = float(v.mean()) / 10.0
    sand = d["sand_0-5cm_mean"]["mean_physical"]
    silt = d["silt_0-5cm_mean"]["mean_physical"]
    oc_0_5 = d["soc_0-5cm_mean"]["mean_physical"] / 10.0   # g/kg -> %
    oc_5_15 = d["soc_5-15cm_mean"]["mean_physical"] / 10.0
    ph = d["phh2o_0-5cm_mean"]["mean_physical"]
    oc_plough = (5 * oc_0_5 + 10 * oc_5_15) / 15.0          # 0-15 cm depth-weighted
    tot = sand + silt + clay
    return {"clay_pct": round(clay, 1), "sand_pct": round(sand, 1), "silt_pct": round(silt, 1),
            "sand_n": round(100 * sand / tot, 1), "silt_n": round(100 * silt / tot, 1),
            "clay_n": round(100 * clay / tot, 1),
            "oc_0_5_pct": round(oc_0_5, 2), "oc_5_15_pct": round(oc_5_15, 2),
            "oc_plough_pct": round(oc_plough, 2), "ph_h2o": round(ph, 2),
            "texture_sum_pct": round(tot, 1)}


def _load_ndvi() -> dict:
    return json.loads((GEO / "ndvi_summary.json").read_text())


def _rainfall_exposure() -> dict:
    df = pd.read_csv(GEO / "samples" / "era5_history_castelnaudary_2015_2024.csv", parse_dates=["date"])
    years = df["date"].dt.year.nunique()
    return {"years": int(years),
            "annual_precip_mm_mean": round(df["precip_mm"].sum() / years, 0),
            "heavy_rain_days_gt20mm_per_year": round(int((df["precip_mm"] > 20).sum()) / years, 1),
            "max_daily_precip_mm": round(float(df["precip_mm"].max()), 1)}


def build_inputs() -> dict:
    slope = _slope_stats_from_dem()
    soil = _load_soil()
    ndvi = _load_ndvi()
    rain = _rainfall_exposure()
    assumptions = []
    if soil["texture_sum_pct"] != 100:
        assumptions.append(f"SoilGrids sand/silt/clay summed to {soil['texture_sum_pct']}%; "
                           "normalised to 100% for texture.")
    assumptions.append("Plough-layer OC = depth-weighted 0-15 cm (0-5 & 5-15 cm SoilGrids).")
    assumptions.append("Slope length not measured; 100 m assumed (varied 50-150 m).")
    assumptions.append("R-factor literature-derived (Panagos 2015); scenario range used.")
    return {"slope": slope, "soil": soil, "ndvi": ndvi, "rainfall": rain,
            "assumptions": assumptions}


def run_case_study() -> dict:
    inp = build_inputs()
    soil, slope, ndvi, rain = inp["soil"], inp["slope"], inp["ndvi"], inp["rainfall"]

    # ---- (1) exploratory vulnerability index on REAL inputs ----
    exposure = ExposureInputs(
        slope_degrees_mean=slope["mean_deg"], slope_degrees_max=slope["max_deg"],
        annual_precip_mm_mean=rain["annual_precip_mm_mean"],
        heavy_rain_days_gt20mm_per_year=rain["heavy_rain_days_gt20mm_per_year"],
        max_daily_precip_mm=rain["max_daily_precip_mm"],
        vegetation_cover_fraction=ndvi["vegetation_cover_fraction_mean"],
        crop_category="declared arable (RPG 2024)")
    soil_model = SoilTextureCarbon(
        depth_cm="0-5", clay_pct=soil["clay_pct"], sand_pct=soil["sand_pct"],
        silt_pct=soil["silt_pct"], soil_organic_carbon_g_per_kg=soil["oc_0_5_pct"] * 10,
        ph_h2o=soil["ph_h2o"],
        provenance=Provenance(source="ISRIC SoilGrids 2.0", data_kind=DataKind.modelled,
                              vintage="2020", crs="EPSG:4326", resolution="250 m",
                              licence="CC-BY 4.0", uncertainty="250 m modelled; confirm with soil test"))
    vuln = vulnerability.exploratory_vulnerability(exposure, soil_model)

    # ---- (2) RUSLE quantitative model ----
    K = rusle.williams_k_si(soil["sand_n"], soil["silt_n"], soil["clay_n"], soil["oc_plough_pct"])
    LS = rusle.ls_factor(slope["mean_deg"], PARAM_REGISTRY["LS"]["slope_length_m_baseline"])
    R0 = PARAM_REGISTRY["R"]["baseline"]; C0 = PARAM_REGISTRY["C"]["baseline"]; P0 = PARAM_REGISTRY["P"]["baseline"]
    baseline = {"R": R0, "K": K, "LS": LS, "C": C0, "P": P0}
    baseline_result = rusle.compute_soil_loss(**baseline)

    # ---- (3) scenarios ----
    scenarios = {
        "wetter_climate": {"R": round(R0 * 1.3, 0), "K": K, "LS": LS, "C": C0, "P": P0},
        "improved_cover_management": {"R": R0, "K": K, "LS": LS,
                                      "C": PARAM_REGISTRY["C"]["improved"], "P": 0.9},
    }
    scenario_rows = rusle.scenario_table(baseline, scenarios)

    # ---- sensitivity + uncertainty ----
    LS_lo = rusle.ls_factor(slope["mean_deg"], PARAM_REGISTRY["LS"]["slope_length_range_m"][0])
    LS_hi = rusle.ls_factor(slope["p90_deg"], PARAM_REGISTRY["LS"]["slope_length_range_m"][1])
    K_lo = rusle.williams_k_si(soil["sand_n"], soil["silt_n"], soil["clay_n"], soil["oc_0_5_pct"])  # higher OC -> lower K
    K_hi = rusle.williams_k_si(soil["sand_n"], soil["silt_n"], soil["clay_n"], soil["oc_5_15_pct"])
    ranges = {
        "R": tuple(PARAM_REGISTRY["R"]["range"]),
        "K": (min(K_lo, K_hi), max(K_lo, K_hi)),
        "LS": (min(LS_lo, LS_hi), max(LS_lo, LS_hi)),
        "C": tuple(PARAM_REGISTRY["C"]["range"]),
        "P": tuple(PARAM_REGISTRY["P"]["range"]),
    }
    tornado = rusle.tornado_sensitivity(baseline, ranges)
    unc = rusle.uncertainty_range(ranges)

    return {
        "model_version": rusle.MODEL_VERSION, "equation": rusle.EQUATION,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "study_area": STUDY_AREA,
        "inputs": inp,
        "vulnerability_index": vuln,
        "rusle_baseline": baseline_result,
        "scenarios": scenario_rows,
        "sensitivity_tornado": tornado,
        "uncertainty_range": unc,
        "parameters": PARAM_REGISTRY,
        "sources": SOURCES,
        "assumptions": inp["assumptions"],
        "disclaimer": ("Model-estimated erosion potential under stated assumptions; "
                       "not a field measurement. Coverage: single study area (Castelnaudary), "
                       "not nationwide."),
    }
