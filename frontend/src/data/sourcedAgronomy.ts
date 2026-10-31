/**
 * Sourced agronomic thresholds — the ONLY agronomic numbers the UI may present
 * as fact. Each entry is traceable to a published source (Terres Inovia).
 *
 * Crops absent from a map have NO published threshold we can cite; the UI must
 * show an honest "non disponible / non sourcé" state rather than invent a value.
 *
 * These mirror the backend rule catalogue (src/risk, data/raw/crop_rules.csv).
 */
import type { LegumeCropType } from '../types/agricultural';

export interface SourcedThreshold {
  /** Daily maximum air temperature (°C) above which flowering heat stress is reported. */
  tmaxC: number;
  institution: string;
  sourceUrl: string;
  /** Short French note, paraphrased (no verbatim source text). */
  noteFr: string;
}

/** Flowering heat-stress thresholds with published sources (French crop ids). */
export const SOURCED_FLOWERING_HEAT: Partial<Record<LegumeCropType, SourcedThreshold>> = {
  pois: {
    tmaxC: 25,
    institution: 'Terres Inovia',
    sourceUrl:
      'https://www.terresinovia.fr/fr/informations-techniques/pois-dhiver/accidents-climatiques-du-pois-secheresse-et-temperatures',
    noteFr: 'Au-delà de 25 °C (Tmax), la photosynthèse du pois est perturbée.',
  },
  feverole: {
    tmaxC: 25,
    institution: 'Terres Inovia',
    sourceUrl:
      'https://www.terresinovia.fr/fr/informations-techniques/feverole-de-printemps/accidents-climatiques-de-la-feverole-secheresse-et',
    noteFr: 'Au-delà de 25 °C (Tmax), perte de rendement sur la phase reproductive de la féverole.',
  },
  lentille: {
    tmaxC: 28,
    institution: 'Terres Inovia',
    sourceUrl:
      'https://www.terresinovia.fr/fr/actualites/recolte-de-la-lentille-les-premieres-moissons-commenceront-fin-juin-que-faut-il-garder-0',
    noteFr: 'Les fleurs de lentille ne supportent pas des températures supérieures à ~28 °C.',
  },
};

/** France: Arrêté du 4 mai 2017 — spraying forbidden at wind >= 19 km/h (3 Beaufort). */
export const SPRAYING_WIND_LIMIT_KMH = 19;
export const SPRAYING_SOURCE = {
  institution: 'Réglementation française',
  label: 'Arrêté du 4 mai 2017 (vent ≥ 19 km/h, 3 Beaufort)',
  sourceUrl: 'https://www.legifrance.gouv.fr/',
};

export function getSourcedFloweringHeat(crop: LegumeCropType): SourcedThreshold | undefined {
  return SOURCED_FLOWERING_HEAT[crop];
}
