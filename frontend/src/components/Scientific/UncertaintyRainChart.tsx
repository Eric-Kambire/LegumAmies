import React from 'react';
import { CloudRain, Info } from 'lucide-react';
import type { EnsembleBlock, RainProbabilityDay } from '../../types/backend-contract';

interface UncertaintyRainChartProps {
  ensemble: EnsembleBlock;
}

export const UncertaintyRainChart: React.FC<UncertaintyRainChartProps> = ({ ensemble }) => {
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
          <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-[#38bdf8] flex items-center justify-center flex-shrink-0">
            <CloudRain className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
              Incertitude Précipitations (Ensemble AIFS 51 membres)
            </h3>
            <p className="text-[10px] text-white/50 truncate">
              Probabilité journalière de dépasser le seuil de {ensemble.rain_threshold_mm} mm
            </p>
          </div>
        </div>

        <span className="text-[10px] text-[#38bdf8] font-mono font-medium px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 flex-shrink-0 hidden sm:inline">
          {ensemble.ensemble_members_valid} membres
        </span>
      </div>

      {/* Probability Bars List */}
      <div className="flex flex-col gap-2 pt-1">
        {ensemble.daily.slice(0, 7).map((d: RainProbabilityDay) => {
          // Color coding by probability risk
          const barColor =
            d.probability_pct > 50
              ? 'bg-rose-500'
              : d.probability_pct > 20
              ? 'bg-amber-400'
              : 'bg-[#38bdf8]';

          return (
            <div key={d.date_local} className="flex items-center justify-between gap-3 text-xs min-w-0">
              <span className="w-20 font-medium text-white/80 capitalize truncate">
                {formatDate(d.date_local)}
              </span>

              {/* Progress track */}
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div className="flex-1 h-2.5 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/[0.05]">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${Math.max(4, Math.min(100, d.probability_pct))}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-white/90 font-bold w-10 text-right flex-shrink-0">
                  {d.probability_pct}%
                </span>
              </div>

              {/* Expected mean & median */}
              <div className="w-24 text-right font-mono text-[10px] text-white/50 flex-shrink-0">
                <span>Moy. {d.mean_precipitation_mm.toFixed(1)} mm</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Model Attribution & Note */}
      <div className="pt-2 border-t border-white/[0.06] flex items-start gap-2 text-[10px] text-white/50 leading-relaxed">
        <Info className="w-3.5 h-3.5 text-white/40 flex-shrink-0 mt-0.5" />
        <span>
          <strong>Modèle d'IA météo :</strong> {ensemble.model_id}. {ensemble.threshold_note}
        </span>
      </div>
    </div>
  );
};
