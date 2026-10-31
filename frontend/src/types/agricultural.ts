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
  optimalHarvestMoisture: { min: number; max: number }; // Percentage, e.g. 14-16%
  heatThresholdC: number; // Flowering abortion threshold
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
}
