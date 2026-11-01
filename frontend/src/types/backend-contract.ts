/**
 * Backend Contract — LegumAmies ClimateShield API (FastAPI).
 *
 * Mirrors src/api/schemas.py and docs/API_CONTRACT.md. These are the REAL
 * fields returned by the backend: live AROME/AIFS forecasts, ensemble rainfall
 * probabilities, SOURCED agronomic risk flags (with provenance and validation
 * status), weather-only harvest ranking, and a regulatory spraying check.
 *
 * No fabricated fields: there is no predicted grain moisture, drying cost,
 * pod-shattering probability, generated advisor summary, or upcycling price.
 * Those were removed because the backend does not measure or model them.
 */
import type { LegumeCropType, CropGrowthStage } from './agricultural';

/** Accepts French (frontend) or English (backend) crop/stage ids. */
export interface AssessRequest {
  latitude: number;
  longitude: number;
  crop: LegumeCropType | string;
  growth_stage: CropGrowthStage | string;
  harvest_ready?: boolean;
  rain_threshold_mm?: number;
  arome_forecast_days?: number;
  aifs_forecast_days?: number;
  machinery?: Array<{ date_local: string; available: boolean }>;
  field_name?: string;
}

export interface HourlyPoint {
  valid_time_utc: string;
  valid_time_local: string;
  temperature_c: number | null;
  precipitation_mm: number | null;
  relative_humidity_pct: number | null;
  wind_speed_kmh: number | null;
}

export interface WeatherBlock {
  data_kind: 'real_weather_forecast';
  model_id: string;
  url: string;
  available_variables: string[];
  missing_variables: string[];
  units: Record<string, string | null>;
  valid_time_local_start: string | null;
  valid_time_local_end: string | null;
  n_hours: number;
  hourly: HourlyPoint[];
}

export interface RainProbabilityDay {
  date_local: string;
  rain_threshold_mm: number;
  probability_pct: number;
  ensemble_members_used: number;
  mean_precipitation_mm: number;
  median_precipitation_mm: number;
}

export interface EnsembleBlock {
  data_kind: 'derived_from_real_forecast';
  model_id: string;
  url: string;
  ensemble_members_valid: number;
  ensemble_members_expected_max: number;
  rain_threshold_mm: number;
  threshold_note: string;
  daily: RainProbabilityDay[];
}

export interface RiskAlert {
  hazard_type: string;
  weather_variable: string;
  threshold_value: number;
  comparison_operator: string;
  observed_value: number;
  forecast_start_local: string;
  forecast_end_local: string;
  exposure_hours: number;
  minimum_exposure_hours: number;
  source_url: string;
  validation_status: 'published' | 'requires_expert_validation' | 'demo_hypothetical' | string;
}

export interface RiskBlock {
  data_kind: 'risk_detection_from_real_forecast_and_agronomic_evidence';
  active_published_rules_for_stage: number;
  alerts: RiskAlert[];
  note: string;
}

export interface HarvestDay {
  date_local: string;
  feasible: boolean;
  rain_probability_pct: number;
  expected_rain_mm: number;
  weather_risk_score: number;
  rank: number | null;
  explanation: string;
  limitations: string;
}

export interface HarvestBlock {
  data_kind: 'weather_only_decision_aid';
  available: boolean;
  harvest_ready: boolean;
  weights: Record<string, number>;
  recommended_date_local: string | null;
  n_feasible_days: number;
  days: HarvestDay[];
  note: string;
}

export interface RegulatoryWindow {
  date_local: string;
  max_wind_speed_kmh: number;
  spraying_allowed: boolean;
  threshold_kmh: number;
  source: string;
}

export interface FieldEcho {
  field_id: string;
  field_name: string | null;
  latitude: number;
  longitude: number;
  crop_py: string;
  crop_fr: string;
  crop_label_fr: string;
  growth_stage_py: string;
  growth_stage_fr: string;
  growth_stage_label_fr: string;
}

export interface Provenance {
  retrieved_at_utc: string;
  arome_model_id: string;
  aifs_model_id: string;
  agronomic_sources: Array<{ crop: string; hazard: string; institution: string; url: string }>;
  data_kinds: Record<string, string>;
}

export interface AssessResponse {
  field: FieldEcho;
  weather: WeatherBlock;
  ensemble: EnsembleBlock;
  risk: RiskBlock;
  harvest: HarvestBlock;
  regulatory_windows: RegulatoryWindow[];
  provenance: Provenance;
}


// --------------------------------------------------------------------------
// Advisor Agent Contract (POST /advisor/ask)
// --------------------------------------------------------------------------
export interface AdvisorField {
  latitude?: number;
  longitude?: number;
  crop?: string;
  growth_stage?: string;
  harvest_ready?: boolean;
  field_name?: string;
}

export interface AdvisorRequest {
  field?: AdvisorField;
  question: string;
}

export interface AdvisorAction {
  title: string;
  basis: string;
  verified: boolean;
}

export interface AdvisorCitation {
  type: string;
  institution?: string;
  document?: string;
  source_url?: string;
  score?: number;
  snippet?: string;
  page?: number | null;
  crop?: string | null;
  hazard?: string;
  validation_status?: string;
}

export interface AdvisorUncertainty {
  ensemble_members?: number;
  rain_probability_pct_range?: [number, number];
  note?: string;
}

export interface AdvisorResponse {
  answer: string;
  actions: AdvisorAction[];
  citations: AdvisorCitation[];
  forecast_provenance: Record<string, unknown>;
  uncertainty: AdvisorUncertainty;
  limitations: string[];
  grounded: boolean;
  tools_used: string[];
  model_id: string | null;
  knowledge_base_id: string;
  generated_at_utc: string;
}
