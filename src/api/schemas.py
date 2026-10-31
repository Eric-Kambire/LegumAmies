"""Typed request/response contracts for the LegumAmies integration API.

These Pydantic models are the single source of truth for the JSON exchanged
with the PWA. They mirror docs/API_CONTRACT.md. Values are either REAL
(forecast, sourced rules, ensemble statistics) or explicitly marked
unavailable; nothing is fabricated.
"""
from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator

from . import mapping


# --------------------------------------------------------------------------
# Request
# --------------------------------------------------------------------------
class MachinerySlot(BaseModel):
    date_local: str = Field(..., examples=["2026-11-02"])
    available: bool


class AssessRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    crop: str = Field(..., description="French or English crop id")
    growth_stage: str = Field(..., description="French or English growth-stage id")
    harvest_ready: Optional[bool] = Field(
        default=None,
        description="If omitted, the field's declared stage drives readiness.",
    )
    rain_threshold_mm: float = Field(default=5.0, gt=0, le=100)
    arome_forecast_days: int = Field(default=2, ge=1, le=4)
    aifs_forecast_days: int = Field(default=10, ge=1, le=15)
    machinery: Optional[list[MachinerySlot]] = None
    field_name: Optional[str] = None

    @field_validator("crop")
    @classmethod
    def _crop_known(cls, v: str) -> str:
        mapping.normalise_crop(v)  # raises ValueError if unknown
        return v

    @field_validator("growth_stage")
    @classmethod
    def _stage_known(cls, v: str) -> str:
        mapping.normalise_stage(v)
        return v


# --------------------------------------------------------------------------
# Response sub-objects
# --------------------------------------------------------------------------
class HourlyPoint(BaseModel):
    valid_time_utc: str
    valid_time_local: str
    temperature_c: Optional[float] = None
    precipitation_mm: Optional[float] = None
    relative_humidity_pct: Optional[float] = None
    wind_speed_kmh: Optional[float] = None


class WeatherBlock(BaseModel):
    data_kind: Literal["real_weather_forecast"] = "real_weather_forecast"
    model_id: str
    url: str
    available_variables: list[str]
    missing_variables: list[str]
    units: dict[str, Optional[str]]
    valid_time_local_start: Optional[str]
    valid_time_local_end: Optional[str]
    n_hours: int
    hourly: list[HourlyPoint]


class RainProbabilityDay(BaseModel):
    date_local: str
    rain_threshold_mm: float
    probability_pct: float
    ensemble_members_used: int
    mean_precipitation_mm: float
    median_precipitation_mm: float


class EnsembleBlock(BaseModel):
    data_kind: Literal["derived_from_real_forecast"] = "derived_from_real_forecast"
    model_id: str
    url: str
    ensemble_members_valid: int
    ensemble_members_expected_max: int = 51
    rain_threshold_mm: float
    threshold_note: str
    daily: list[RainProbabilityDay]


class RiskAlert(BaseModel):
    hazard_type: str
    weather_variable: str
    threshold_value: float
    comparison_operator: str
    observed_value: float
    forecast_start_local: str
    forecast_end_local: str
    exposure_hours: int
    minimum_exposure_hours: int
    source_url: str
    validation_status: str


class RiskBlock(BaseModel):
    data_kind: Literal[
        "risk_detection_from_real_forecast_and_agronomic_evidence"
    ] = "risk_detection_from_real_forecast_and_agronomic_evidence"
    active_published_rules_for_stage: int
    alerts: list[RiskAlert]
    note: str


class HarvestDay(BaseModel):
    date_local: str
    feasible: bool
    rain_probability_pct: float
    expected_rain_mm: float
    weather_risk_score: float
    rank: Optional[int] = None
    explanation: str
    limitations: str


class HarvestBlock(BaseModel):
    data_kind: Literal["weather_only_decision_aid"] = "weather_only_decision_aid"
    available: bool
    harvest_ready: bool
    weights: dict
    recommended_date_local: Optional[str]
    n_feasible_days: int
    days: list[HarvestDay]
    note: str


class RegulatoryWindow(BaseModel):
    """Sourced regulatory spraying check derived from the real wind forecast."""
    date_local: str
    max_wind_speed_kmh: float
    spraying_allowed: bool
    threshold_kmh: float
    source: str


class FieldEcho(BaseModel):
    field_id: str
    field_name: Optional[str]
    latitude: float
    longitude: float
    crop_py: str
    crop_fr: str
    crop_label_fr: str
    growth_stage_py: str
    growth_stage_fr: str
    growth_stage_label_fr: str


class Provenance(BaseModel):
    retrieved_at_utc: str
    arome_model_id: str
    aifs_model_id: str
    agronomic_sources: list[dict]
    data_kinds: dict


class AssessResponse(BaseModel):
    field: FieldEcho
    weather: WeatherBlock
    ensemble: EnsembleBlock
    risk: RiskBlock
    harvest: HarvestBlock
    regulatory_windows: list[RegulatoryWindow]
    provenance: Provenance


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
