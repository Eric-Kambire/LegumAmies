/**
 * Agricultural data structures for French legume crops
 */

export type LegumeCropType =
  | 'soja'          // Soja (Soybean)
  | 'feverole'      // Féverole (Fava bean)
  | 'pois_chiche'   // Pois chiche (Chickpea)
  | 'pois'          // Pois protéagineux (Pea)
  | 'lentille'      // Lentille (Lentil)
  | 'lupin'         // Lupin (Lupin)
  | 'haricot_sec';  // Haricot sec (Dry bean)

export type CropGrowthStage =
  | 'vegetatif'         // Végétatif (Vegetative)
  | 'floraison'         // Floraison (Flowering)
  | 'formation_gousses' // Formation des gousses (Pod formation)
  | 'remplissage_grain' // Remplissage du grain (Grain filling)
  | 'pret_recolter';    // Prêt à récolter (Harvest-ready)

export interface CropInfo {
  id: LegumeCropType;
  labelFr: string;
  scientificName: string;
  typicalSowingMonths: string;
  typicalHarvestMonths: string;
  optimalHarvestMoisture: { min: number; max: number };
  heatThresholdC: number;
  color: string;
  accent: {
    bg: string;
    text: string;
    border: string;
  };
  description: string;
}

export interface GrowthStageInfo {
  id: CropGrowthStage;
  labelFr: string;
  shortDescFr: string;
  fullDescFr: string;
  criticalRisks: string[];
  accent: {
    bg: string;
    text: string;
    border: string;
  };
}

export interface SelectedField {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  commune?: string;
  departmentCode?: string;
  cropType: LegumeCropType;
  growthStage: CropGrowthStage;
  areaHectares?: number;
  sowingDate?: string;
  soilType?: 'calcaire' | 'argilo_calcaire' | 'limon' | 'sableux';
  /** Polygone vectoriel des contours de la parcelle [[lat, lng], ...] */
  polygonCoordinates?: Array<[number, number]>;
  createdAt: string;
  updatedAt: string;
}

export type RiskSeverity = 'favorable' | 'vigilance' | 'alerte' | 'critique';

export interface AgriculturalRiskAlert {
  id: string;
  type: 'floraison_chaleur' | 'pulverisation_vent' | 'humidite_recolte' | 'egrenage' | 'gel_tardif';
  title: string;
  severity: RiskSeverity;
  description: string;
  recommendation: string;
  metricValue: string;
  triggerThreshold: string;
  whyExplanation?: string;
  featureWeights?: Array<{ name: string; impactPct: number; direction: 'increases_risk' | 'decreases_risk' }>;
}

export interface AgriculturalNotification {
  id: string;
  title: string;
  message: string;
  category: 'weather_risk' | 'stage_update' | 'harvest_window' | 'briefing';
  severity: 'critical' | 'warning' | 'info';
  fieldId?: string;
  fieldName?: string;
  timestamp: string;
  isRead: boolean;
  actionLabel?: string;
  actionDestination?: 'weather' | 'fields' | 'insights';
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "21:00"
  quietHoursEnd: string;   // "06:30"
  criticalRisksImmediate: boolean;
  dailyBriefingMorning: boolean;
  dailyBriefingTime: string; // "07:00"
  stageUpdateReminders: boolean;
}
