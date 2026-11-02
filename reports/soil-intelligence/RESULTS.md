# Soil Intelligence — Castelnaudary case study (executed)
_Generated 2026-11-01T06:20:11.701111+00:00 • model rusle-1.0.0 • A = R * K * LS * C * P  [t/ha/yr]_
## Methodology (provenance, once)
Inputs are REAL datasets for the study area: Copernicus DEM GLO-30 (slope), ISRIC SoilGrids 2.0 (texture/SOC/pH), Copernicus Sentinel-2 L2A (NDVI cover), ERA5 2015–2024 (rainfall exposure), IGN RPG 2024 (declared crop). RUSLE parameters are literature-derived (Panagos et al. 2015 for R and C; Williams 1995 EPIC for K; McCool 1987 for LS) with explicit assumptions and ranges. Outputs are **model-estimated** erosion potential, not field measurements. Coverage: single study area (not nationwide).
## Real inputs
- Soil (SoilGrids): clay 31.1%, sand 26.3%, silt 42.6%, plough-layer OC 2.27%, pH 7.43 (calcareous).
- Terrain (DEM): slope mean 2.72°, p90 6.06°, max 23.41°.
- Vegetation (Sentinel-2 2025-09-03, cloud 0.000304%): NDVI mean 0.733, cover fraction 0.728.
- Rainfall exposure (ERA5): 909.0 mm/yr, 5.6 days>20 mm/yr, max 60.9 mm/day.
## Computed results
- **Exploratory soil-vulnerability index: 40.5/100 (modéré).**
- **RUSLE model-estimated erosion potential (baseline): 6.68 t ha⁻¹ yr⁻¹** (R=1000.0, K=0.0341, LS=0.9797, C=0.2, P=1.0).
- Wetter-climate scenario: 8.69 t/ha/yr (+30.1% vs baseline).
- Improved cover & management: 2.1 t/ha/yr (-68.6% vs baseline).
- Plausible parameter-uncertainty band: 1.06–106.67 t/ha/yr.
- Sensitivity (largest swing first): LS (18.73), C (11.69), R (7.35), P (2.67), K (0.77).
## Interpretation
The study field shows **moderate** estimated erosion potential (~6.68 t/ha/yr), consistent with a clay-rich calcareous soil on gentle Lauragais slopes. The dominant levers are terrain (LS) and cover-management (C): adopting cover crops + reduced tillage is estimated to cut erosion potential by ~69%, while a wetter climate raises it by ~30%.
## Limitations
- Plough-layer OC = depth-weighted 0-15 cm (0-5 & 5-15 cm SoilGrids).
- Slope length not measured; 100 m assumed (varied 50-150 m).
- R-factor literature-derived (Panagos 2015); scenario range used.
- R-factor is a literature estimate (ESDAC raster needs login); LS uses an assumed slope length; SoilGrids is 250 m modelled. Confirm with a soil test and local R before operational use.
