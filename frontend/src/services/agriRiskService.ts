import type { AgriculturalRiskAlert, CropGrowthStage, LegumeCropType } from '../types/agricultural';
import type { LocationWeatherData } from '../types/weather';
import {
  getSourcedFloweringHeat,
  SPRAYING_WIND_LIMIT_KMH,
  SPRAYING_SOURCE,
} from '../data/sourcedAgronomy';

/**
 * Client-side risk screening used when the backend API is not configured
 * (offline / first deploy). It emits ONLY alerts backed by a published source
 * or a real regulation. It never invents agronomic thresholds, grain-moisture
 * percentages, pod-shattering probabilities, yield or economic figures.
 *
 * When VITE_API_BASE_URL is set, the app should prefer the backend /assess
 * response (see services/legumamiesApi.ts), which carries full provenance.
 */
export function evaluateAgronomicRisks(
  cropType: LegumeCropType,
  growthStage: CropGrowthStage,
  weather: LocationWeatherData
): AgriculturalRiskAlert[] {
  const alerts: AgriculturalRiskAlert[] = [];
  const current = weather.current;
  const today = weather.daily[0];
  const maxTemp = today ? today.temperatureMax : current.temperature;
  const windSpeed = current.windSpeed;
  const windGusts = current.windGusts;
  const humidity = current.relativeHumidity;
  const rainNextHours = weather.hourly.slice(0, 3).reduce((sum, h) => sum + h.precipitation, 0);

  // 1. Flowering heat stress — ONLY for crops with a published threshold.
  if (growthStage === 'floraison') {
    const sourced = getSourcedFloweringHeat(cropType);
    if (sourced && maxTemp >= sourced.tmaxC) {
      alerts.push({
        id: 'heat_flowering',
        type: 'floraison_chaleur',
        severity: 'alerte',
        title: 'Stress thermique en floraison',
        description:
          `Température maximale prévue ${Math.round(maxTemp)}°C, au-dessus du seuil publié de ` +
          `${sourced.tmaxC}°C pour ${getCropNameFr(cropType)} (${sourced.institution}). ` +
          `Il s'agit d'une alerte de risque, pas d'une prédiction de dégât.`,
        recommendation:
          'Surveiller la nouaison des gousses. Éviter les interventions mécaniques aux heures les plus chaudes.',
        metricValue: `${Math.round(maxTemp)}°C`,
        triggerThreshold: `≥ ${sourced.tmaxC}°C`,
        whyExplanation: `${sourced.noteFr} Source : ${sourced.institution} — ${sourced.sourceUrl}`,
      });
    }
    // Crops without a sourced threshold intentionally produce no heat alert here.
  }

  // 2. Spraying window — real French regulation (Arrêté du 4 mai 2017).
  if (windSpeed >= SPRAYING_WIND_LIMIT_KMH || windGusts >= 25) {
    alerts.push({
      id: 'spray_forbidden',
      type: 'pulverisation_vent',
      severity: 'alerte',
      title: `Pulvérisation interdite (vent ≥ ${SPRAYING_WIND_LIMIT_KMH} km/h)`,
      description:
        `Vent mesuré ${Math.round(windSpeed)} km/h (rafales ${Math.round(windGusts)} km/h). ` +
        `Seuil réglementaire français dépassé (${SPRAYING_SOURCE.label}).`,
      recommendation:
        'Reporter tout traitement phytosanitaire. Fenêtre souvent plus favorable en fin de journée ou à l’aube.',
      metricValue: `${Math.round(windSpeed)} km/h`,
      triggerThreshold: `≥ ${SPRAYING_WIND_LIMIT_KMH} km/h`,
      whyExplanation: `${SPRAYING_SOURCE.institution} — ${SPRAYING_SOURCE.label}`,
    });
  } else if (windSpeed < 12 && rainNextHours === 0) {
    alerts.push({
      id: 'spray_window_ok',
      type: 'pulverisation_vent',
      severity: 'favorable',
      title: 'Vent compatible avec la pulvérisation',
      description:
        `Vent faible (${Math.round(windSpeed)} km/h) et pas de pluie imminente : conditions de vent ` +
        `conformes au seuil réglementaire (< ${SPRAYING_WIND_LIMIT_KMH} km/h).`,
      recommendation: 'Vérifier les autres conditions réglementaires (ZNT, hygrométrie) avant tout traitement.',
      metricValue: `${Math.round(windSpeed)} km/h`,
      triggerThreshold: `< ${SPRAYING_WIND_LIMIT_KMH} km/h`,
    });
  }

  // 3. Harvest window — rain-based only. No fabricated grain-moisture values.
  if (growthStage === 'pret_recolter') {
    if (rainNextHours > 0.5 || current.precipitation > 0) {
      alerts.push({
        id: 'harvest_rain',
        type: 'humidite_recolte',
        severity: 'alerte',
        title: 'Pluie défavorable à la récolte',
        description:
          `Précipitations en cours ou imminentes (${rainNextHours.toFixed(1)} mm prévus sur ~3 h). ` +
          `L'humidité du grain n'est pas mesurée par l'application.`,
        recommendation:
          'Décaler le chantier de récolte vers une fenêtre sèche. Confirmer la maturité et l’humidité du grain au champ.',
        metricValue: `${rainNextHours.toFixed(1)} mm`,
        triggerThreshold: '> 0.5 mm (3 h)',
        whyExplanation:
          'Fenêtre évaluée uniquement sur la pluie prévue (prévision météo). Indicateur météo provisoire, ' +
          'pas une mesure d’humidité du grain ni de la portance du sol.',
      });
    } else {
      alerts.push({
        id: 'harvest_dry_window',
        type: 'humidite_recolte',
        severity: 'favorable',
        title: 'Fenêtre sèche pour la récolte',
        description:
          `Pas de pluie prévue dans les prochaines heures (humidité de l'air ${Math.round(humidity)}%). ` +
          `Indicateur météo uniquement : l'humidité du grain n'est pas mesurée.`,
        recommendation: 'Vérifier la maturité et l’humidité réelle du grain au champ avant de battre.',
        metricValue: `${Math.round(humidity)}% hum. air`,
        triggerThreshold: '0 mm pluie prévue',
        whyExplanation:
          'Fenêtre évaluée uniquement sur la pluie prévue. Indicateur météo provisoire, non agronomiquement validé.',
      });
    }
  }

  return alerts;
}

export function getCropNameFr(crop: LegumeCropType): string {
  switch (crop) {
    case 'soja': return 'Soja';
    case 'feverole': return 'Féverole';
    case 'pois_chiche': return 'Pois chiche';
    case 'pois': return 'Pois protéagineux';
    case 'lentille': return 'Lentille';
    case 'lupin': return 'Lupin';
    case 'haricot_sec': return 'Haricot sec';
  }
}

export function getGrowthStageFr(stage: CropGrowthStage): string {
  switch (stage) {
    case 'vegetatif': return 'Végétatif';
    case 'floraison': return 'Floraison';
    case 'formation_gousses': return 'Formation des gousses';
    case 'remplissage_grain': return 'Remplissage du grain';
    case 'pret_recolter': return 'Prêt à récolter';
  }
}
