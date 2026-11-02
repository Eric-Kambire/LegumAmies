"""Quantitative RUSLE soil-loss model for Légume'Ami Soil Intelligence.

    A = R · K · LS · C · P      [t ha⁻¹ yr⁻¹]

This produces a MODEL-ESTIMATED long-term annual soil-loss potential under
clearly specified, literature-derived parameter assumptions. It is a legitimate
model output — not a field measurement.

Factors, methods and provenance
-------------------------------
R  (rainfall erosivity, MJ mm ha⁻¹ h⁻¹ yr⁻¹):
     Literature-derived estimate for the area (Panagos et al., 2015, "Rainfall
     erosivity in Europe", Sci. Total Environ. 511:801-814) + explicit scenario
     range. NOT computed from raw daily rainfall totals (ERA5 totals are used
     only as plausibility context / for the historical exposure series).
K  (soil erodibility, t ha h ha⁻¹ MJ⁻¹ mm⁻¹):
     Williams (1995) EPIC estimator from sand/silt/clay/organic-carbon
     (SoilGrids 2.0), converted to SI by ×0.1317.
LS (slope length & steepness, dimensionless):
     S from McCool et al. (1987); L from the RUSLE length relation with the
     slope-dependent exponent m (Foster). Slope from Copernicus DEM GLO-30;
     slope length λ is an explicit assumption (documented, varied in sensitivity).
C  (cover-management, dimensionless):
     Literature values by management (Panagos et al., 2015, "Cover-management
     factor (C) at the European scale", Land Use Policy 48:38-50).
P  (support practice, dimensionless):
     P = 1.0 baseline when no practice is declared (documented); alternatives in
     scenarios.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, asdict

MODEL_VERSION = "rusle-1.0.0"
EQUATION = "A = R * K * LS * C * P  [t/ha/yr]"
K_US_TO_SI = 0.1317


# --------------------------------------------------------------------------
# K factor — Williams (1995) EPIC
# --------------------------------------------------------------------------
def williams_k_si(sand_pct: float, silt_pct: float, clay_pct: float,
                  organic_carbon_pct: float) -> float:
    """Return K in SI units (t ha h ha⁻¹ MJ⁻¹ mm⁻¹) via Williams (1995)."""
    san, sil, cla, oc = sand_pct, silt_pct, clay_pct, max(organic_carbon_pct, 1e-6)
    sn1 = 1.0 - san / 100.0
    f_csand = 0.2 + 0.3 * math.exp(-0.0256 * san * (1.0 - sil / 100.0))
    f_clsi = (sil / max(cla + sil, 1e-6)) ** 0.3
    f_orgc = 1.0 - (0.25 * oc) / (oc + math.exp(3.72 - 2.95 * oc))
    f_hisand = 1.0 - (0.7 * sn1) / (sn1 + math.exp(-5.51 + 22.9 * sn1))
    k_us = f_csand * f_clsi * f_orgc * f_hisand
    return round(k_us * K_US_TO_SI, 4)


# --------------------------------------------------------------------------
# LS factor — McCool (1987) S + RUSLE L
# --------------------------------------------------------------------------
def ls_factor(slope_degrees: float, slope_length_m: float = 100.0) -> float:
    theta = math.radians(max(slope_degrees, 0.0))
    s = math.sin(theta)
    slope_pct = math.tan(theta) * 100.0
    # S factor (McCool et al. 1987)
    S = 10.8 * s + 0.03 if slope_pct < 9.0 else 16.8 * s - 0.50
    # L factor with slope-dependent exponent m (Foster/RUSLE)
    beta = (s / 0.0896) / (3.0 * (s ** 0.8) + 0.56) if s > 0 else 0.0
    m = beta / (1.0 + beta) if beta > 0 else 0.0
    L = (slope_length_m / 22.13) ** m if slope_length_m > 0 else 1.0
    return round(max(L * S, 0.0), 4)


# --------------------------------------------------------------------------
# Full model
# --------------------------------------------------------------------------
@dataclass
class RusleParameters:
    R: float      # MJ mm ha-1 h-1 yr-1
    K: float      # t ha h ha-1 MJ-1 mm-1
    LS: float     # dimensionless
    C: float      # dimensionless
    P: float      # dimensionless

    def soil_loss(self) -> float:
        return self.R * self.K * self.LS * self.C * self.P

    def as_dict(self) -> dict:
        return asdict(self)


def compute_soil_loss(R, K, LS, C, P) -> dict:
    p = RusleParameters(R=R, K=K, LS=LS, C=C, P=P)
    A = p.soil_loss()
    return {
        "model_version": MODEL_VERSION, "equation": EQUATION,
        "parameters": p.as_dict(),
        "soil_loss_t_ha_yr": round(A, 2),
        "units": "t ha-1 yr-1",
        "plausibility_ok": 0.0 <= A < 500.0,  # physical sanity bound
        "factor_contributions": {
            "R": R, "K": K, "LS": LS, "C": C, "P": P,
        },
    }


# --------------------------------------------------------------------------
# Scenario + sensitivity helpers
# --------------------------------------------------------------------------
def scenario_table(baseline: dict, scenarios: dict) -> list[dict]:
    """baseline/scenarios: name -> dict(R,K,LS,C,P). Returns rows vs baseline."""
    base_A = compute_soil_loss(**baseline)["soil_loss_t_ha_yr"]
    rows = [{"scenario": "baseline", **baseline, "soil_loss_t_ha_yr": base_A,
             "delta_vs_baseline_t_ha_yr": 0.0, "pct_vs_baseline": 0.0}]
    for name, params in scenarios.items():
        A = compute_soil_loss(**params)["soil_loss_t_ha_yr"]
        rows.append({"scenario": name, **params, "soil_loss_t_ha_yr": A,
                     "delta_vs_baseline_t_ha_yr": round(A - base_A, 2),
                     "pct_vs_baseline": round(100.0 * (A - base_A) / base_A, 1) if base_A else None})
    return rows


def tornado_sensitivity(baseline: dict, ranges: dict) -> list[dict]:
    """One-at-a-time sensitivity. ranges: factor -> (low, high).
    Returns per-factor low/high soil loss holding others at baseline."""
    base_A = compute_soil_loss(**baseline)["soil_loss_t_ha_yr"]
    out = []
    for factor, (lo, hi) in ranges.items():
        p_lo = dict(baseline); p_lo[factor] = lo
        p_hi = dict(baseline); p_hi[factor] = hi
        A_lo = compute_soil_loss(**p_lo)["soil_loss_t_ha_yr"]
        A_hi = compute_soil_loss(**p_hi)["soil_loss_t_ha_yr"]
        out.append({"factor": factor, "low": lo, "high": hi,
                    "A_low": A_lo, "A_high": A_hi,
                    "swing": round(abs(A_hi - A_lo), 2),
                    "base": base_A})
    out.sort(key=lambda r: r["swing"], reverse=True)
    return out


def uncertainty_range(ranges: dict) -> dict:
    """Min/max product bound of A over the given factor ranges (plausible band)."""
    lo = 1.0; hi = 1.0
    for _f, (a, b) in ranges.items():
        lo *= min(a, b); hi *= max(a, b)
    return {"A_min_t_ha_yr": round(lo, 2), "A_max_t_ha_yr": round(hi, 2)}
