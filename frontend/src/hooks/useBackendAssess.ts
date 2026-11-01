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

function formatMetricWithUnit(value: number, variable: string): string {
  const v = (variable || '').toLowerCase();
  if (v.includes('temp') || v.includes('frost') || v.includes('gel') || v.includes('heat') || v.includes('chaleur')) {
    return `${value}°C`;
  }
  if (v.includes('rain') || v.includes('precip') || v.includes('eau') || v.includes('pluie')) {
    return `${value} mm`;
  }
  if (v.includes('wind') || v.includes('vent') || v.includes('speed') || v.includes('rafale')) {
    return `${value} km/h`;
  }
  if (v.includes('humid') || v.includes('rh') || v.includes('pct') || v.includes('%')) {
    return `${value}%`;
  }
  return `${value}`;
}

function mapRiskAlert(a: RiskAlert): AgriculturalRiskAlert {
  const severity: RiskSeverity =
    a.validation_status === 'published' ? 'alerte' : 'vigilance';
  const valWithUnit = formatMetricWithUnit(a.observed_value, a.weather_variable);
  const thresholdWithUnit = formatMetricWithUnit(a.threshold_value, a.weather_variable);
  const opSymbol = a.comparison_operator === 'gt' ? '>' : '<';
  return {
    id: `be_${a.hazard_type}_${a.forecast_start_local}`,
    type: HAZARD_TO_TYPE[a.hazard_type] ?? 'floraison_chaleur',
    title: `${a.hazard_type.replace(/_/g, ' ')} (seuil ${a.validation_status})`,
    severity,
    description:
      `Valeur prévue (modèle) : ${valWithUnit} ${opSymbol} seuil ${thresholdWithUnit} ` +
      `(${a.weather_variable}), du ${a.forecast_start_local} au ${a.forecast_end_local}. ` +
      `Alerte de risque météo, pas une prédiction de dégât avéré.`,
    recommendation: 'Consulter la source et confirmer au champ.',
    metricValue: valWithUnit,
    triggerThreshold: `${opSymbol} ${thresholdWithUnit}`,
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
      title: `Vent > ${firstBlocked.threshold_kmh} km/h (pulvérisation non conforme)`,
      description:
        `Vent max prévu ${firstBlocked.max_wind_speed_kmh} km/h le ${firstBlocked.date_local}. ` +
        `${firstBlocked.source}.`,
      recommendation:
        'Arrêté du 4 mai 2017 : tout traitement est interdit si le vent dépasse 19 km/h (3 Beaufort). Vérifier également hygrométrie, rosée, ZNT et DSR.',
      metricValue: `${firstBlocked.max_wind_speed_kmh} km/h`,
      triggerThreshold: `> ${firstBlocked.threshold_kmh} km/h`,
    },
  ];
}

/**
 * Fetches the live backend assessment for a field.
 * Handles field switching and prevents stale data by resetting state on change.
 */
export function useBackendAssess(field: SelectedField | null): {
  status: BackendStatus;
  alerts: AgriculturalRiskAlert[];
  response: AssessResponse | null;
} {
  const [status, setStatus] = useState<BackendStatus>(() =>
    isBackendConfigured() ? 'loading' : 'disabled'
  );
  const [alerts, setAlerts] = useState<AgriculturalRiskAlert[]>([]);
  const [response, setResponse] = useState<AssessResponse | null>(null);

  // Synchronously reset state during render when field changes to prevent stale data display
  const [prevFieldKey, setPrevFieldKey] = useState<string | null>(null);
  const currentFieldKey = field
    ? `${field.id}_${field.latitude}_${field.longitude}_${field.cropType}_${field.growthStage}`
    : null;

  if (prevFieldKey !== currentFieldKey) {
    setPrevFieldKey(currentFieldKey);
    setAlerts([]);
    setResponse(null);
    if (!isBackendConfigured() || !field) {
      setStatus(isBackendConfigured() ? 'loading' : 'disabled');
    } else {
      setStatus('loading');
    }
  }

  useEffect(() => {
    if (!isBackendConfigured() || !field) {
      return;
    }

    const controller = new AbortController();

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
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.warn('Backend /assess unavailable, using client-side fallback:', err);
        setStatus('error');
      });

    return () => controller.abort();
    // Depend on the stable request-defining key (id + coords + crop + stage),
    // not the field object reference. App mutates the field object on mount
    // (reverse-geocoded commune/department) which previously re-fired an
    // identical /assess request. Keying on the scalar signature dedupes it
    // while still refetching when a relevant attribute actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFieldKey]);

  return { status, alerts, response };
}
