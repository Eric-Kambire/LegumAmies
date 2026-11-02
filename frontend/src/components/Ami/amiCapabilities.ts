import type { AppTab } from '../Navigation/AppleTabBar';
import type { SelectedField } from '../../types/agricultural';
import type { AmiContextMode } from '../../hooks/useAmiChat';
import { getCropNameFr, getGrowthStageFr } from '../../services/agriRiskService';

/**
 * Capability catalogue for Ami. Each quick action maps to a concrete, grounded
 * backend capability (weather risk, spraying window, harvest window, Terres
 * Inovia agronomic evidence). The questions are phrased so the retrieval-first
 * agent returns a sourced answer; they are suggestions the farmer can edit.
 */
export type AmiCapabilityKind = 'risk' | 'spray' | 'harvest' | 'guide' | 'weather' | 'frost' | 'generic';

export interface AmiQuickAction {
  id: string;
  kind: AmiCapabilityKind;
  /** Short chip label. */
  label: string;
  /** Prefilled / sent question. */
  question: string;
}

export interface AmiExploreAction {
  id: string;
  label: string;
  tab: AppTab;
}

/** What Ami can do, described for the capability showcase (empty state). */
export const AMI_CAPABILITY_BLURBS: { kind: AmiCapabilityKind; title: string; detail: string }[] = [
  { kind: 'risk', title: 'Risques météo', detail: 'Chaleur, gel et pluie sur votre parcelle, à partir des prévisions AROME/AIFS.' },
  { kind: 'spray', title: 'Fenêtre de traitement', detail: 'Jours où le vent respecte la limite réglementaire de pulvérisation.' },
  { kind: 'harvest', title: 'Fenêtre de récolte', detail: 'Meilleures journées sèches selon la probabilité de pluie de l’ensemble.' },
  { kind: 'guide', title: 'Guides Terres Inovia', detail: 'Conduite de culture citée (pois, pois chiche, lentille) avec la page source.' },
];

/** Context-aware quick actions (compact chips). */
export function buildQuickActions(mode: AmiContextMode, field: SelectedField | null): AmiQuickAction[] {
  if (mode === 'position') {
    return [
      { id: 'pos-weather', kind: 'weather', label: 'Météo ici', question: 'Quelles sont les conditions météo à ma position ?' },
      { id: 'pos-rain', kind: 'weather', label: 'Pluie à venir', question: 'Y a-t-il de la pluie prévue dans les prochains jours ici ?' },
      { id: 'pos-frost', kind: 'frost', label: 'Risque de gel', question: 'Y a-t-il un risque de gel à ma position cette semaine ?' },
    ];
  }
  if (!field) {
    return [
      { id: 'generic-heat', kind: 'risk', label: 'Stress thermique', question: 'Quels sont les seuils de stress thermique sur les protéagineux ?' },
    ];
  }
  const crop = getCropNameFr(field.cropType).toLowerCase();
  const stage = getGrowthStageFr(field.growthStage).toLowerCase();
  return [
    { id: 'heat', kind: 'risk', label: 'Risque chaleur', question: `Quel est le risque de chaleur pour mon ${crop} (${stage}) ?` },
    { id: 'spray', kind: 'spray', label: 'Traiter ?', question: 'Puis-je traiter dans les prochains jours selon le vent ?' },
    { id: 'harvest', kind: 'harvest', label: 'Récolte', question: 'Quelle est la meilleure fenêtre de récolte selon la pluie prévue ?' },
    { id: 'guide', kind: 'guide', label: `Guide ${crop}`, question: `Que recommandent les guides Terres Inovia pour la conduite du ${crop} ?` },
    { id: 'rain', kind: 'weather', label: 'Pluie à venir', question: 'La pluie menace-t-elle ma parcelle dans les prochains jours ?' },
  ];
}

/** Deep links so Ami can take the farmer to the relevant screen. */
export const AMI_EXPLORE_ACTIONS: AmiExploreAction[] = [
  { id: 'nav-insights', label: 'Courbes & analyses', tab: 'insights' },
  { id: 'nav-weather', label: 'Carte météo', tab: 'weather' },
  { id: 'nav-fields', label: 'Mes parcelles', tab: 'fields' },
];
