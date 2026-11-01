/**
 * Client for the geospatial soil prototype (`GET /geo/soil`, `POST /geo/soil-risk`).
 * The routes live on the geospatial branch and may not be deployed: every failure maps to an
 * explicit state so the UI never shows an invented soil value.
 */
import { API_BASE_URL, isBackendConfigured } from './legumamiesApi';

export interface SoilProvenance {
  source?: string;
  vintage?: string;
  resolution?: string;
  licence?: string;
  uncertainty?: string;
}

export interface SoilTexture {
  depth_cm?: string;
  clay_pct?: number | null;
  sand_pct?: number | null;
  silt_pct?: number | null;
  soil_organic_carbon_g_per_kg?: number | null;
  ph_h2o?: number | null;
  provenance?: SoilProvenance;
}

export interface SoilPropertiesResponse {
  modelled: SoilTexture[];
  note?: string;
}

export interface SoilScenarioRow {
  scenario: string;
  R?: number;
  K?: number;
  LS?: number;
  C?: number;
  P?: number;
  soil_loss_t_ha_yr: number;
  delta_vs_baseline_t_ha_yr?: number;
  pct_vs_baseline?: number;
}

export interface SoilTornadoRow {
  factor: string;
  low?: number;
  high?: number;
  A_low: number;
  A_high: number;
  swing: number;
  base?: number;
}

export interface SoilRiskResponse {
  coverage: string;
  model_version: string;
  equation: string;
  study_area?: { name?: string; bbox_4326?: number[] };
  vulnerability_index?: {
    score_0_100?: number;
    band?: string;
    components?: Record<string, unknown>;
    limitations?: string[];
    is_quantitative_erosion_estimate?: boolean;
  };
  rusle_baseline?: {
    soil_loss_t_ha_yr?: number;
    units?: string;
    parameters?: Record<string, number>;
  };
  scenarios?: SoilScenarioRow[];
  sensitivity_tornado?: SoilTornadoRow[];
  uncertainty_range?: { A_min_t_ha_yr?: number; A_max_t_ha_yr?: number };
  parameters?: Record<string, Record<string, unknown>>;
  assumptions?: string[];
  sources?: Array<Record<string, unknown>>;
  generated_at_utc?: string;
  disclaimer?: string;
}

export type SoilFetchResult =
  | { status: 'ok'; risk: SoilRiskResponse; soil: SoilPropertiesResponse | null }
  | { status: 'out_of_coverage'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

const base = () => (API_BASE_URL ?? '').replace(/\/$/, '');

/**
 * Archived real, executed Castelnaudary case study (PR #7), used only while
 * the geo API is not yet mounted. Same study-area values for the study region,
 * NEVER reinterpreted as independently measured field-specific data.
 */
async function getArchivedStudy(field: { latitude: number; longitude: number }, signal?: AbortSignal): Promise<SoilFetchResult | null> {
  const isCastelnaudary = field.longitude >= 1.93 && field.longitude <= 1.97 &&
    field.latitude >= 43.29 && field.latitude <= 43.33;
  if (!isCastelnaudary) return null;
  try {
    const response = await fetch('/geo/soil_intelligence_castelnaudary.json', { signal });
    if (!response.ok) return null;
    const snapshot = await response.json();
    const soilData = snapshot.inputs?.soil;
    if (!snapshot.rusle_baseline || !snapshot.vulnerability_index ||
        !Number.isFinite(snapshot.rusle_baseline.soil_loss_t_ha_yr)) return null;

    const risk: SoilRiskResponse = {
      coverage: 'single_study_area_archived_calculation',
      model_version: snapshot.model_version,
      equation: snapshot.rusle_baseline.equation,
      study_area: snapshot.study_area,
      vulnerability_index: snapshot.vulnerability_index,
      rusle_baseline: snapshot.rusle_baseline,
      scenarios: snapshot.scenarios,
      uncertainty_range: snapshot.uncertainty_range,
      assumptions: snapshot.assumptions,
      sources: (snapshot.sources || []).map((source: string) => ({ source })),
      generated_at_utc: snapshot.generated_at_utc,
      disclaimer: "Étude RUSLE réellement exécutée et archivée pour Castelnaudary, calcul préalablement aux requêtes de cette application. Les résultats décrivent cette zone d'étude, et non des mesures directes de cette parcelle."
    };
    const soil: SoilPropertiesResponse | null = soilData ? {
      modelled: [{
        depth_cm: '0-5',
        clay_pct: soilData.clay_pct,
        sand_pct: soilData.sand_pct,
        silt_pct: soilData.silt_pct,
        ph_h2o: soilData.ph_h2o,
        soil_organic_carbon_g_per_kg: typeof soilData.oc_0_5_pct === 'number'
          ? Number((soilData.oc_0_5_pct * 10).toFixed(1)) : null,
        provenance: { source: 'ISRIC SoilGrids 2.0 (archive de calcul)', resolution: '250 m', uncertainty: 'Estimation géospatiale régionale' }
      }]
    } : null;
    return { status: 'ok', risk, soil };
  } catch {
    return null;
  }
}


async function errorDetail(res: Response): Promise<{ code?: string; message?: string }> {
  try {
    const body = await res.json();
    const d = body?.detail ?? body;
    return typeof d === 'object' && d ? { code: d.error, message: d.message } : { message: String(d) };
  } catch {
    return {};
  }
}

export async function fetchSoilIntelligence(
  field: { id: string; latitude: number; longitude: number },
  signal?: AbortSignal
): Promise<SoilFetchResult> {
  if (!isBackendConfigured()) {
    return (await getArchivedStudy(field, signal)) ||
      { status: 'unavailable', message: "L'API n'est pas configurée sur cette version." };
  }
  try {
    const riskRes = await fetch(`${base()}/geo/soil-risk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: { field_id: field.id, latitude: field.latitude, longitude: field.longitude },
        exposure: {},
      }),
      signal,
    });
    if (riskRes.status === 404 || riskRes.status === 405) {
      const archived = await getArchivedStudy(field, signal);
      if (archived) return archived;
      return {
        status: 'unavailable',
        message: "Le modèle de sol n'est pas encore déployé sur l'API utilisée.",
      };
    }
    if (riskRes.status === 422) {
      const d = await errorDetail(riskRes);
      return {
        status: 'out_of_coverage',
        message: d.message || "Cette parcelle est hors de la zone d'étude validée (Castelnaudary).",
      };
    }
    if (!riskRes.ok) {
      const archived = await getArchivedStudy(field, signal);
      return archived || { status: 'error', message: `Erreur de l'API (HTTP ${riskRes.status}).` };
    }
    const risk = (await riskRes.json()) as SoilRiskResponse;

    let soil: SoilPropertiesResponse | null = null;
    try {
      const soilRes = await fetch(`${base()}/geo/soil?lat=${field.latitude}&lon=${field.longitude}`, { signal });
      if (soilRes.ok) soil = (await soilRes.json()) as SoilPropertiesResponse;
    } catch {
      /* texture is optional: the risk block stands on its own */
    }
    return { status: 'ok', risk, soil };
  } catch (err) {
    if (signal?.aborted) return { status: 'error', message: 'Requête interrompue.' };
    const archived = await getArchivedStudy(field, signal);
    if (archived) return archived;
    return { status: 'error', message: err instanceof Error ? err.message : 'Réseau indisponible.' };
  }
}
