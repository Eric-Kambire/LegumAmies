import React, { useState } from 'react';
import {
  HelpCircle,
  Info,
} from 'lucide-react';
import type { LocationWeatherData } from '../../types/weather';
import type { SelectedField, AgriculturalRiskAlert } from '../../types/agricultural';
import { getCropNameFr, getGrowthStageFr } from '../../services/agriRiskService';
import { LEGUME_CROPS_CATALOG, GROWTH_STAGES_CATALOG } from '../../data/legumeCatalog';
import {
  getSourcedFloweringHeat,
  SPRAYING_WIND_LIMIT_KMH,
  SPRAYING_SOURCE,
} from '../../data/sourcedAgronomy';
import { CropGlyph } from '../Common/LegumeGlyphs';

interface ForecastInsightsViewProps {
  weather: LocationWeatherData | null;
  field: SelectedField | null;
  alerts: AgriculturalRiskAlert[];
  onOpenFieldConfig: () => void;
}

export const ForecastInsightsView: React.FC<ForecastInsightsViewProps> = ({
  weather,
  field,
  alerts,
  onOpenFieldConfig,
}) => {
  const [viewMode, setViewMode] = useState<'summary' | 'scientific'>('summary');
  const [selectedAlertForWhy, setSelectedAlertForWhy] = useState<string | null>(null);

  const currentTemp = weather?.current.temperature ?? 20;
  const currentWind = weather?.current.windSpeed ?? 12;
  const currentRain = weather?.current.precipitation ?? 0;

  const crop = field ? LEGUME_CROPS_CATALOG[field.cropType] : null;
  const maxTemp = weather?.daily?.[0]?.temperatureMax ?? currentTemp;
  const sourcedHeat = field ? getSourcedFloweringHeat(field.cropType) : undefined;

  // Transparent decision traces. Each trace is either backed by a published
  // source / real regulation, or explicitly marked "non disponible". No
  // invented thresholds, grain-moisture values or sorption formulas.
  const heatTrace = sourcedHeat
    ? {
        id: 'trace_heat',
        title: 'Seuil de chaleur en floraison (publié)',
        status: maxTemp >= sourcedHeat.tmaxC ? 'Seuil dépassé' : 'Sous le seuil',
        isTriggered: maxTemp >= sourcedHeat.tmaxC,
        ruleType: `Seuil agronomique publié — ${sourcedHeat.institution}`,
        formula: `Tmax prévue (${Math.round(maxTemp)}°C) vs seuil publié (${sourcedHeat.tmaxC}°C)`,
        scientificExplanation: `${sourcedHeat.noteFr} Source : ${sourcedHeat.institution}. Un dépassement est une alerte de risque, pas une prédiction de dégât.`,
        parameters: [
          { name: 'Température max prévue', value: `${Math.round(maxTemp)}°C`, threshold: `${sourcedHeat.tmaxC}°C`, status: maxTemp >= sourcedHeat.tmaxC ? 'critical' : 'ok' },
        ],
      }
    : {
        id: 'trace_heat',
        title: 'Seuil de chaleur en floraison',
        status: 'Non disponible',
        isTriggered: false,
        ruleType: 'Aucun seuil publié pour cette culture',
        formula: '—',
        scientificExplanation: `Aucun seuil de chaleur publié n'est disponible pour ${field ? getCropNameFr(field.cropType) : 'cette culture'}. Valeur non affichée pour éviter toute donnée inventée.`,
        parameters: [] as Array<{ name: string; value: string; threshold: string; status: string }>,
      };

  const decisionTraces = [
    heatTrace,
    {
      id: 'trace_spray',
      title: 'Fenêtre de pulvérisation (réglementation)',
      status: currentWind >= SPRAYING_WIND_LIMIT_KMH ? 'Interdit (réglementaire)' : 'Conforme',
      isTriggered: currentWind >= SPRAYING_WIND_LIMIT_KMH,
      ruleType: `Réglementation française — ${SPRAYING_SOURCE.label}`,
      formula: `Vent (${Math.round(currentWind)} km/h) vs ${SPRAYING_WIND_LIMIT_KMH} km/h (3 Beaufort)`,
      scientificExplanation: `Au-delà de ${SPRAYING_WIND_LIMIT_KMH} km/h, la pulvérisation phytosanitaire est interdite pour limiter la dérive. Vérifier aussi l'hygrométrie et les ZNT. Source : ${SPRAYING_SOURCE.institution}.`,
      parameters: [
        { name: 'Vent moyen prévu', value: `${Math.round(currentWind)} km/h`, threshold: `< ${SPRAYING_WIND_LIMIT_KMH} km/h`, status: currentWind < SPRAYING_WIND_LIMIT_KMH ? 'ok' : 'critical' },
      ],
    },
    {
      id: 'trace_harvest',
      title: 'Fenêtre de récolte (pluie prévue)',
      status: 'Indicateur météo',
      isTriggered: currentRain > 0,
      ruleType: 'Indicateur météo (pluie prévue) — provisoire',
      formula: `Pluie en cours/prévue : ${currentRain > 0 ? '> 0' : '0'} mm`,
      scientificExplanation: `Évalué uniquement sur la pluie prévue par le modèle. L'application ne mesure pas l'humidité du grain ni la portance du sol : indicateur provisoire, non agronomiquement validé.`,
      parameters: [
        { name: 'Pluie en cours/prévue', value: currentRain > 0 ? 'Oui' : 'Non', threshold: '0 mm', status: currentRain > 0 ? 'critical' : 'ok' },
        { name: 'Humidité du grain', value: 'Non mesurée', threshold: '—', status: 'warning' },
      ],
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pt-6 pb-28 max-w-6xl mx-auto w-full select-none flex flex-col gap-5">
      {/* Header & Mode Switcher */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Prévisions & Analyses</h1>
          <p className="text-xs text-white/50 mt-0.5">
            {field?.name || 'Parcelle'} • {field ? getCropNameFr(field.cropType) : 'Culture'}
          </p>
        </div>
        {/* Apple Segmented Switcher: Summary vs Detailed Scientific */}
        <div className="apple-glass p-0.5 rounded-full flex items-center gap-1 shadow-lg">
          <button
            onClick={() => setViewMode('summary')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              viewMode === 'summary'
                ? 'bg-white text-black shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Synthèse
          </button>
          <button
            onClick={() => setViewMode('scientific')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              viewMode === 'scientific'
                ? 'bg-white text-black shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Explications
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: SUMMARY (SYNTHÈSE CLAIRE) */}
      {viewMode === 'summary' && (
        <div className="flex flex-col gap-5">
          {/* Crop Phenological State Banner */}
          {field && (
            <div className="apple-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center border shadow-xs flex-shrink-0"
                  style={{
                    backgroundColor: crop?.accent.bg || 'rgba(255,255,255,0.08)',
                    color: crop?.accent.text || '#fff',
                    borderColor: crop?.accent.border || 'rgba(255,255,255,0.15)',
                  }}
                >
                  <CropGlyph crop={field.cropType} size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">
                    {crop?.labelFr} • {getGrowthStageFr(field.growthStage)}
                  </h3>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    {GROWTH_STAGES_CATALOG[field.growthStage]?.shortDescFr}
                  </p>
                </div>
              </div>
              <button
                onClick={onOpenFieldConfig}
                className="apple-glass px-3.5 py-1.5 rounded-full text-xs text-white/80 hover:text-white active:scale-95 transition-transform"
              >
                Changer
              </button>
            </div>
          )}

          {/* Responsive 2-column Grid for Risks and Probabilities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Active Risks List with "Pourquoi cette prédiction ?" button */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50 px-1">
              Évaluation des Risques Météo Ciblés
            </span>
            {alerts.length === 0 && (
              <div className="apple-card p-4 text-xs text-white/60">
                Aucun risque sourcé déclenché pour ce stade et cette prévision. Les seuils sans
                source publiée ne sont pas affichés.
              </div>
            )}
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="apple-card p-4 flex flex-col gap-2.5 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{alert.title}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      alert.severity === 'critique'
                        ? 'bg-rose-500/20 text-rose-300'
                        : alert.severity === 'alerte'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-[#22c55e]/20 text-[#34d399]'
                    }`}
                  >
                    {alert.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-white/70 leading-relaxed">{alert.description}</p>
                <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-white/85">
                  <strong className="text-white">Conseil : </strong>
                  {alert.recommendation}
                </div>
                {/* "Why this prediction?" Button */}
                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] text-white/50">Valeur : {alert.metricValue}</span>
                  <button
                    onClick={() => {
                      setViewMode('scientific');
                      setSelectedAlertForWhy(alert.id);
                    }}
                    className="flex items-center gap-1 text-[#38bdf8] text-[11px] font-medium hover:underline"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Pourquoi cette prédiction ?</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Probabilistic Rainfall & Temperature Evolution */}
          <div className="apple-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Probabilités de Pluie & Précipitations (7 jours)
              </span>
              <span className="text-[10px] text-white/40 font-mono">Modèle AROME / AIFS</span>
            </div>
            <div className="flex flex-col divide-y divide-white/[0.06]">
              {(weather?.daily || []).slice(0, 5).map((d) => (
                <div key={d.date} className="py-2 flex items-center justify-between text-xs">
                  <span className="w-24 font-medium text-white/80 capitalize">
                    {new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex-1 mx-3 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#38bdf8] rounded-full"
                        style={{ width: `${d.precipitationProbabilityMax}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-[#38bdf8] w-8 text-right font-medium">
                      {d.precipitationProbabilityMax}%
                    </span>
                  </div>
                  <span className="w-16 text-right font-mono text-white/60">
                    {d.precipitationSum > 0 ? `${d.precipitationSum} mm` : 'Sec'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}

      {/* VIEW MODE 2: DETAILED SCIENTIFIC EXPLANATIONS (POURQUOI CETTE PRÉDICTION ?) */}
      {viewMode === 'scientific' && (
        <div className="flex flex-col gap-5 animate-in fade-in duration-200">
          {/* Transparency Disclaimer Card */}
          <div className="apple-card p-4 bg-sky-950/20 border-sky-800/30 text-xs text-white/80 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#38bdf8] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Transparence scientifique</p>
              <p className="text-[11px] text-white/60 mt-0.5 leading-relaxed">
                Chaque recommandation repose sur un seuil agronomique publié (Terres Inovia), une
                règle déterministe ou un seuil réglementaire. Les valeurs non sourcées (humidité du
                grain, seuils non publiés) ne sont pas affichées : elles sont indiquées « non
                disponible » plutôt qu'inventées.
              </p>
            </div>
          </div>

          {/* Scientific Decision Traces Grid */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50 px-1">
              Traçabilité des Décisions & Seuils
            </span>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {decisionTraces.map((trace) => {
              const isSelected = selectedAlertForWhy !== null && (
                (selectedAlertForWhy.includes('heat') && trace.id.includes('heat')) ||
                (selectedAlertForWhy.includes('spray') && trace.id.includes('spray')) ||
                (selectedAlertForWhy.includes('harvest') && trace.id.includes('harvest'))
              );
              return (
              <div
                key={trace.id}
                className={`apple-card p-4 flex flex-col gap-3 transition-all ${
                  isSelected ? 'border-[#38bdf8] bg-sky-950/30' : ''
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                  <div>
                    <h3 className="text-xs font-semibold text-white">{trace.title}</h3>
                    <p className="text-[10px] text-white/40 mt-0.5">{trace.ruleType}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      trace.isTriggered ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {trace.status}
                  </span>
                </div>
                {/* Condition / threshold */}
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-[11px] text-white/80">
                  <span className="text-white/40 block text-[9px] uppercase tracking-wide">Condition :</span>
                  {trace.formula}
                </div>
                {/* Justification */}
                <p className="text-xs text-white/75 leading-relaxed">
                  {trace.scientificExplanation}
                </p>
                {/* Parameters & Thresholds Table */}
                {trace.parameters.length > 0 && (
                  <div className="pt-2 border-t border-white/[0.06] flex flex-col gap-1.5 text-xs">
                    {trace.parameters.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px]">
                        <span className="text-white/60">{p.name} :</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-white font-medium">{p.value}</span>
                          <span className="text-white/40 text-[10px]">(Seuil : {p.threshold})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              );
            })}
            </div>
          </div>

          {/* Data Sources Attribution & Uncertainty */}
          <div className="apple-card p-4 flex flex-col gap-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50 pb-2 border-b border-white/[0.08]">
              Modèles Météorologiques & Sources
            </span>
            <div className="flex flex-col gap-2 text-xs text-white/70 leading-relaxed">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">Court terme (0 - 48h) :</span>
                <span className="text-white/50 font-mono">Météo-France AROME France HD (via Open-Meteo)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">Moyen terme (jusqu'à 10j) :</span>
                <span className="text-white/50 font-mono">ECMWF AIFS ensemble (via Open-Meteo)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">Seuils agronomiques :</span>
                <span className="text-white/50 font-mono">Terres Inovia (publiés)</span>
              </div>
              <p className="text-[11px] text-white/45 mt-1">
                Les probabilités de pluie proviennent de la dispersion des membres de l'ensemble AIFS
                (incertitude explicite). Indicateurs météo, non des mesures de parcelle.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
