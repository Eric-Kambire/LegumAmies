import React, { useState } from 'react';
import { CheckCircle2, DollarSign, Calendar, Sliders } from 'lucide-react';
import type { LocationWeatherData } from '../../types/weather';
import type { SelectedField } from '../../types/agricultural';
import { getCropNameFr } from '../../services/agriRiskService';

interface HarvestIntelligenceViewProps {
  weather: LocationWeatherData | null;
  field: SelectedField | null;
  onOpenFieldConfig: () => void;
}

export const HarvestIntelligenceView: React.FC<HarvestIntelligenceViewProps> = ({
  weather,
  field,
  onOpenFieldConfig,
}) => {
  const [targetTonnage, setTargetTonnage] = useState<number>(30); // 30 tonnes batch
  const currentTemp = weather?.current.temperature ?? 20;
  const currentHumidity = weather?.current.relativeHumidity ?? 55;

  let opportunityScore = 82;
  let statusText = 'Fenêtre Optimale';
  let statusColor = 'text-[#22c55e]';
  let statusBg = 'bg-[#22c55e]/15 border-[#22c55e]/30';

  if (weather && weather.current.precipitation > 0) {
    opportunityScore = 24;
    statusText = 'Moisson Déconseillée (Pluie)';
    statusColor = 'text-rose-400';
    statusBg = 'bg-rose-500/15 border-rose-500/30';
  } else if (currentHumidity > 75) {
    opportunityScore = 58;
    statusText = 'Humidité Trop Élevée';
    statusColor = 'text-amber-400';
    statusBg = 'bg-amber-500/15 border-amber-500/30';
  } else if (currentTemp > 30 && currentHumidity < 35) {
    opportunityScore = 65;
    statusText = 'Risque Égrenage au Battage';
    statusColor = 'text-amber-400';
    statusBg = 'bg-amber-500/15 border-amber-500/30';
  }

  const moistureProjections = (weather?.daily || []).slice(0, 7).map((d, i) => {
    const base = 14.2;
    const rainFactor = d.precipitationSum > 1 ? d.precipitationSum * 0.8 : 0;
    const dryingFactor = (d.temperatureMax - 18) * 0.15;
    const projectedMoisture = Math.max(12, Math.min(22, base + rainFactor - dryingFactor + (i * 0.1)));
    return {
      date: d.date,
      day: i === 0 ? "Auj." : new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short' }),
      moisture: Math.round(projectedMoisture * 10) / 10,
      rain: d.precipitationSum,
      favorable: projectedMoisture <= 15.5 && d.precipitationSum < 1,
    };
  });

  const dryingPenaltyPerTonne = currentHumidity > 70 ? 42 : 0;
  const totalDryingCost = dryingPenaltyPerTonne * targetTonnage;
  const shatteringLossRiskEur = opportunityScore < 60 ? 1200 : 0;

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-6 pb-28 max-w-2xl mx-auto w-full select-none flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Fenêtre de Récolte</h1>
          <p className="text-xs text-white/50 mt-0.5">
            {field?.commune || 'Parcelle'} • {field ? getCropNameFr(field.cropType) : 'Légumineuse'}
          </p>
        </div>

        <button
          onClick={onOpenFieldConfig}
          className="apple-glass px-3 py-1.5 rounded-full text-xs text-white/80 hover:text-white flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Modifier</span>
        </button>
      </div>

      {/* Hero Opportunity Gauge Card */}
      <div className="apple-card p-5 flex flex-col items-center text-center relative overflow-hidden">
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusBg} ${statusColor}`}>
            {statusText}
          </span>
        </div>

        <div className="text-6xl font-thin tracking-tighter text-white my-1">
          {opportunityScore}<span className="text-2xl font-light text-white/40">/100</span>
        </div>

        <p className="text-xs text-white/60 max-w-sm mt-1 leading-relaxed">
          {opportunityScore >= 75
            ? 'Conditions agro-climatiques réunies pour battre à hygrométrie optimale (< 15%). Pertes par égrenage minimales.'
            : 'Forte humidité ou risque d\'averse. Risque de surcoût de séchage industriel en coopérative.'}
        </p>
      </div>

      {/* 7-Day Grain Moisture Desiccation Curve */}
      <div className="apple-card p-4">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.08]">
          <div className="flex items-center gap-1.5 text-xs text-white/50 font-semibold uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5" />
            <span>Taux d'humidité grain projeté (7 jours)</span>
          </div>
          <span className="text-[10px] text-white/40 font-mono">Seuil idéal : ≤ 15%</span>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {moistureProjections.map((p) => {
            const isIdeal = p.moisture <= 15.0;
            const isBorderline = p.moisture > 15.0 && p.moisture <= 16.5;

            return (
              <div
                key={p.date}
                className={`flex flex-col items-center py-2.5 px-1 rounded-2xl border text-center transition-all ${
                  isIdeal
                    ? 'bg-[#22c55e]/10 border-[#22c55e]/25 text-white'
                    : isBorderline
                    ? 'bg-amber-500/10 border-amber-500/25 text-white'
                    : 'bg-rose-500/10 border-rose-500/25 text-white'
                }`}
              >
                <span className="text-[11px] font-medium text-white/60 capitalize">{p.day}</span>
                <span className="text-base font-semibold tracking-tight my-1 text-white">
                  {p.moisture}%
                </span>
                <span
                  className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                    isIdeal
                      ? 'bg-[#22c55e]/20 text-[#34d399]'
                      : isBorderline
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {isIdeal ? 'Idéal' : isBorderline ? 'Séchage' : 'Pluie'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Economic Arbitrage Matrix */}
      <div className="apple-card p-4">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.08]">
          <div className="flex items-center gap-1.5 text-xs text-white/50 font-semibold uppercase tracking-wider">
            <DollarSign className="w-3.5 h-3.5" />
            <span>Arbitrage Économique (Coopérative vs Égrenage)</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-white/60">
            <span>Lot :</span>
            <input
              type="number"
              min="5"
              max="150"
              value={targetTonnage}
              onChange={(e) => setTargetTonnage(parseInt(e.target.value, 10) || 30)}
              className="w-12 px-1 py-0.5 rounded bg-white/10 text-center font-mono text-white text-xs focus:outline-none"
            />
            <span>t</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex flex-col justify-between">
            <div>
              <p className="text-[11px] text-white/50 font-medium">Réfaction séchage estimée</p>
              <p className="text-2xl font-light text-white tracking-tight mt-1">
                {totalDryingCost} €
              </p>
            </div>
            <p className="text-[10px] text-white/40 mt-2">
              {dryingPenaltyPerTonne > 0 ? `${dryingPenaltyPerTonne} €/t déduits du prix d'achat.` : 'Zéro pénalité prévue.'}
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex flex-col justify-between">
            <div>
              <p className="text-[11px] text-white/50 font-medium">Risque égrenage au sol</p>
              <p className="text-2xl font-light text-white tracking-tight mt-1">
                {shatteringLossRiskEur} €
              </p>
            </div>
            <p className="text-[10px] text-white/40 mt-2">
              Estimation des gousses brisées au sol si récolte trop tardive.
            </p>
          </div>
        </div>
      </div>

      {/* Recommended Agricultural Checklist */}
      <div className="apple-card p-4">
        <p className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2.5 pb-2 border-b border-white/[0.08]">
          Conseils de battage pour {field ? getCropNameFr(field.cropType) : 'votre culture'}
        </p>

        <ul className="flex flex-col gap-2.5 text-xs text-white/75">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#22c55e] flex-shrink-0 mt-0.5" />
            <span>Régler la vitesse du batteur à moins de 450 tr/min pour préserver l'intégrité de la graine.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#22c55e] flex-shrink-0 mt-0.5" />
            <span>Éviter de moissonner entre 13h et 16h si le thermomètre dépasse 28°C (gousses cassantes).</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#22c55e] flex-shrink-0 mt-0.5" />
            <span>Ventiler le lot dès l'entrée en silo pour stabiliser la température sous 15°C.</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
