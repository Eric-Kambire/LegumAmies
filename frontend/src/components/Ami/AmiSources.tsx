import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, ExternalLink, Info } from 'lucide-react';
import type { AdvisorResponse } from '../../types/backend-contract';

interface AmiSourcesProps {
  response: AdvisorResponse;
}

type Provenance = {
  retrieved_at_utc?: string;
  arome?: { available?: boolean; model_id?: string; window_local?: string[] };
  aifs?: { available?: boolean; model_id?: string; ensemble_members_valid?: number };
};

const formatUtc = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/** Expandable evidence: only what the API returned (citations, forecast provenance, uncertainty, limits). */
export const AmiSources: React.FC<AmiSourcesProps> = ({ response }) => {
  const [open, setOpen] = useState(false);
  const citations = response.citations ?? [];
  const prov = (response.forecast_provenance ?? {}) as Provenance;
  const limitations = response.limitations ?? [];
  const hasUncertainty = Boolean(response.uncertainty?.note);
  const retrieved = formatUtc(prov.retrieved_at_utc);

  const summary = [
    citations.length ? `${citations.length} source${citations.length > 1 ? 's' : ''}` : 'Aucune source citée',
    prov.arome?.available ? 'prévision AROME' : null,
    prov.aifs?.available ? 'ensemble AIFS' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="mt-2 rounded-xl bg-black/25 border border-white/[0.08] text-[11px] text-white/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <BookOpen className="w-3.5 h-3.5 text-indigo-300 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">Sources et preuves · {summary}</span>
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />}
      </button>

      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2.5 border-t border-white/[0.06] pt-2.5">
          {citations.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {citations.map((c, i) => (
                <li key={i} className="rounded-lg bg-white/[0.04] p-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-white/90">
                      {c.institution || 'Source'} — {c.document || c.hazard || c.type}
                    </span>
                    {c.source_url && (
                      <a
                        href={c.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#38bdf8] hover:underline inline-flex items-center gap-1 flex-shrink-0"
                      >
                        Ouvrir <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                  {c.snippet && <p className="mt-1 text-white/60 leading-relaxed">« {c.snippet} »</p>}
                  {c.validation_status && (
                    <p className="mt-1 text-white/45">Statut de validation : {c.validation_status}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>Aucune citation documentaire n'accompagne cette réponse.</p>
          )}

          {(prov.arome || prov.aifs) && (
            <div className="rounded-lg bg-white/[0.04] p-2 leading-relaxed">
              <p className="font-semibold text-white/85">Provenance de la prévision</p>
              {prov.arome?.model_id && <p>Court terme : {prov.arome.model_id}</p>}
              {prov.aifs?.model_id && (
                <p>
                  Ensemble : {prov.aifs.model_id}
                  {prov.aifs.ensemble_members_valid ? ` (${prov.aifs.ensemble_members_valid} membres)` : ''}
                </p>
              )}
              {retrieved && <p>Récupérée le {retrieved}</p>}
            </div>
          )}

          {hasUncertainty && (
            <p className="flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-300" aria-hidden="true" />
              <span>Incertitude : {response.uncertainty.note}</span>
            </p>
          )}

          {limitations.length > 0 && (
            <ul className="list-disc pl-4 text-white/55 leading-relaxed">
              {limitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}

          <p className="text-[10px] text-white/40 font-mono">
            {response.grounded ? 'Réponse appuyée sur des sources' : 'Réponse non appuyée sur des sources'}
            {response.model_id ? ` · ${response.model_id}` : ''}
            {response.knowledge_base_id ? ` · KB ${response.knowledge_base_id}` : ''}
          </p>
        </div>
      )}
    </div>
  );
};
