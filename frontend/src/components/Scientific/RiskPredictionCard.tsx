import React from 'react';
import { ExternalLink, ShieldAlert, AlertTriangle } from 'lucide-react';
import type { RiskAlert } from '../../types/backend-contract';
import { formatValidationStatus } from '../../services/apiAdapters';

interface RiskPredictionCardProps {
  alert: RiskAlert;
  onWhyClick?: () => void;
}

export const RiskPredictionCard: React.FC<RiskPredictionCardProps> = ({ alert, onWhyClick }) => {
  const statusInfo = formatValidationStatus(alert.validation_status);

  // Friendly title translation
  const hazardTitles: Record<string, string> = {
    heat_stress: 'Stress Thermique sur Floraison',
    frost: 'Risque de Gel Tardif',
    excess_rain: 'Excès d\'Eau en Floraison',
    wet_harvest: 'Humidité Critique avant Récolte',
  };
  const title = hazardTitles[alert.hazard_type] || alert.hazard_type.replace(/_/g, ' ');

  const formatWindow = (start: string, end: string) => {
    try {
      const d1 = new Date(start);
      const d2 = new Date(end);
      const day = d1.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
      const h1 = d1.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const h2 = d2.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      return `${day} de ${h1} à ${h2}`;
    } catch {
      return `${start} → ${end}`;
    }
  };

  return (
    <article className="apple-card p-4 flex flex-col gap-3 transition-all hover:bg-white/[0.08] border-white/15">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
              {title}
            </h4>
            <span className="text-[10px] text-white/50 block font-mono">
              Variable : {alert.weather_variable}
            </span>
          </div>
        </div>

        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ${statusInfo.badgeClass}`}>
          {statusInfo.label}
        </span>
      </div>

      {/* Observation vs Sourced Threshold */}
      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-black/40 border border-white/[0.06] text-xs">
        <div>
          <span className="text-[10px] text-white/50 uppercase tracking-wide block">Prévision modèle :</span>
          <span className="font-mono text-sm font-bold text-rose-300">
            {alert.observed_value}°C
          </span>
        </div>
        <div>
          <span className="text-[10px] text-white/50 uppercase tracking-wide block">Seuil d'alerte :</span>
          <span className="font-mono text-sm font-semibold text-white/90">
            {alert.comparison_operator === 'gt' ? '> ' : '< '}
            {alert.threshold_value}°C
          </span>
        </div>
      </div>

      {/* Exposure duration and time window */}
      <div className="flex items-center justify-between text-[11px] text-white/70">
        <span>Créneau exposé :</span>
        <span className="font-mono text-white/90 font-medium">
          {formatWindow(alert.forecast_start_local, alert.forecast_end_local)} ({alert.exposure_hours}h)
        </span>
      </div>

      {/* Honesty disclaimer and source citation */}
      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2 text-[10px]">
        <div className="flex items-center gap-1 text-white/50 truncate">
          <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span className="truncate">Alerte de risque, pas une prédiction de dégât.</span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {alert.source_url && (
            <a
              href={alert.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#38bdf8] hover:underline"
            >
              <span>Source Terres Inovia</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {onWhyClick && (
            <button
              onClick={onWhyClick}
              className="text-[#38bdf8] hover:underline font-semibold"
            >
              Pourquoi ?
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
