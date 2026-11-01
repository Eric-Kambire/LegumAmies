/**
 * Flowering heat exposure, computed from REAL hourly temperatures.
 *
 * Nothing here estimates plant damage, yield or money. The only derived quantity is
 * "number of forecast hours above the published threshold" (an exposure count) and the
 * time spans where that happens.
 */
import type { CropGrowthStage, SelectedField } from '../types/agricultural';
import type { AssessResponse, RiskAlert } from '../types/backend-contract';
import type { LocationWeatherData } from '../types/weather';
import { getSourcedFloweringHeat } from '../data/sourcedAgronomy';
import { getCropNameFr, getGrowthStageFr } from './agriRiskService';

export interface HourPoint {
  /** Absolute instant (used for windowing only). */
  at: Date;
  /** Local calendar day at the forecast location, YYYY-MM-DD (read from the API string, not the browser clock). */
  localDay: string;
  /** Local hour at the forecast location, 0-23. */
  localHour: number;
  temp: number;
}

export interface HeatThreshold {
  value: number;
  operator: 'gt';
  institution: string;
  sourceUrl?: string;
  validationStatus: string;
  minimumExposureHours?: number;
  origin: 'backend_alert' | 'sourced_table';
}

export type ThresholdResolution =
  | { kind: 'threshold'; threshold: HeatThreshold }
  | { kind: 'none'; reason: string };

export interface ExposureSpan {
  startIndex: number;
  endIndex: number;
  hours: number;
  maxTemp: number;
}

export interface HeatExposure {
  hoursAbove: number;
  spans: ExposureSpan[];
  maxTemp: number;
  maxIndex: number;
  minTemp: number;
}

const LOCAL_ISO = /^(\d{4}-\d{2}-\d{2})T(\d{2})/;

function toPoint(iso: string, utcIso: string | undefined, temp: number | null | undefined): HourPoint | null {
  if (temp === null || temp === undefined || Number.isNaN(temp)) return null;
  const m = LOCAL_ISO.exec(iso);
  const at = new Date(iso);
  if (!m || Number.isNaN(at.getTime())) {
    const fallback = utcIso ? new Date(utcIso) : null;
    if (!fallback || Number.isNaN(fallback.getTime())) return null;
    return {
      at: fallback,
      localDay: fallback.toISOString().slice(0, 10),
      localHour: fallback.getUTCHours(),
      temp,
    };
  }
  return { at, localDay: m[1], localHour: Number(m[2]), temp };
}

/** Hourly 2 m temperatures exactly as returned by `/assess` (`weather.hourly`). */
export function hourlyFromBackend(resp: AssessResponse | null): HourPoint[] {
  if (!resp?.weather?.hourly) return [];
  return resp.weather.hourly
    .map((h) => toPoint(h.valid_time_local, h.valid_time_utc, h.temperature_c))
    .filter((p): p is HourPoint => p !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Fallback when the API is unreachable: Open-Meteo hourly temperatures (clearly labelled by the caller). */
export function hourlyFromOpenMeteo(weather: LocationWeatherData | null): HourPoint[] {
  if (!weather?.hourly) return [];
  return weather.hourly
    .map((h) => {
      const m = LOCAL_ISO.exec(h.time);
      const at = new Date(h.time);
      if (!m || Number.isNaN(at.getTime())) return null;
      return { at, localDay: m[1], localHour: Number(m[2]), temp: h.temperature } as HourPoint;
    })
    .filter((p): p is HourPoint => p !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Next `horizonHours` points starting from the hour that contains `now`. */
export function selectWindow(points: HourPoint[], horizonHours: number, now: Date): HourPoint[] {
  if (points.length === 0) return [];
  const startAfter = now.getTime() - 59 * 60 * 1000;
  let start = points.findIndex((p) => p.at.getTime() >= startAfter);
  if (start < 0) start = Math.max(0, points.length - horizonHours); // forecast fully in the past: show its tail
  return points.slice(start, start + horizonHours);
}

export function computeExposure(window: HourPoint[], thresholdValue: number | null): HeatExposure {
  let maxTemp = -Infinity;
  let minTemp = Infinity;
  let maxIndex = 0;
  window.forEach((p, i) => {
    if (p.temp > maxTemp) {
      maxTemp = p.temp;
      maxIndex = i;
    }
    if (p.temp < minTemp) minTemp = p.temp;
  });

  const spans: ExposureSpan[] = [];
  let hoursAbove = 0;
  if (thresholdValue !== null) {
    let current: ExposureSpan | null = null;
    window.forEach((p, i) => {
      if (p.temp > thresholdValue) {
        hoursAbove += 1;
        if (current) {
          current.endIndex = i;
          current.hours += 1;
          current.maxTemp = Math.max(current.maxTemp, p.temp);
        } else {
          current = { startIndex: i, endIndex: i, hours: 1, maxTemp: p.temp };
          spans.push(current);
        }
      } else {
        current = null;
      }
    });
  }
  return {
    hoursAbove,
    spans,
    maxTemp: window.length ? maxTemp : NaN,
    minTemp: window.length ? minTemp : NaN,
    maxIndex,
  };
}

/**
 * Which published threshold applies to this crop AND stage.
 * 1. a heat_stress alert from the API carries its own threshold and source;
 * 2. otherwise the sourced table, valid for the flowering stage only;
 * 3. otherwise there is no validated threshold, and the UI must say so.
 */
export function resolveHeatThreshold(field: SelectedField, alerts: RiskAlert[] | undefined): ThresholdResolution {
  const heat = alerts?.find((a) => a.hazard_type === 'heat_stress' && a.weather_variable.includes('temp'));
  if (heat) {
    return {
      kind: 'threshold',
      threshold: {
        value: heat.threshold_value,
        operator: 'gt',
        institution: 'Terres Inovia',
        sourceUrl: heat.source_url,
        validationStatus: heat.validation_status,
        minimumExposureHours: heat.minimum_exposure_hours,
        origin: 'backend_alert',
      },
    };
  }

  const sourced = getSourcedFloweringHeat(field.cropType);
  const crop = getCropNameFr(field.cropType).toLowerCase();
  if (!sourced) {
    return { kind: 'none', reason: `Aucun seuil de chaleur publié n'est disponible pour le ${crop}. Aucun dépassement n'est calculé.` };
  }
  const floweringStage: CropGrowthStage = 'floraison';
  if (field.growthStage !== floweringStage) {
    return {
      kind: 'none',
      reason: `Le seuil publié pour le ${crop} (${sourced.tmaxC} °C) concerne la floraison. La parcelle est au stade « ${getGrowthStageFr(field.growthStage)} » : aucun dépassement n'est calculé.`,
    };
  }
  return {
    kind: 'threshold',
    threshold: {
      value: sourced.tmaxC,
      operator: 'gt',
      institution: sourced.institution,
      sourceUrl: sourced.sourceUrl,
      validationStatus: 'published',
      origin: 'sourced_table',
    },
  };
}
