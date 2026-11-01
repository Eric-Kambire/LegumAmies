"""Geospatial Soil Intelligence API router (prototype).

Endpoints: GET /geo/layers, GET /geo/soil, POST /geo/soil-risk.
Bounded to the validated Castelnaudary study area via an explicit `coverage`
field — the API never pretends the local dataset covers all of France.

Mounted on the existing FastAPI app so it is testable, but NOT redeployed to
AWS in this branch. Backward-compatible: adds routes only; `/assess`,
`/advisor/ask`, `/health`, `/meta` are untouched.
"""
from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from . import soil_intelligence as si
from .schemas import (AvailableLayersResponse, LayerLegendEntry, Provenance, DataKind,
                      FieldLocation, SoilPropertiesResponse, SoilTextureCarbon, SoilRiskInputs)

router = APIRouter(prefix="/geo", tags=["geo"])

_BBOX = si.STUDY_AREA["bbox_4326"]  # [lon_min, lat_min, lon_max, lat_max]


def _in_coverage(lat: float, lon: float) -> bool:
    return (_BBOX[1] <= lat <= _BBOX[3]) and (_BBOX[0] <= lon <= _BBOX[2])


@lru_cache(maxsize=1)
def _case_study() -> dict:
    return si.run_case_study()


class GeoSoilRiskResponse(BaseModel):
    coverage: str
    model_version: str
    equation: str
    study_area: dict
    vulnerability_index: dict
    rusle_baseline: dict
    scenarios: list[dict]
    sensitivity_tornado: list[dict]
    uncertainty_range: dict
    parameters: dict
    assumptions: list[str]
    sources: list[dict]
    generated_at_utc: str
    disclaimer: str


@router.get("/layers", response_model=AvailableLayersResponse)
def geo_layers() -> AvailableLayersResponse:
    """Validated geospatial layers + legends (with live-service flags)."""
    def prov(src, kind, vintage, crs, res, lic, attr):
        return Provenance(source=src, data_kind=kind, vintage=vintage, crs=crs,
                          resolution=res, licence=lic, attribution=attr)
    layers = [
        LayerLegendEntry(layer_id="rpg_2024", label="RPG 2024 — parcelles déclarées", service="WFS",
            url_template="https://data.geopf.fr/wfs/ows?...IGNF_RPG_PARCELLES-AGRICOLES-CATEGORISEES_2024",
            crs="EPSG:4326", provenance=prov("IGN RPG 2024", DataKind.declared, "2024", "EPSG:4326",
            "vector", "Etalab/IGN", "IGN/RPG/ASP"), live=True),
        LayerLegendEntry(layer_id="admin_commune", label="Communes (ADMIN EXPRESS)", service="WFS",
            url_template="https://data.geopf.fr/wfs/ows?...ADMINEXPRESS-COG.LATEST:commune",
            crs="EPSG:4326", provenance=prov("IGN ADMIN EXPRESS", DataKind.mapped, "LATEST", "EPSG:4326",
            "vector", "Etalab/IGN", "IGN"), live=True),
        LayerLegendEntry(layer_id="soilgrids_clay", label="Argile 0-5 cm (SoilGrids)", service="WMS",
            url_template="https://maps.isric.org/mapserv?map=/map/clay.map&...GetMap",
            crs="EPSG:4326", legend_url="https://maps.isric.org/mapserv?map=/map/clay.map&REQUEST=GetLegendGraphic",
            provenance=prov("ISRIC SoilGrids 2.0", DataKind.modelled, "2020", "EPSG:4326", "250 m",
            "CC-BY 4.0", "ISRIC"), live=True),
        LayerLegendEntry(layer_id="copernicus_dem", label="Relief / pente (Copernicus DEM)", service="WCS",
            url_template="https://copernicus-dem-30m.s3.amazonaws.com/<tile>.tif",
            crs="EPSG:4326", provenance=prov("Copernicus DEM GLO-30", DataKind.exposure, "2021",
            "EPSG:4326", "~30 m", "Copernicus free", "ESA/Copernicus"), live=True),
        LayerLegendEntry(layer_id="sentinel2_ndvi", label="NDVI (Sentinel-2)", service="STAC",
            url_template="https://earth-search.aws.element84.com/v1/search (sentinel-2-l2a)",
            crs="EPSG:326xx", provenance=prov("Copernicus Sentinel-2 L2A", DataKind.exposure, "rolling",
            "EPSG:326xx", "10 m", "Copernicus free", "ESA/Copernicus"), live=True),
    ]
    return AvailableLayersResponse(layers=layers)


@router.get("/soil", response_model=SoilPropertiesResponse)
def geo_soil(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    """Modelled soil properties. Prototype coverage = Castelnaudary study area."""
    loc = FieldLocation(field_id="query", latitude=lat, longitude=lon,
                        department_code="11" if _in_coverage(lat, lon) else None)
    if not _in_coverage(lat, lon):
        raise HTTPException(status_code=422, detail={
            "error": "out_of_coverage",
            "message": "Prototype soil coverage is limited to the Castelnaudary study area.",
            "coverage_bbox_4326": _BBOX})
    cs = _case_study()
    s = cs["inputs"]["soil"]
    prov = Provenance(source="ISRIC SoilGrids 2.0", data_kind=DataKind.modelled, vintage="2020",
                      crs="EPSG:4326", resolution="250 m", licence="CC-BY 4.0",
                      attribution="ISRIC — World Soil Information",
                      uncertainty="250 m modelled estimate; confirm with a soil test")
    modelled = [SoilTextureCarbon(depth_cm="0-5", clay_pct=s["clay_pct"], sand_pct=s["sand_pct"],
                silt_pct=s["silt_pct"], soil_organic_carbon_g_per_kg=s["oc_0_5_pct"] * 10,
                ph_h2o=s["ph_h2o"], provenance=prov)]
    return SoilPropertiesResponse(location=loc, modelled=modelled)


@router.post("/soil-risk", response_model=GeoSoilRiskResponse)
def geo_soil_risk(inp: SoilRiskInputs) -> GeoSoilRiskResponse:
    """Vulnerability index + quantitative RUSLE + scenarios for the study area."""
    lat, lon = inp.location.latitude, inp.location.longitude
    if not _in_coverage(lat, lon):
        raise HTTPException(status_code=422, detail={
            "error": "out_of_coverage",
            "message": "Prototype soil-risk coverage is limited to the Castelnaudary study area.",
            "coverage_bbox_4326": _BBOX})
    cs = _case_study()
    return GeoSoilRiskResponse(
        coverage="castelnaudary_study_area",
        model_version=cs["model_version"], equation=cs["equation"], study_area=cs["study_area"],
        vulnerability_index=cs["vulnerability_index"], rusle_baseline=cs["rusle_baseline"],
        scenarios=cs["scenarios"], sensitivity_tornado=cs["sensitivity_tornado"],
        uncertainty_range=cs["uncertainty_range"], parameters=cs["parameters"],
        assumptions=cs["assumptions"], sources=cs["sources"],
        generated_at_utc=cs["generated_at_utc"], disclaimer=cs["disclaimer"])
