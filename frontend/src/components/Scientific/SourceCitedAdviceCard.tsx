import React from 'react';
import { BookOpen, ExternalLink, Wind, ShieldCheck, AlertCircle } from 'lucide-react';
import type { RegulatoryWindow } from '../../types/backend-contract';

interface SourceCitedAdviceCardProps {
  regulatoryWindows: RegulatoryWindow[];
  cropLabel?: string;
}

export const SourceCitedAdviceCard: React.FC<SourceCitedAdviceCardProps> = ({
  regulatoryWindows,
}) => {
  const isSprayBlocked = regulatoryWindows.some((w) => !w.spraying_allowed);

  const formatDate = (isoDate: string) => {
    try {
      return new Date(isoDate).toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
      });
    } catch {
      return isoDate;
    }
  };

  return (
    <div className="apple-card p-4 sm:p-5 flex flex-col gap-3.5 border-white/15">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.08] min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
              Conseils Agronomiques Sourcés & Réglementation
            </h3>
            <p className="text-[10px] text-white/50 truncate">
              Vérifications réglementaires françaises et corpus technique Terres Inovia
            </p>
          </div>
        </div>
      </div>

      {/* Regulatory Spraying Window (Arrêté du 4 mai 2017) */}
      <div
        className={`p-3 rounded-2xl border flex items-start gap-3 transition-colors ${
          isSprayBlocked
            ? 'bg-rose-500/10 border-rose-500/25 text-rose-200'
            : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
        }`}
      >
        <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 bg-white/10">
          {isSprayBlocked ? <Wind className="w-4 h-4 text-rose-300" /> : <ShieldCheck className="w-4 h-4 text-emerald-300" />}
        </div>
        <div className="text-xs min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-white">
              {isSprayBlocked
                ? 'Pulvérisation non conforme (vent > 19 km/h)'
                : 'Critère de vent conforme (≤ 19 km/h) — autres conditions à vérifier'}
            </span>
            <span className="text-[10px] font-mono opacity-75 flex-shrink-0">
              Seuil légal : 19 km/h (3 Beaufort)
            </span>
          </div>
          <p className="text-[11px] opacity-80 mt-1 leading-relaxed">
            {isSprayBlocked
              ? 'Le vent prévu dépasse le seuil légal de 19 km/h sur certaines fenêtres (Arrêté du 4 mai 2017). Tout traitement foliaire ou phytosanitaire doit être reporté pour éviter toute dérive.'
              : 'Vent moyen prévu inférieur au seuil réglementaire de 19 km/h. Attention : le vent seul ne vaut pas autorisation globale de traitement. L\'applicateur doit vérifier l\'AMM du produit, les ZNT et délais de rentrée (DSR), ainsi que l\'absence de pluie imminente.'}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] opacity-75">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-amber-300" />
            <span>
              Le respect du vent (Arrêté du 4 mai 2017) est une obligation légale stricte. L'hygrométrie (&gt; 60%) est une recommandation agronomique d'efficacité pour limiter l'évaporation (Terres Inovia), non une loi universelle.
            </span>
          </div>
          <span className="text-[10px] opacity-60 block mt-1 font-mono">
            Source légale : Arrêté du 4 mai 2017 relatif à la mise sur le marché et à l'utilisation des produits phytopharmaceutiques.
          </span>
        </div>
      </div>

      {/* Daily Wind Windows Strip */}
      {regulatoryWindows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {regulatoryWindows.slice(0, 4).map((w: RegulatoryWindow) => (
            <div
              key={w.date_local}
              className={`p-2 rounded-xl border text-center flex flex-col gap-0.5 ${
                w.spraying_allowed
                  ? 'bg-white/[0.03] border-white/10 text-white/80'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              }`}
            >
              <span className="text-[10px] text-white/50 capitalize truncate">
                {formatDate(w.date_local)}
              </span>
              <span className="font-mono text-xs font-bold">
                {w.max_wind_speed_kmh} km/h
              </span>
              <span className="text-[9px] font-semibold opacity-75">
                {w.spraying_allowed ? 'Vent ≤ 19 km/h' : 'Vent > 19 km/h'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Terres Inovia Technical Guide Citation */}
      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2 text-[10px] text-white/50">
        <span className="truncate">
          Fiche de référence technique : Terres Inovia (Corpus National Légumineuses 2024-2026).
        </span>
        <a
          href="https://www.terresinovia.fr/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[#38bdf8] hover:underline flex-shrink-0"
        >
          <span>Consulter le guide</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
