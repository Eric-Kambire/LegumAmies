"""Typed geospatial & soil-risk data model for Légume'Ami (PROPOSAL, not wired).

These Pydantic models define backward-compatible contracts for a future
geospatial layer. They are NOT mounted on the production API in this branch;
they are a reviewed proposal plus the schema used by the offline tooling and
tests.

Scientific separation (enforced by distinct models / enums):
  (a) MEASURED soil changes      -> SoilObservation (lab/field tests with dates)
  (b) MODELLED soil properties   -> ModelledSoilProperty (e.g. SoilGrids)
  (c) environmental RISK exposure-> ExposureInputs (precip history, slope, cover)
  (d) future weather SCENARIOS   -> WeatherScenario (explicitly hypothetical)

Honesty constraints baked in:
  * Every soil property value carries explicit `provenance` and `data_kind`.
  * Nothing here produces "actual soil degradation / contamination / yield loss
    / carbon trend". The risk output is an EXPLORATORY vulnerability index, not a
    measured or quantitatively-modelled erosion rate.
  * Pesticide impact is NOT inferred from spraying counts; management events are
    recorded as declared facts only.
"""
from __future__ import annotations

from enum import Enum
from typing import Literal, Optional
from pydantic import BaseModel, Field


# --------------------------------------------------------------------------
# Provenance / data-kind taxonomy
# --------------------------------------------------------------------------
class DataKind(str, Enum):
    measured = "measured_soil_observation"          # (a) lab/field measurement
    modelled = "modelled_soil_property"             # (b) model raster (SoilGrids)
    mapped = "mapped_soil_unit"                     # (b) cartographic unit (GIS Sol RRP)
    exposure = "environmental_exposure"             # (c) precip/slope/cover
    scenario = "future_weather_scenario"            # (d) hypothetical
    declared = "user_declared"                      # user-entered management/field


class Provenance(BaseModel):
    source: str = Field(..., examples=["ISRIC SoilGrids 2.0", "IGN RPG 2024", "Copernicus DEM GLO-30"])
    data_kind: DataKind
    url: Optional[str] = None
    vintage: Optional[str] = Field(None, description="Dataset year/release, e.g. '2020' or '2024'")
    crs: Optional[str] = None
    resolution: Optional[str] = Field(None, description="e.g. '250 m', '~30 m', 'polygon'")
    licence: Optional[str] = None
    attribution: Optional[str] = None
    retrieved_at_utc: Optional[str] = None
    uncertainty: Optional[str] = Field(None, description="Qualitative or quantitative uncertainty note")


# --------------------------------------------------------------------------
# Geometry (reuse frontend SelectedField: lat/lon + polygonCoordinates [[lat,lng]])
# --------------------------------------------------------------------------
class FieldLocation(BaseModel):
    field_id: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    # GeoJSON-style polygon rings as [lon, lat] (documented; frontend stores [lat,lng])
    polygon_lonlat: Optional[list[list[float]]] = None
    area_ha: Optional[float] = None
    department_code: Optional[str] = None
    commune_insee: Optional[str] = None


# --------------------------------------------------------------------------
# (b) MODELLED / MAPPED soil properties
# --------------------------------------------------------------------------
class SoilTextureCarbon(BaseModel):
    """Modelled soil texture + carbon with explicit units and provenance.

    Values are MODELLED estimates (e.g. SoilGrids), not field measurements.
    SoilGrids 'mean' rasters store integers: clay/sand/silt in g/kg (divide by
    10 for %), SOC in dg/kg (divide by 10 for g/kg), pH in pH*10 (divide by 10).
    """
    depth_cm: str = Field("0-5", examples=["0-5", "5-15", "15-30"])
    clay_pct: Optional[float] = Field(None, ge=0, le=100)
    sand_pct: Optional[float] = Field(None, ge=0, le=100)
    silt_pct: Optional[float] = Field(None, ge=0, le=100)
    soil_organic_carbon_g_per_kg: Optional[float] = Field(None, ge=0)
    ph_h2o: Optional[float] = Field(None, ge=0, le=14)
    provenance: Provenance


class SoilMapUnit(BaseModel):
    """GIS Sol RRP dominant soil map unit (cartographic, where published)."""
    ucs_id: Optional[str] = None
    ucs_name: Optional[str] = None
    dominant_soil_name: Optional[str] = None
    dominant_soil_pct: Optional[float] = None
    provenance: Provenance


# --------------------------------------------------------------------------
# (a) MEASURED soil observations (lab/field, dated)
# --------------------------------------------------------------------------
class SoilObservation(BaseModel):
    field_id: str
    observed_date: str = Field(..., description="ISO date of sampling/measurement")
    depth_cm: Optional[str] = None
    clay_pct: Optional[float] = None
    organic_matter_pct: Optional[float] = None
    ph_h2o: Optional[float] = None
    method: Optional[str] = Field(None, description="Lab/method reference")
    lab: Optional[str] = None
    data_kind: Literal[DataKind.measured] = DataKind.measured
    notes: Optional[str] = None


# --------------------------------------------------------------------------
# Declared management events (facts only; no impact inference)
# --------------------------------------------------------------------------
class ManagementEvent(BaseModel):
    field_id: str
    event_date: str
    type: Literal["tillage", "cover_crop", "irrigation", "crop_protection", "sowing", "harvest"]
    detail: Optional[str] = None
    data_kind: Literal[DataKind.declared] = DataKind.declared
    # NOTE: crop_protection events are recorded as declared facts only. The
    # system MUST NOT infer pesticide/environmental impact from event counts.


# --------------------------------------------------------------------------
# (c) EXPOSURE inputs
# --------------------------------------------------------------------------
class ExposureInputs(BaseModel):
    slope_degrees_mean: Optional[float] = Field(None, ge=0, le=90)
    slope_degrees_max: Optional[float] = Field(None, ge=0, le=90)
    annual_precip_mm_mean: Optional[float] = Field(None, ge=0)
    heavy_rain_days_gt20mm_per_year: Optional[float] = Field(None, ge=0)
    max_daily_precip_mm: Optional[float] = Field(None, ge=0)
    vegetation_cover_fraction: Optional[float] = Field(None, ge=0, le=1,
        description="From Sentinel-2 NDVI (modelled proxy), if available")
    crop_category: Optional[str] = Field(None, description="RPG declared crop category, if available")
    provenance: list[Provenance] = Field(default_factory=list)


# --------------------------------------------------------------------------
# (d) future weather SCENARIO (explicitly hypothetical)
# --------------------------------------------------------------------------
class WeatherScenario(BaseModel):
    name: str
    data_kind: Literal[DataKind.scenario] = DataKind.scenario
    description: str
    precip_multiplier: float = Field(1.0, gt=0, description="Scales heavy-rain exposure; hypothetical")
    is_hypothetical: Literal[True] = True


# --------------------------------------------------------------------------
# API CONTRACTS (proposed; not mounted in production)
# --------------------------------------------------------------------------
class SoilPropertiesRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    depths: list[str] = Field(default_factory=lambda: ["0-5", "5-15"])


class SoilPropertiesResponse(BaseModel):
    location: FieldLocation
    modelled: list[SoilTextureCarbon]
    map_unit: Optional[SoilMapUnit] = None
    note: str = ("Modelled/mapped soil estimates with uncertainty; not field "
                 "measurements. Confirm with soil tests before decisions.")


class LayerLegendEntry(BaseModel):
    layer_id: str
    label: str
    service: Literal["WMS", "WCS", "XYZ", "WFS", "STAC"]
    url_template: str
    crs: str
    legend_url: Optional[str] = None
    provenance: Provenance
    live: bool = Field(..., description="True if reachable as a live map service")


class AvailableLayersResponse(BaseModel):
    layers: list[LayerLegendEntry]


class SoilRiskInputs(BaseModel):
    location: FieldLocation
    soil: Optional[SoilTextureCarbon] = None
    exposure: ExposureInputs
    management: list[ManagementEvent] = Field(default_factory=list)
    observations: list[SoilObservation] = Field(default_factory=list)
    scenario: Optional[WeatherScenario] = None


class RusleFactorAvailability(BaseModel):
    factor: Literal["R", "K", "LS", "C", "P"]
    name: str
    available: bool
    source: Optional[str] = None
    note: str


class SoilRiskOutput(BaseModel):
    field_id: str
    indicator: Literal["exploratory_erosion_vulnerability_index"] = "exploratory_erosion_vulnerability_index"
    data_kind: Literal[DataKind.exposure] = DataKind.exposure
    score_0_100: float = Field(..., ge=0, le=100)
    band: Literal["faible", "modéré", "élevé"]
    components: dict = Field(default_factory=dict, description="Normalised sub-scores used")
    rusle_factor_availability: list[RusleFactorAvailability] = Field(default_factory=list)
    is_quantitative_erosion_estimate: Literal[False] = False
    limitations: list[str] = Field(default_factory=list)
    provenance: list[Provenance] = Field(default_factory=list)
