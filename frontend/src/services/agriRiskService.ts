import type { AgriculturalRiskAlert, CropGrowthStage, LegumeCropType } from '../types/agricultural';
import type { LocationWeatherData } from '../types/weather';

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

  // 1. Risque Chaleur Floraison
  if (growthStage === 'floraison') {
    const heatThreshold = (cropType === 'soja' || cropType === 'pois_chiche') ? 32 : 28;
    if (maxTemp >= heatThreshold + 3) {
      alerts.push({
        id: 'heat_critical',
        type: 'floraison_chaleur',
        severity: 'critique',
        title: 'Canicule & Avortement Floral',
        description: `Température prévue à ${maxTemp}°C (seuil critique : ${heatThreshold}°C). Risque majeur de stérilité pollinique sur ${getCropNameFr(cropType)}.`,
        recommendation: 'Maintenir la fraîcheur foliaire si irrigation possible, éviter tout passage mécanique de pulvérisation en pleine journée.',
        metricValue: `${maxTemp}°C`,
        triggerThreshold: `> ${heatThreshold}°C`,
      });
    } else if (maxTemp >= heatThreshold) {
      alerts.push({
        id: 'heat_vigilance',
        type: 'floraison_chaleur',
        severity: 'alerte',
        title: 'Stress Thermique en Floraison',
        description: `Pic de température à ${maxTemp}°C aujourd'hui. Les fleurs de ${getCropNameFr(cropType)} sont sous tension.`,
        recommendation: 'Surveiller la nouaison des premières gousses en fin de semaine.',
        metricValue: `${maxTemp}°C`,
        triggerThreshold: `≥ ${heatThreshold}°C`,
      });
    }
  }

  // 2. Fenêtre de Pulvérisation / Traitement (Réglementation française : vent < 19 km/h)
  if (windSpeed >= 19 || windGusts >= 25) {
    alerts.push({
      id: 'spray_forbidden',
      type: 'pulverisation_vent',
      severity: 'alerte',
      title: 'Pulvérisation Interdite (Vent > 19 km/h)',
      description: `Vent mesuré à ${windSpeed} km/h (rafales à ${windGusts} km/h). Dépassement du seuil légal français (Arrêté du 4 mai 2017) pour la dérive de pulvérisation.`,
      recommendation: 'Reporter tout traitement phytosanitaire ou apport foliaire. Fenêtre favorable possible en fin de journée ou aube.',
      metricValue: `${windSpeed} km/h`,
      triggerThreshold: '≥ 19 km/h',
    });
  } else if (windSpeed < 12 && humidity >= 60 && rainNextHours === 0) {
    alerts.push({
      id: 'spray_optimal',
      type: 'pulverisation_vent',
      severity: 'favorable',
      title: 'Créneau de Pulvérisation Optimal',
      description: `Vent calme (${windSpeed} km/h), hygrométrie favorable (${humidity}%) et absence de pluie dans les prochaines heures.`,
      recommendation: 'Conditions idéales pour l’efficacité des traitements sans dérive.',
      metricValue: `${windSpeed} km/h / ${humidity}%`,
      triggerThreshold: '< 15 km/h',
    });
  }

  // 3. Risque Récolte & Humidité du grain
  if (growthStage === 'pret_recolter') {
    if (rainNextHours > 0.5 || current.precipitation > 0) {
      alerts.push({
        id: 'harvest_rain',
        type: 'humidite_recolte',
        severity: 'critique',
        title: 'Chantier de Récolte Impossible (Pluie)',
        description: `Précipitations en cours ou imminentes (${rainNextHours.toFixed(1)} mm). Taux d'humidité grain en forte hausse (> 17%).`,
        recommendation: 'Arrêt impératif des batteuses pour éviter le colmatage et les fortes pénalités de séchage en coopérative.',
        metricValue: `${rainNextHours.toFixed(1)} mm`,
        triggerThreshold: '> 0.5 mm',
      });
    } else if (humidity > 75) {
      alerts.push({
        id: 'harvest_high_moisture',
        type: 'humidite_recolte',
        severity: 'vigilance',
        title: 'Humidité de l\'Air Élevée',
        description: `Hygrométrie à ${humidity}%. La dessiccation du grain est ralentie.`,
        recommendation: 'Attendre le début d\'après-midi que le soleil et la brise fassent baisser l\'humidité sous 15%.',
        metricValue: `${humidity}%`,
        triggerThreshold: '> 75%',
      });
    } else if (maxTemp > 30 && humidity < 35) {
      // 4. Risque Égrenage (Pod shattering)
      alerts.push({
        id: 'pod_shattering',
        type: 'egrenage',
        severity: 'alerte',
        title: 'Risque d\'Égrenage au Sol Élevé',
        description: `Temps très sec (${humidity}%) et forte chaleur (${maxTemp}°C). Les gousses sont ultra-cassantes et risquent d'exploser au passage de la barre de coupe.`,
        recommendation: 'Privilégier la moisson en matinée ou en soirée dès que l\'hygrométrie remonte légèrement (autour de 50%).',
        metricValue: `${humidity}% / ${maxTemp}°C`,
        triggerThreshold: '< 35% hum.',
      });
    } else {
      alerts.push({
        id: 'harvest_window_open',
        type: 'humidite_recolte',
        severity: 'favorable',
        title: 'Fenêtre de Moisson Favorable',
        description: `Grain sec (humidité estimée 13-15%), temps stable et vent modéré.`,
        recommendation: 'Conditions optimales pour battre sans surcoût de séchage.',
        metricValue: `${humidity}% hum.`,
        triggerThreshold: '13-15% grain',
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
