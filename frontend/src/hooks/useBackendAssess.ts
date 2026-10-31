import { useEffect, useState } from 'react';
import type { SelectedField, AgriculturalRiskAlert, RiskSeverity } from '../types/agricultural';
import type { AssessResponse, RiskAlert } from '../types/backend-contract';
import { assess, isBackendConfigured } from '../services/legumamiesApi';

export type BackendStatus = 'disabled' | 'loading' | 'ok' | 'error';

const HAZARD_TO_TYPE: Record<string, AgriculturalRiskAlert['type']> = {
  heat_stress: 'floraison_chaleur',
  frost: 'gel_tardif',
  excess_rain: 'humidite_recolte',
  wet_harvest: 'humidite_recolte',
};

function mapRiskAlert(a: RiskAlert): AgriculturalRiskAlert {
  const severity: RiskSeverity =
    a.validation_status === 'published' ? 'alerte' : 'vigilance';
  return {
    id: `be_${a.hazard_type}_${a.forecast_start_local}`,
    type: HAZARD_TO_TYPE[a.hazard_type] ?? 'floraison_chaleur',
    title: `${a.hazard_type.replace('_', ' ')} (seuil ${a.validation_status})`,
    severity,
    description:
      `Observé ${a.observed_value} ${a.comparison_operator} seuil ${a.threshold_value} ` +
      `(${a.weather_variable}), du ${a.forecast_start_local} au ${a.forecast_end_local}. ` +
      `Alerte de risque sourcée, pas une prédiction de dégât.`,
    recommendation: 'Consulter la source et confirmer au champ.',
    metricValue: `${a.observed_value}`,
    triggerThreshold: `${a.comparison_operator} ${a.threshold_value}`,
    whyExplanation: `Source : ${a.source_url} (${a.validation_status}).`,
  };
}

function regulatoryAlerts(resp: AssessResponse): AgriculturalRiskAlert[] {
  const firstBlocked = resp.regulatory_windows.find((w) => !w.spraying_allowed);
  if (!firstBlocked) return [];
  return [
    {
      id: `be_spray_${firstBlocked.date_local}`,
      type: 'pulverisation_vent',
      severity: 'alerte',
      title: `Pulvérisation interdite (vent ≥ ${firstBlocked.threshold_kmh} km/h)`,
      description:
        `Vent max prévu ${firstBlocked.max_wind_speed_kmh} km/h le ${firstBlocked.date_local}. ` +
        `${firstBlocked.source}.`,
      recommendation: 'Reporter tout traitement phytosanitaire vers une fenêtre moins ventée.',
      metricValue: `${firstBlocked.max_wind_speed_kmh} km/h`,
      triggerThreshold: `≥ ${firstBlocked.threshold_kmh} km/h`,
    },
  ];
}

/**
 * Fetches the live backend assessment for a field. Returns backend-derived
 * alerts + status. On any failure or when the backend is not configured,
 * status is 'disabled'/'error' and callers should fall back to the sourced
 * client-side screening.
 */
export function useBackendAssess(field: SelectedField | null): {
  status: BackendStatus;
  alerts: AgriculturalRiskAlert[];
  response: AssessResponse | null;
} {
  const [status, setStatus] = useState<BackendStatus>(
    isBackendConfigured() ? 'loading' : 'disabled'
  );
  const [alerts, setAlerts] = useState<AgriculturalRiskAlert[]>([]);
  const [response, setResponse] = useState<AssessResponse | null>(null);

  useEffect(() => {
    if (!isBackendConfigured() || !field) {
      setStatus(isBackendConfigured() ? 'loading' : 'disabled');
      return;
    }
    const controller = new AbortController();
    setStatus('loading');
    assess(
      {
        latitude: field.latitude,
        longitude: field.longitude,
        crop: field.cropType,
        growth_stage: field.growthStage,
        harvest_ready: field.growthStage === 'pret_recolter',
        field_name: field.name,
      },
      controller.signal
    )
      .then((resp) => {
        setResponse(resp);
        setAlerts([...resp.risk.alerts.map(mapRiskAlert), ...regulatoryAlerts(resp)]);
        setStatus('ok');
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.warn('Backend /assess unavailable, using client-side fallback:', err);
        setStatus('error');
      });
    return () => controller.abort();
  }, [field?.id, field?.latitude, field?.longitude, field?.cropType, field?.growthStage]);

  return { status, alerts, response };
}
