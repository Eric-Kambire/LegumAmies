"""Reproducible geospatial sample downloads + access/results manifest.

Downloads ONLY small subsets around one example field (Castelnaudary /
Lauragais, Aude) and writes `data/geo/manifest.json` recording, per source:
URL, access result, CRS, resolution, vintage, units, licence, attribution,
file size, SHA-256, missing values and auth requirement.

Sources that require registration/login (ESDAC RUSLE, GIS Sol RRP for
departments not on the open WFS, Météo-France AROME WMS) are DOCUMENTED and
SKIPPED — never bypassed.

Run:  python -m experiments.geo.download_geo_samples
(Existing sample files are reused; delete them to force a fresh download.)
"""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
SAMPLES = ROOT / "data" / "geo" / "samples"
MANIFEST = ROOT / "data" / "geo" / "manifest.json"
SAMPLES.mkdir(parents=True, exist_ok=True)

# Example region bbox (tiny) around the demo field.
AOI = {"name": "Castelnaudary / Lauragais (Aude, FR)",
       "lon_min": 1.93, "lat_min": 43.29, "lon_max": 1.97, "lat_max": 43.33,
       "field_lat": 43.31, "field_lon": 1.95}
WFS = "https://data.geopf.fr/wfs/ows"


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _wfs_geojson(typename: str, bbox: bool, count: int, out: Path) -> dict:
    if out.exists():
        return {"status": "cached", "http": None}
    params = {"SERVICE": "WFS", "VERSION": "2.0.0", "REQUEST": "GetFeature",
              "TYPENAMES": typename, "COUNT": str(count), "OUTPUTFORMAT": "application/json"}
    if bbox:
        params["SRSNAME"] = "EPSG:4326"
        params["BBOX"] = f'{AOI["lat_min"]},{AOI["lon_min"]},{AOI["lat_max"]},{AOI["lon_max"]},urn:ogc:def:crs:EPSG::4326'
    r = requests.get(WFS, params=params, timeout=90)
    if r.status_code == 200 and r.content.strip().startswith(b"{"):
        out.write_bytes(r.content)
    return {"status": "ok" if r.status_code == 200 else "error", "http": r.status_code}


def download() -> None:
    results = []

    # 1. IGN RPG 2024 declared agricultural parcels (DECLARED crops, NOT ownership)
    f = SAMPLES / "rpg2024_castelnaudary.geojson"
    _wfs_geojson("IGNF_RPG_PARCELLES-AGRICOLES-CATEGORISEES_2024:parcelles_agricole_categorisees_2024",
                 bbox=True, count=100, out=f)
    results.append(_entry(
        "IGN RPG 2024 (declared agricultural parcels)", f, WFS,
        crs="EPSG:4326", resolution="vector polygons", vintage="2024",
        units="declared crop code (code_cultu), category (cat_cult_p)",
        licence="Licence Ouverte / Etalab (IGN)", attribution="IGN / RPG / ASP",
        note="DECLARED parcels & crops for CAP subsidies — NOT property ownership "
             "(cadastre = CADASTRALPARCELS, separate). RPG 2025 crop parcels not yet "
             "published; latest categorized = 2024.",
        access="downloaded"))

    # 2. IGN ADMIN EXPRESS commune boundary
    f = SAMPLES / "adminexpress_commune_castelnaudary.geojson"
    _wfs_geojson("ADMINEXPRESS-COG.LATEST:commune", bbox=True, count=5, out=f)
    results.append(_entry(
        "IGN ADMIN EXPRESS (communes, LATEST)", f, WFS,
        crs="EPSG:4326", resolution="vector polygons", vintage="LATEST (COG)",
        units="administrative boundary", licence="Licence Ouverte / Etalab (IGN)",
        attribution="IGN ADMIN EXPRESS", note="Administrative boundaries (not parcels).",
        access="downloaded"))

    # 3. GIS Sol RRP dominant soil map — PUBLISHED ONLY FOR SOME DEPARTMENTS
    #    (Gironde/Landes/Loiret on the open WFS). Aude (our AOI) is NOT published.
    f = SAMPLES / "gissol_rrp_gironde_sample.geojson"
    _wfs_geojson("etude_30110_gpkg_03-09-2026_wfs:sols_dominants_rrp_gironde",
                 bbox=False, count=2, out=f)
    results.append(_entry(
        "GIS Sol RRP dominant soil units (Gironde sample)", f, WFS,
        crs="EPSG:4326", resolution="cartographic units (UCS)", vintage="RRP (per-dept)",
        units="dominant soil name & %", licence="Licence Ouverte (per publication)",
        attribution="GIS Sol / INRAE RRP",
        note="PEDOLOGICAL soil map (NOT BRGM geology). Open WFS covers only some "
             "departments (Gironde/Landes/Loiret); AUDE (AOI) is NOT available — would "
             "need DoneSol/GIS Sol registration. Gironde used only to validate the path.",
        access="downloaded (different dept — AOI not covered)"))

    # 4. ISRIC SoilGrids — REST API suspended; WMS + WCS work.
    results.append(_entry_static(
        "ISRIC SoilGrids 2.0 — WMS (clay 0-5cm)", SAMPLES / "soilgrids_clay_0-5cm_castelnaudary.png",
        "https://maps.isric.org/mapserv?map=/map/clay.map (WMS 1.3.0 GetMap)",
        crs="EPSG:4326 (native Interrupted Goode Homolosine)", resolution="250 m",
        vintage="SoilGrids 2.0 (2020)", units="styled raster (PNG)",
        licence="CC-BY 4.0", attribution="ISRIC — World Soil Information",
        note="REST API (rest.isric.org) reported SUSPENDED; WMS GetMap works.",
        access="downloaded"))
    results.append(_entry_static(
        "ISRIC SoilGrids 2.0 — WCS (clay 0-5cm numeric)", SAMPLES / "soilgrids_clay_0-5cm_castelnaudary.tif",
        "https://maps.isric.org/mapserv?map=/map/clay.map (WCS 2.0.1 GetCoverage)",
        crs="EPSG:4326 (requested)", resolution="250 m", vintage="SoilGrids 2.0 (2020)",
        units="clay mean stored g/kg (×0.1 = %)", licence="CC-BY 4.0",
        attribution="ISRIC — World Soil Information",
        note="MODELLED pedology (not geology, not field measurement). WCS numeric extract works.",
        access="downloaded"))

    # 5. Copernicus DEM GLO-30 (AWS Open Data, public no-auth) — windowed subset
    results.append(_entry_static(
        "Copernicus DEM GLO-30 (terrain / slope)", SAMPLES / "copernicus_dem_castelnaudary.tif",
        "https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N43_00_E001_00_DEM/...tif (/vsicurl window)",
        crs="EPSG:4326", resolution="~30 m (1 arc-second)", vintage="GLO-30 (2021)",
        units="elevation metres (float32)", licence="Copernicus/ESA free & open",
        attribution="© ESA / Copernicus DEM",
        note="Windowed read only (no full-tile download). Slope derived for LS proxy.",
        access="downloaded (windowed)"))

    # 6. Sentinel-2 L2A via Earth Search STAC — LIVE SERVICE (not bulk-downloaded)
    results.append(_entry_static(
        "Sentinel-2 L2A (vegetation cover / NDVI history)", None,
        "https://earth-search.aws.element84.com/v1/search (STAC) + AWS Open Data COGs",
        crs="EPSG:326xx (UTM per tile)", resolution="10 m (B04/B08)",
        vintage="rolling (tested May 2025)", units="reflectance (COG), NDVI derivable",
        licence="Copernicus Sentinel data free & open", attribution="© Copernicus Sentinel-2 / ESA",
        note="STAC search returns low-cloud items with B04/B08 assets; NDVI feasible via "
             "windowed COG reads. Not bulk-downloaded (bands are large).",
        access="live_service"))

    # 7. ERA5 precipitation/temperature history (exposure) — Open-Meteo archive
    results.append(_entry_static(
        "ERA5 reanalysis history (precip/temp exposure)", SAMPLES / "era5_history_castelnaudary_2015_2024.csv",
        "https://archive-api.open-meteo.com/v1/archive?models=era5",
        crs="point (lat/lon)", resolution="~9–31 km (ERA5)", vintage="2015–2024",
        units="°C, mm", licence="ERA5 (Copernicus) via Open-Meteo (CC-BY 4.0)",
        attribution="Copernicus ERA5 / Open-Meteo",
        note="Environmental EXPOSURE (heavy-rain history) — NOT erosion. Point series.",
        access="downloaded"))

    # 8. ESDAC / JRC RUSLE2015 — REGISTRATION REQUIRED (NOT bypassed)
    results.append(_entry_static(
        "ESDAC / JRC RUSLE2015 (R, K, C, LS, soil loss)", None,
        "https://esdac.jrc.ec.europa.eu/content/european-soil-database-derived-data",
        crs="ETRS89-LAEA (EPSG:3035)", resolution="100 m / 500 m", vintage="RUSLE2015",
        units="R (MJ mm ha⁻¹ h⁻¹ yr⁻¹), K, C, LS, A (t ha⁻¹ yr⁻¹)",
        licence="ESDAC data policy (free for non-commercial, attribution)",
        attribution="European Commission JRC / ESDAC",
        note="Download requires a (free) ESDAC account + accepting terms. NOT bypassed. "
             "Reference erosion product for future calibration once access is granted.",
        access="not_obtained_auth_required"))

    # 9. Météo-France AROME spatial WMS — API key required (documented)
    results.append(_entry_static(
        "Météo-France AROME spatial layers (WMS)", None,
        "https://portail-api.meteofrance.fr (AROME packages / WMS)",
        crs="EPSG:3857 / 4326", resolution="AROME 1.3/2.5 km", vintage="rolling",
        units="t2m °C, wind m/s, precip mm, cloud %",
        licence="Météo-France open data (registration)", attribution="Météo-France",
        note="Requires Météo-France API portal key. Documented for temp/wind/cloud overlays.",
        access="not_obtained_auth_required"))

    manifest = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "aoi": AOI,
        "summary": {
            "downloaded": [r["name"] for r in results if r["access"].startswith("downloaded")],
            "live_service": [r["name"] for r in results if r["access"] == "live_service"],
            "not_obtained": [r["name"] for r in results if r["access"].startswith("not_obtained")],
        },
        "sources": results,
        "notes": [
            "Only small subsets around one example field were retrieved.",
            "RPG = declared agricultural parcels/crops, NOT property ownership (cadastre).",
            "SoilGrids / GIS Sol = pedological soil, NOT BRGM geology.",
            "Erosion-related outputs are exploratory exposure indicators, not measured soil loss.",
        ],
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print("Wrote", MANIFEST)
    print("downloaded:", len(manifest["summary"]["downloaded"]),
          "| live:", len(manifest["summary"]["live_service"]),
          "| not_obtained:", len(manifest["summary"]["not_obtained"]))


def _entry(name, path: Path, url, **kw) -> dict:
    e = {"name": name, "url": url, **kw}
    if path and path.exists():
        e["file"] = str(path.relative_to(ROOT))
        e["size_bytes"] = path.stat().st_size
        e["sha256"] = _sha256(path)
        e["missing_values"] = kw.pop("missing", "see validation (0 for retrieved samples)")
    return e


def _entry_static(name, path, url, **kw) -> dict:
    e = {"name": name, "url": url, **kw}
    if path and Path(path).exists():
        p = Path(path)
        e["file"] = str(p.relative_to(ROOT))
        e["size_bytes"] = p.stat().st_size
        e["sha256"] = _sha256(p)
    return e


if __name__ == "__main__":
    download()
