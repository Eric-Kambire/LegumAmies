import React from 'react';
import { Calendar, Info, Sparkles } from 'lucide-react';
import type { HarvestBlock, HarvestDay } from '../../types/backend-contract';

interface HarvestRecommendationsCardProps {
  harvest: HarvestBlock;
  cropName: string;
  stageName: string;
}

export const HarvestRecommendationsCard: React.FC<HarvestRecommendationsCardProps> = ({
  harvest,
  cropName,
  stageName,
}) => {
  if (!harvest.available) {
    return (
      <div className="apple-card p-4 flex flex-col gap-3 border-white/10 bg-white/[0.03]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/50">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-white">
              Optimiseur de Récolte (Météo-dépendant)
            </h3>
            <p className="text-[11px] text-white/50">
              Statut : {harvest.harvest_ready ? 'Matériel indisponible' : 'Culture non prête à récolter'}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-xs text-white/70 leading-relaxed">
          <p>
            {cropName} est actuellement au stade <strong className="text-white">{stageName}</strong>.
            L'algorithme de classement des créneaux de battage s'activera automatiquement lorsque la parcelle atteindra le stade <em>prêt à récolter</em>.
          </p>
          <p className="text-[10px] text-white/40 mt-1.5">
            {harvest.note}
          </p>
        </div>
      </div>
    );
  }

  const recommendedDay = harvest.days.find((d) => d.date_local === harvest.recommended_date_local);

  const formatDate = (isoDate: string) => {
    try {
      return new Date(isoDate).toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return isoDate;
    }
  };

  return (
    <div className="apple-card p-4 sm:p-5 flex flex-col gap-4 border-white/15">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                Créneaux de Récolte Recommandés
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {harvest.n_feasible_days} jour{harvest.n_feasible_days > 1 ? 's' : ''} favorable{harvest.n_feasible_days > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-[10px] text-white/50 truncate mt-0.5">
              Classement météo déterministe (sans portance sol ni humidité grain)
            </p>
          </div>
        </div>
      </div>

      {/* Best Day Spotlight Card */}
      {recommendedDay && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-white/[0.04] to-transparent border border-emerald-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-emerald-300 font-semibold uppercase tracking-wider block">
                Meilleur créneau identifié
              </span>
              <span className="text-sm font-bold text-white capitalize">
                {formatDate(recommendedDay.date_local)}
              </span>
              <p className="text-[10px] text-white/60 truncate mt-0.5">
                {recommendedDay.explanation}
              </p>
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <span className="text-[10px] text-white/40 block">Risque pluie</span>
            <span className="text-xs font-mono font-bold text-emerald-300">
              {recommendedDay.rain_probability_pct}%
            </span>
          </div>
        </div>
      )}

      {/* Candidate Days Table */}
      <div className="flex flex-col divide-y divide-white/[0.06] text-xs">
        {harvest.days.map((day: HarvestDay) => (
          <div
            key={day.date_local}
            className={`py-2.5 flex items-center justify-between gap-2 min-w-0 ${
              day.date_local === harvest.recommended_date_local ? 'font-semibold text-white' : 'text-white/70'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 w-32 sm:w-40">
              {day.rank ? (
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center flex-shrink-0">
                  #{day.rank}
                </span>
              ) : (
                <span className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-300 font-mono text-[10px] flex items-center justify-center flex-shrink-0">
                  ✕
                </span>
              )}
              <span className="capitalize truncate text-xs">
                {formatDate(day.date_local)}
              </span>
            </div>

            <div className="flex items-center gap-3 font-mono text-[11px] flex-shrink-0">
              <span className="text-white/60">
                Pluie : {day.rain_probability_pct}% ({day.expected_rain_mm} mm)
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                day.feasible ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {day.feasible ? 'Faisable' : 'Bloqué'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Honest Limitation Disclaimer */}
      <div className="pt-2 border-t border-white/[0.06] flex items-start gap-2 text-[10px] text-white/50 leading-relaxed">
        <Info className="w-3.5 h-3.5 text-white/40 flex-shrink-0 mt-0.5" />
        <span>
          <strong>Limitation méthodologique :</strong> {harvest.days[0]?.limitations || 'Aide à la décision basée sur les prévisions météo uniquement. L\'application ne mesure pas l\'humidité réelle du grain ni la portance du sol.'}
        </span>
      </div>
    </div>
  );
};
