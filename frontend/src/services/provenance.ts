/**
 * One provenance vocabulary for the whole app. Instead of scattering
 * "démo / estimé / live" labels, every surface uses the same three notification
 * origins and the same demo-field test.
 */
import type {
  AgriculturalNotification,
  NotificationProvenance,
  SelectedField,
} from '../types/agricultural';

export const DEMO_FIELD_IDS = new Set(['field_lauragais_1', 'field_beauce_2', 'field_berry_3']);

export const isDemoField = (field: Pick<SelectedField, 'id'> & { isDemo?: boolean }): boolean =>
  Boolean(field.isDemo) || DEMO_FIELD_IDS.has(field.id);

/** Resolves the origin of a notification, including entries persisted before the field existed. */
export function getNotificationProvenance(n: AgriculturalNotification): NotificationProvenance {
  if (n.provenance) return n.provenance;
  if (n.id.startsWith('fc_')) return 'forecast';
  if (n.id.startsWith('sim_')) return 'simulated';
  return 'example';
}

export const PROVENANCE_LABELS: Record<NotificationProvenance, { label: string; hint: string }> = {
  forecast: {
    label: 'Prévision',
    hint: 'Calculée à partir de la prévision actuelle et de règles agronomiques sourcées.',
  },
  example: {
    label: 'Exemple',
    hint: "Contenu illustratif préchargé, sans lien avec votre exploitation.",
  },
  simulated: {
    label: 'Simulée',
    hint: 'Notification déclenchée manuellement depuis la démonstration.',
  },
};
