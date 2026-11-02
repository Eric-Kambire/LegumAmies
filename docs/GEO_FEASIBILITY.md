# Légume'Ami — Geospatial & Soil-Risk Feasibility Report

Scope: backend/data foundation only. No React or deployed-AWS changes were made.
Branch `feature/geospatial-soil-foundation` (off `main` `37d2c67`). Example
region: Castelnaudary / Lauragais (Aude). Evidence: `data/geo/manifest.json`,
`data/geo/samples/`, `src/geo/`, `tests/test_geo.py`.

---

## 1. Existing map architecture (reused, not duplicated)

`frontend/src/components/Map/WeatherMap.tsx` uses **Leaflet** with XYZ
`L.tileLayer`s in **EPSG:3857** (Web Mercator): a base layer plus a **RainViewer**
radar overlay (`radarTileLayerRef`, `zIndex: 50`). Point forecasts come from
`services/weatherApi.ts` (Open-Meteo). `SelectedField` already carries
`latitude/longitude`, `polygonCoordinates` (`[lat,lng]` rings), `departmentCode`
and a `soilType` enum. **Implication:** any EPSG:3857 raster/WMS overlay (precip,
temp, wind, cloud) can be added as another `L.tileLayer`/WMS layer with a
`zIndex` — no architecture change needed.

---

## 2. Weather spatial-layer feasibility (Open-Meteo Maps)

**Finding.** Open-Meteo's public offering is **point/grid JSON forecasts**, not a
hosted global **weather-tile CDN** for temperature/wind/cloud. The open-source
*open-meteo* project can *render* maps, but that requires **self-hosting** a tile
service (GRIB → tiles) — real infrastructure, not a drop-in URL. There is no
free, reliable, hosted XYZ endpoint we could verify for nationwide
temp/wind/cloud overlays.

**Honest recommendation (simplest reliable path), by variable:**
- **Precipitation / radar — already solved.** RainViewer XYZ tiles
  (EPSG:3857) are already integrated and working; keep them (observation vs
  nowcast is already labelled in the UI).
- **Temperature / wind / cloud — two legitimate options:**
  1. **Météo-France AROME WMS** via the Météo-France API portal (needs a key;
     genuine gridded fields, EPSG:3857/4326, correct for France). Documented as
     *not obtained* here (key required).
  2. **Self-host** the open-source renderer over Open-Meteo/AROME GRIB to emit
     EPSG:3857 tiles. Reliable but is real infra to build and operate.
- **Do NOT** interpolate a "national weather grid" from a handful of point
  forecasts and present it as a spatial field — it would be fabricated.

**CORS/projection/perf:** RainViewer tiles are CORS-open XYZ in EPSG:3857 and
already perform well in the current map. A future WMS source must be EPSG:3857
(or reprojected) and CORS-enabled; Météo-France WMS meets this with a key.

**PoC status:** no new genuine, no-auth tile source for temp/wind/cloud was
reachable, so **no isolated PoC overlay was implemented** (per the instruction
to implement one "only if feasible" and never fake a grid). The data model and
`AvailableLayersResponse` contract (below) are ready to register such a layer
the moment a keyed WMS is provisioned.

---

## 3. Soil-risk data model (`src/geo/schemas.py`)

Typed (Pydantic), with a strict provenance taxonomy that keeps the four
categories separate:
- **(a) measured** — `SoilObservation` (dated lab/field tests).
- **(b) modelled/mapped** — `SoilTextureCarbon` (SoilGrids, with unit notes),
  `SoilMapUnit` (GIS Sol RRP), each requiring `Provenance`.
- **(c) exposure** — `ExposureInputs` (slope, precip history, heavy-rain,
  vegetation cover, declared crop).
- **(d) scenario** — `WeatherScenario` (`is_hypothetical = True`).
Plus `FieldLocation` (polygon reused from the frontend) and `ManagementEvent`
(tillage/cover-crop/irrigation/crop-protection as **declared facts only**).

Honesty rules enforced by the types: every soil value needs `Provenance` +
`data_kind`; crop-protection events are declared facts (the model never infers
pesticide/environmental impact from counts); nothing emits measured degradation,
contamination, yield loss or a carbon trend.

---

## 4. RUSLE / RUSLE2015 study & what is actually available

RUSLE: **A = R · K · LS · C · P**. Availability for this project
(`src/geo/vulnerability.py::rusle_factor_availability`):

| Factor | Needs | Available here? |
|---|---|---|
| **R** rainfall erosivity | sub-hourly/− intensity climatology | ❌ ESDAC R-factor needs login. ERA5 heavy-rain **proxy** only (not the R-factor). |
| **K** soil erodibility | texture + OM + **structure** + **permeability** | ❌ partial — SoilGrids texture/SOC yes; structure/permeability no. |
| **LS** slope length & steepness | DEM slope + flow accumulation | 🟡 slope ✅ (Copernicus DEM); full LS (flow accumulation) ✗ → slope-only approx. |
| **C** cover-management | calibrated per crop/rotation | ❌ NDVI (Sentinel-2) + RPG declared crop as **proxies** only. |
| **P** support practices | contouring/terracing/strips | ❌ unknown unless farmer declares. |

**Conclusion:** inputs are **inadequate for a defensible quantitative erosion
estimate** (t ha⁻¹ yr⁻¹). Per the brief, we therefore ship a **clearly-labelled
exploratory erosion-vulnerability index (0–100)** (`exploratory_vulnerability`):
a transparent weighted blend of normalised **slope / heavy-rain erosivity /
texture-erodibility / cover-deficit** proxies, with documented weights
(0.35 / 0.25 / 0.20 / 0.20) and a limitations list. It is an **exposure**
indicator, `is_quantitative_erosion_estimate = False`, and must be presented as
such. Once ESDAC R/K/C access is granted, RUSLE2015 can replace the proxy.

---

## 5. Proposed geospatial API contracts (NOT exposed in production)

In `src/geo/schemas.py` (mirror into `docs/API_CONTRACT.md §10`), additive and
backward-compatible — **not mounted** on the live Lambda/API in this branch:
- `GET /geo/soil?lat&lon` → `SoilPropertiesResponse` (modelled + map unit).
- `GET /geo/layers` → `AvailableLayersResponse` (layers + legends + `live` flag).
- `POST /geo/soil-risk` (`SoilRiskInputs` → `SoilRiskOutput`) — exploratory index.
- `POST /geo/observations`, `POST /geo/management` — dated measured/declared records.
Access control: these must require the same throttling/validation as the existing
API and should not be publicly exposed without review (soil/field data).

---

## 6. What was truly downloaded vs live vs not obtained

- **Downloaded (small, validated, checksummed):** IGN RPG 2024 parcels, IGN
  ADMIN EXPRESS communes, SoilGrids clay 0–5 cm (WMS PNG + WCS GeoTIFF),
  Copernicus DEM window + slope, ERA5 2015–2024 history. GIS Sol RRP **Gironde**
  sample (path validation only).
- **Live map service (not bulk-downloaded):** Sentinel-2 L2A STAC (NDVI
  feasible), GIS Sol RRP WFS (published departments only).
- **Not obtained — registration/login (not bypassed):** ESDAC RUSLE2015, GIS Sol
  RRP for **Aude**, Météo-France AROME WMS.

## 7. Key limitations
- GIS Sol RRP does not cover the **Aude** example region on the open WFS → for
  Castelnaudary, soil texture is **modelled** (SoilGrids), not a local soil map.
- No authoritative erosion factors (ESDAC) → only an exploratory index.
- SoilGrids is 250 m, modelled, with uncertainty; not a substitute for a soil
  test. One edge pixel read 0 g/kg clay (possible boundary artefact) — flagged.
- No new weather spatial overlay for temp/wind/cloud without a Météo-France key.
- Nothing here is wired into the app or deployed; it is a reviewed foundation.
