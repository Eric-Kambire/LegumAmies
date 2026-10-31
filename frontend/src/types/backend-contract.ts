/**
 * Backend Contract Interfaces
 * Target: Python FastAPI backend (Météo-France AROME, ECMWF AIFS, Bedrock ML)
 * Developed by: Kiro (Python Backend Agent) & Antigravity (PWA Frontend)
 */

import type { CropGrowthStage, LegumeCropType, RiskSeverity } from './agricultural';

/**
 * 1. Field Registration & Profile Contract
 */
export interface BackendFieldPayload {
  field_id?: string;
  user_id?: string;
  name: string;
  latitude: number;
  longitude: number;
  commune?: string;
  crop_type: LegumeCropType;
  growth_stage: CropGrowthStage;
  sowing_date?: string; // ISO 8601 YYYY-MM-DD
  soil_type?: 'calcaire' | 'argilo_calcaire' | 'limon' | 'sableux';
  area_ha?: number;
}

export interface BackendFieldResponse {
  field_id: string;
  status: 'created' | 'updated';
  sync_timestamp: string;
  geo_valid_france: boolean;
  elevation_m: number;
}

/**
 * 2. Météo-France AROME High-Resolution Forecast Contract (1.3km grid)
 */
export interface AromeForecastRequest {
  latitude: number;
  longitude: number;
  horizon_hours: 48; // AROME standard run horizon
  variables: Array<'t2m' | 'rh2m' | 'precip_1h' | 'wind10m' | 'gust10m' | 'cloud_low'>;
}

export interface AromeHourlyItem {
  timestamp_utc: string;
  temperature_c: number;
  relative_humidity_pct: number;
  precipitation_mm: number;
  wind_speed_kmh: number;
  wind_gust_kmh: number;
  wind_direction_deg: number;
  direct_normal_irradiance_wm2?: number;
}

export interface AromeForecastResponse {
  model: 'meteofrance_arome_1p3km';
  run_time_utc: string;
  latitude: number;
  longitude: number;
  hourly: AromeHourlyItem[];
  meta: {
    resolution_km: 1.3;
    source: 'Météo-France Open Data API';
  };
}

/**
 * 3. ECMWF AIFS Medium-Range AI Forecast Contract (Ensemble)
 */
export interface EcmwfAifsForecastResponse {
  model: 'ecmwf_aifs_ensemble';
  run_time_utc: string;
  latitude: number;
  longitude: number;
  daily_forecast: Array<{
    date: string;
    ensemble_temp_mean_c: number;
    ensemble_temp_p10_c: number;
    ensemble_temp_p90_c: number;
    prob_rain_gt_5mm_pct: number;
    growing_degree_days_base5: number;
  }>;
}

/**
 * 4. Agricultural Risk Assessment Engine (Flowering & Lodging)
 */
export interface AgriRiskAssessmentRequest {
  crop_type: LegumeCropType;
  growth_stage: CropGrowthStage;
  latitude: number;
  longitude: number;
}

export interface AgriRiskAssessmentResponse {
  field_id?: string;
  computed_at: string;
  overall_risk_level: RiskSeverity;
  risks: Array<{
    risk_code: 'FLOWERING_HEAT' | 'SPRAYING_WIND' | 'HARVEST_MOISTURE' | 'POD_SHATTERING' | 'LODGING_RISK';
    title_fr: string;
    severity: RiskSeverity;
    scientific_rationale: string;
    recommended_action: string;
    metric_observed: string;
    threshold: string;
  }>;
}

/**
 * 5. Harvest Window Optimizer (Bedrock / ML tabulaire)
 */
export interface HarvestWindowRequest {
  crop_type: LegumeCropType;
  latitude: number;
  longitude: number;
  estimated_maturity_date?: string;
}

export interface HarvestWindowResponse {
  crop_type: LegumeCropType;
  evaluation_date: string;
  opportunity_score_0_100: number; // 0 (catastrophic) to 100 (perfect window)
  recommendation_status: 'GO_HARVEST' | 'WAIT_WEATHER_WINDOW' | 'URGENT_BEFORE_RAIN' | 'DRYING_REQUIRED';
  optimal_start_date: string;
  optimal_end_date: string;
  predicted_grain_moisture_pct: number;
  drying_cost_estimate_eur_per_t: number;
  pod_shattering_risk_pct: number;
  advisor_summary_fr: string; // Bedrock generated agronomist summary
}

/**
 * 6. Circular Upcycling Matcher (Écarts de tri)
 */
export interface CircularMatchRequest {
  crop_type: LegumeCropType;
  defect_type: 'brisure' | 'hors_calibre' | 'sur_humidite' | 'decoloration' | 'piqure_bruche';
  quantity_tonnes: number;
  department_code: string;
}

export interface CircularMatchResponse {
  batch_id: string;
  upcycling_destinations: Array<{
    sector: 'extrusion_simili_carne' | 'meunerie_farine_pulse' | 'puree_surgelation' | 'fermentation_tempeh' | 'alimentation_animale';
    title_fr: string;
    estimated_price_eur_per_t: number;
    standard_animal_price_eur_per_t: number;
    value_recovery_pct: number; // e.g. +140%
    technical_feasibility_note: string;
    sample_buyers: Array<{
      name: string;
      region: string;
      distance_km: number;
    }>;
  }>;
}
