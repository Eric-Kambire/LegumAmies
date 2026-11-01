# Légume'Ami — Geospatial Data-Source Registry

Machine-readable version: `data/geo/manifest.json` (per-source URL, access
result, CRS, resolution, vintage, units, licence, attribution, size, SHA-256).
Reproducible downloads: `experiments/geo/download_geo_samples.py`. Validated
samples: `data/geo/samples/` (checksums in `data/geo/SHA256SUMS.txt`).

**Example region (only subset downloaded):** Castelnaudary / Lauragais, Aude
(≈ 43.31 N, 1.95 E), the active demo field "Parcelle du Moulin (Lauragais)".

> **Two confusions we explicitly avoid**
> - **RPG ≠ ownership.** The RPG is *declared agricultural parcels/crops* for
>   CAP subsidies. Property ownership is the **cadastre**
>   (`CADASTRALPARCELS.*`), a different IGN layer. We use RPG for crop/boundary
>   context only.
> - **Soil ≠ geology.** SoilGrids and GIS Sol RRP are **pedological** (soil
>   texture/carbon/soil units). **BRGM** serves **geology** (bedrock), which is
>   not soil property data. We do not substitute one for the other.

| # | Source | Access | Service / URL | CRS | Res | Vintage | Units | Licence |
|---|---|---|---|---|---|---|---|---|
| 1 | **IGN RPG** declared parcels | ✅ downloaded | WFS `data.geopf.fr` `IGNF_RPG_PARCELLES-AGRICOLES-CATEGORISEES_2024` | EPSG:4326 | vector | **2024** | crop code/category | Etalab/IGN |
| 2 | **IGN ADMIN EXPRESS** communes | ✅ downloaded | WFS `ADMINEXPRESS-COG.LATEST:commune` | EPSG:4326 | vector | LATEST | admin boundary | Etalab/IGN |
| 3 | **GIS Sol RRP** dominant soil | ⚠️ path works, **AOI not covered** | WFS `..._rrp_gironde` (Gironde/Landes/Loiret only) | EPSG:4326 | UCS polygons | per-dept | dominant soil name/% | Etalab (per pub.) |
| 4 | **ISRIC SoilGrids** WMS | ✅ downloaded | `maps.isric.org/mapserv?map=/map/clay.map` (WMS) | EPSG:4326 (native IGH) | 250 m | 2020 | styled raster | CC-BY 4.0 |
| 5 | **ISRIC SoilGrids** WCS | ✅ downloaded | same, WCS GetCoverage | EPSG:4326 | 250 m | 2020 | clay g/kg (×0.1=%) | CC-BY 4.0 |
| 6 | **Copernicus DEM** GLO-30 | ✅ downloaded (windowed) | AWS `copernicus-dem-30m` COG via `/vsicurl` | EPSG:4326 | ~30 m | 2021 | elevation m | Copernicus free |
| 7 | **Sentinel-2 L2A** | 🛰️ live service | STAC `earth-search.aws.element84.com/v1` + AWS COGs | UTM (EPSG:326xx) | 10 m | rolling | reflectance→NDVI | Copernicus free |
| 8 | **ERA5 history** | ✅ downloaded | `archive-api.open-meteo.com/v1/archive?models=era5` | point | ~9–31 km | 2015–2024 | °C, mm | ERA5/Open-Meteo CC-BY |
| 9 | **ESDAC RUSLE2015** | 🔒 not obtained (login) | `esdac.jrc.ec.europa.eu` | EPSG:3035 | 100–500 m | RUSLE2015 | R/K/C/LS/A | ESDAC policy |
| 10 | **Météo-France AROME WMS** | 🔒 not obtained (key) | `portail-api.meteofrance.fr` | 3857/4326 | 1.3–2.5 km | rolling | t2m/wind/precip/cloud | MF open data (reg.) |

## Access results in prose

**Downloaded (real subsets, validated, checksummed):** IGN RPG 2024 parcels
(100 features, declared crops incl. `code_cultu`), ADMIN EXPRESS communes,
SoilGrids clay 0–5 cm (WMS PNG + WCS numeric GeoTIFF, mean ≈ 218 g/kg ≈ 21.8 %
clay, 0 missing), Copernicus DEM window (144×144, 150–220 m elevation, slope
mean 2.7°/max 23°), ERA5 2015–2024 daily (3653 rows, 0 missing; 56 days > 20 mm,
max 60.9 mm/day, ≈ 909 mm/yr).

**Live map service (not bulk-downloaded):** Sentinel-2 L2A via STAC returned
low-cloud May-2025 scenes with B04/B08 assets → NDVI vegetation history is
feasible via windowed COG reads. GIS Sol RRP WFS returns real pedological units
**but only for published departments (Gironde/Landes/Loiret)** — the Aude AOI is
**not** on the open WFS.

**Not obtained — registration/login required (NOT bypassed):**
- **ESDAC / JRC RUSLE2015** R/K/C/LS/soil-loss rasters — free ESDAC account +
  terms acceptance required. This is the reference erosion product for future
  calibration once access is granted.
- **GIS Sol RRP for Aude** — not published on the open WFS; needs DoneSol/GIS Sol
  access.
- **Météo-France AROME spatial WMS** — Météo-France API portal key required.

## RPG vintage note
RPG **2025** exists on the Géoplateforme only as *bio / IAE / zones de densité
homogène* layers; the full **categorised crop parcels** latest published is
**2024**. We therefore use RPG 2024 and flag 2025 crop parcels as not yet
available.
