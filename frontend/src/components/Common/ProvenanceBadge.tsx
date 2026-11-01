import React from 'react';
import type { NotificationProvenance } from '../../types/agricultural';
import { PROVENANCE_LABELS } from '../../services/provenance';

const STYLES: Record<NotificationProvenance, string> = {
  forecast: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  example: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  simulated: 'bg-violet-500/15 text-violet-200 border-violet-500/30',
};

interface ProvenanceBadgeProps {
  kind: NotificationProvenance;
  className?: string;
}

/** Single, consistent origin label used by notification surfaces. */
export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({ kind, className = '' }) => (
  <span
    title={PROVENANCE_LABELS[kind].hint}
    className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-semibold leading-none whitespace-nowrap ${STYLES[kind]} ${className}`}
  >
    {PROVENANCE_LABELS[kind].label}
  </span>
);

/** Small "Démo" chip for example fields. */
export const DemoFieldBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    title="Parcelle d'exemple préchargée : elle ne correspond pas à votre exploitation."
    className={`inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-semibold leading-none text-amber-200 whitespace-nowrap ${className}`}
  >
    Démo
  </span>
);
