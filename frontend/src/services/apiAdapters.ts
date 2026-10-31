import type { LegumeCropType, CropGrowthStage } from '../types/agricultural';

/**
 * Bidirectional typed API adapters between LegumAmies Frontend and ClimateShield Backend.
 * Strictly adheres to docs/API_CONTRACT.md and src/api/mapping.py.
 */

export type BackendCropId =
  | 'fava_bean'
  | 'pea'
  | 'chickpea'
  | 'soybean'
  | 'lentil'
  | 'lupin'
  | 'dry_bean';

export type BackendStageId =
  | 'vegetative'
  | 'flowering'
  | 'pod_formation'
  | 'grain_filling'
  | 'harvest_ready';

// Mapping tables
const FRONTEND_TO_BACKEND_CROP: Record<LegumeCropType, BackendCropId> = {
  feverole: 'fava_bean',
  pois: 'pea',
  pois_chiche: 'chickpea',
  soja: 'soybean',
  lentille: 'lentil',
  lupin: 'lupin',
  haricot_sec: 'dry_bean',
};

const BACKEND_TO_FRONTEND_CROP: Record<string, LegumeCropType> = {
  fava_bean: 'feverole',
  pea: 'pois',
  chickpea: 'pois_chiche',
  soybean: 'soja',
  lentil: 'lentille',
  lupin: 'lupin',
  dry_bean: 'haricot_sec',
  // Identity fallbacks if backend echoes French
  feverole: 'feverole',
  pois: 'pois',
  pois_chiche: 'pois_chiche',
  soja: 'soja',
  lentille: 'lentille',
  lupin_fr: 'lupin',
  haricot_sec: 'haricot_sec',
};

const FRONTEND_TO_BACKEND_STAGE: Record<CropGrowthStage, BackendStageId> = {
  vegetatif: 'vegetative',
  floraison: 'flowering',
  formation_gousses: 'pod_formation',
  remplissage_grain: 'grain_filling',
  pret_recolter: 'harvest_ready',
};

const BACKEND_TO_FRONTEND_STAGE: Record<string, CropGrowthStage> = {
  vegetative: 'vegetatif',
  flowering: 'floraison',
  pod_formation: 'formation_gousses',
  grain_filling: 'remplissage_grain',
  harvest_ready: 'pret_recolter',
  // Identity fallbacks
  vegetatif: 'vegetatif',
  floraison: 'floraison',
  formation_gousses: 'formation_gousses',
  remplissage_grain: 'remplissage_grain',
  pret_recolter: 'pret_recolter',
};

export function toBackendCrop(crop: LegumeCropType): BackendCropId {
  return FRONTEND_TO_BACKEND_CROP[crop] || 'chickpea';
}

export function fromBackendCrop(backendCrop: string): LegumeCropType {
  return BACKEND_TO_FRONTEND_CROP[backendCrop] || 'pois_chiche';
}

export function toBackendStage(stage: CropGrowthStage): BackendStageId {
  return FRONTEND_TO_BACKEND_STAGE[stage] || 'vegetative';
}

export function fromBackendStage(backendStage: string): CropGrowthStage {
  return BACKEND_TO_FRONTEND_STAGE[backendStage] || 'vegetatif';
}

export function formatValidationStatus(status: string): {
  label: string;
  badgeClass: string;
  isPublished: boolean;
} {
  switch (status) {
    case 'published':
      return {
        label: 'Seuil publié (Terres Inovia)',
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        isPublished: true,
      };
    case 'requires_expert_validation':
      return {
        label: 'Validation agronomique requise',
        badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        isPublished: false,
      };
    case 'demo_hypothetical':
      return {
        label: 'Scénario démonstratif',
        badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        isPublished: false,
      };
    default:
      return {
        label: status,
        badgeClass: 'bg-white/10 text-white/70 border-white/15',
        isPublished: false,
      };
  }
}
