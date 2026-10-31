import type {
  AgriculturalNotification,
  SelectedField,
  LegumeCropType,
} from '../types/agricultural';
import { getCropNameFr, getGrowthStageFr } from './agriRiskService';

/**
 * Duolingo-style behavioral notification generator for French legume farmers.
 * Converts cold weather numbers into high-engagement, empathetic, streak-driven nudges.
 * Strictly 0 emoji - uses professional iOS typography and SVG vector glyphs.
 */

export interface DuoStreakInfo {
  currentStreakDays: number;
  bestStreakDays: number;
  streakFrozenToday: boolean;
  weeklyHistory: Array<{ day: string; active: boolean; isToday: boolean }>;
}

export const DEFAULT_STREAK: DuoStreakInfo = {
  currentStreakDays: 8,
  bestStreakDays: 14,
  streakFrozenToday: false,
  weeklyHistory: [
    { day: 'Lun', active: true, isToday: false },
    { day: 'Mar', active: true, isToday: false },
    { day: 'Mer', active: true, isToday: false },
    { day: 'Jeu', active: true, isToday: false },
    { day: 'Ven', active: true, isToday: false },
    { day: 'Sam', active: true, isToday: false },
    { day: 'Dim', active: true, isToday: false },
    { day: 'Auj', active: true, isToday: true },
  ],
};

/**
 * Builds realistic Duolingo-style notifications tailored to the crops currently present on the farm.
 */
export function generateDuolingoNotificationsForFields(
  fields: SelectedField[]
): AgriculturalNotification[] {
  const notifs: AgriculturalNotification[] = [];

  fields.forEach((field, idx) => {
    const cropName = getCropNameFr(field.cropType);
    const stageName = getGrowthStageFr(field.growthStage);
    const area = field.areaHectares || 15;

    switch (field.cropType) {
      case 'pois_chiche':
        notifs.push({
          id: `duo_pois_chiche_${field.id}`,
          title: `Série 8j : Vos pois chiches comptent sur vous !`,
          message: `Attention à ${field.commune || 'votre parcelle'} : 29°C prévus cet après-midi en plein ${stageName}. Ne laissez pas le stress thermique impacter ${area} ha. 30 secondes pour vérifier le pic de chaleur.`,
          category: 'weather_risk',
          severity: 'critical',
          fieldId: field.id,
          fieldName: field.name,
          cropType: field.cropType,
          growthStage: field.growthStage,
          timestamp: 'Il y a 25 min',
          isRead: false,
          actionLabel: 'Protéger la floraison',
          actionDestination: 'insights',
          streakDays: 8,
          duoTone: 'loss_aversion',
          duoTag: 'Aversion à la perte',
          economicImpact: `${area} ha`,
        });
        break;

      case 'feverole':
        notifs.push({
          id: `duo_feverole_${field.id}`,
          title: `Fenêtre de tir express sur vos féveroles !`,
          message: `Le vent tombe sous 12 km/h à ${field.commune || 'Chartres'} jusqu'à 11h30. Vos féveroles en ${stageName} nécessitent votre intervention : créneau idéal pour traiter sans dérive.`,
          category: 'weather_risk',
          severity: 'warning',
          fieldId: field.id,
          fieldName: field.name,
          cropType: field.cropType,
          growthStage: field.growthStage,
          timestamp: 'Il y a 2h',
          isRead: false,
          actionLabel: 'Voir le créneau de vent',
          actionDestination: 'weather',
          streakDays: 8,
          duoTone: 'urgent',
          duoTag: 'Fenêtre météo 2h',
          economicImpact: `${area} ha protégés`,
        });
        break;

      case 'lentille':
        notifs.push({
          id: `duo_lentille_${field.id}`,
          title: `Votre batteuse dort encore ?`,
          message: `Fenêtre sèche annoncée sur vos lentilles à ${field.commune || 'Châteauroux'} avant les pluies du week-end. Vérifiez la maturité et l'humidité réelle du grain au champ.`,
          category: 'harvest_window',
          severity: 'info',
          fieldId: field.id,
          fieldName: field.name,
          cropType: field.cropType,
          growthStage: field.growthStage,
          timestamp: 'Il y a 3h',
          isRead: false,
          actionLabel: 'Lancer la récolte',
          actionDestination: 'insights',
          streakDays: 8,
          duoTone: 'playful',
          duoTag: 'Moisson imminente',
          economicImpact: `${area} ha`,
        });
        break;

      default:
        // Generic fallback for any other crop (soja, pois, lupin, haricot)
        notifs.push({
          id: `duo_crop_${field.id}_${idx}`,
          title: `Point de vigilance : maintenez votre série active !`,
          message: `Vos ${area} ha de ${cropName} (${stageName}) à ${field.commune || 'France'} se portent bien. 15 secondes pour valider les conditions du jour et maintenir votre série de 8 jours.`,
          category: 'stage_update',
          severity: 'info',
          fieldId: field.id,
          fieldName: field.name,
          cropType: field.cropType,
          growthStage: field.growthStage,
          timestamp: 'Hier',
          isRead: true,
          actionLabel: 'Valider l\'observation',
          actionDestination: 'fields',
          streakDays: 8,
          duoTone: 'streak_shield',
          duoTag: 'Série maintenue',
          economicImpact: `${area} ha suivis`,
        });
        break;
    }
  });

  // Signature Duolingo evening streak accountability check-in
  notifs.push({
    id: 'duo_streak_evening_checkin',
    title: `Duo Agri : Votre série de 8 jours expire ce soir`,
    message: `Prenez 20 secondes pour consulter le bulletin agronomique de vos ${fields.length} parcelles. La régularité de surveillance est la clé des meilleurs rendements.`,
    category: 'briefing',
    severity: 'info',
    timestamp: 'À l\'instant',
    isRead: false,
    actionLabel: 'Consulter le bulletin',
    actionDestination: 'weather',
    streakDays: 8,
    duoTone: 'streak_shield',
    duoTag: 'Rappel de série',
    economicImpact: `${fields.reduce((acc, f) => acc + (f.areaHectares || 0), 0)} ha totaux`,
  });

  return notifs;
}

/**
 * Preset simulations for testing Duolingo notification styles on demand.
 * 100% vector SVG icons, zero stickers, zero emojis.
 */
export const DUO_SIMULATION_PRESETS: Array<{
  id: string;
  name: string;
  tone: 'urgent' | 'loss_aversion' | 'playful' | 'streak_shield';
  cropType: LegumeCropType;
  notification: Omit<AgriculturalNotification, 'id' | 'timestamp' | 'isRead'>;
}> = [
  {
    id: 'sim_heat_abortion',
    name: 'Alerte Canicule (Pois chiche)',
    tone: 'loss_aversion',
    cropType: 'pois_chiche',
    notification: {
      title: 'Série de 8j : Ne laissez pas vos pois chiches brûler !',
      message: 'Forte chaleur annoncée à Castelnaudary cet après-midi. Ouvrez l\'analyse pour vérifier le pic de température sur vos parcelles et adapter vos interventions. (Notification de démonstration)',
      category: 'weather_risk',
      severity: 'critical',
      actionLabel: 'Sauver les fleurs',
      actionDestination: 'insights',
      streakDays: 8,
      duoTone: 'loss_aversion',
      duoTag: 'Vigilance chaleur',
      economicImpact: 'Démonstration',
    },
  },
  {
    id: 'sim_wind_window',
    name: 'Créneau Pulvérisation (Féverole)',
    tone: 'urgent',
    cropType: 'feverole',
    notification: {
      title: 'Créneau express : Le vent tombe en Beauce !',
      message: 'Vent mesuré à 10 km/h jusqu\'à 11h15, avant rafales à 26 km/h. Vos 24 ha de féveroles n\'attendent que votre passage.',
      category: 'weather_risk',
      severity: 'warning',
      actionLabel: 'Profiter du créneau',
      actionDestination: 'weather',
      streakDays: 8,
      duoTone: 'urgent',
      duoTag: 'Fenêtre 2 heures',
      economicImpact: 'Zéro dérive',
    },
  },
  {
    id: 'sim_harvest_ready',
    name: 'Appel Moisson (Lentille)',
    tone: 'playful',
    cropType: 'lentille',
    notification: {
      title: 'Sortez les batteuses, la lentille est prête !',
      message: 'Fenêtre sèche annoncée dans le Berry aujourd\'hui, avant les orages du week-end. Vérifiez la maturité et l\'humidité réelle du grain au champ. (Notification de démonstration)',
      category: 'harvest_window',
      severity: 'info',
      actionLabel: 'Planifier le battage',
      actionDestination: 'insights',
      streakDays: 8,
      duoTone: 'playful',
      duoTag: 'Moisson optimale',
      economicImpact: 'Démonstration',
    },
  },
  {
    id: 'sim_streak_danger',
    name: 'Rappel de Série en Danger',
    tone: 'streak_shield',
    cropType: 'pois_chiche',
    notification: {
      title: 'Duo Agri : Votre série de 8 jours va s\'éteindre !',
      message: 'Il ne vous reste que 2 heures avant minuit. Un coup d\'œil rapide de 15 secondes pour valider votre vigilance quotidienne et maintenir votre progression.',
      category: 'briefing',
      severity: 'info',
      actionLabel: 'Sauver ma série',
      actionDestination: 'weather',
      streakDays: 8,
      duoTone: 'streak_shield',
      duoTag: 'Série active',
      economicImpact: 'Série continue',
    },
  },
];
