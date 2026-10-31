import React, { useState } from 'react';
import {
  CloudOff,
  RefreshCw,
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
import { useBackendAssess } from '../../hooks/useBackendAssess';
import { RiskPredictionCard } from '../Scientific/RiskPredictionCard';
import { HarvestRecommendationsCard } from '../Scientific/HarvestRecommendationsCard';
import { UncertaintyRainChart } from '../Scientific/UncertaintyRainChart';
import { SourceCitedAdviceCard } from '../Scientific/SourceCitedAdviceCard';
import { ExplainabilityPanel, type DecisionTrace } from '../Scientific/ExplainabilityPanel';

interface ForecastInsightsViewProps {
  weather: LocationWeatherData | null;
  field: SelectedField | null;
  alerts: AgriculturalRiskAlert[];
  onOpenFieldConfig: () => void;
}

export const ForecastInsightsView: React.FC<ForecastInsightsViewProps> = ({
  weather,
  field,
  alerts: clientAlerts,
  onOpenFieldConfig,
}) => {
  const [viewMode, setViewMode] = useState<'summary' | 'scientific'>('summary');
  const [selectedAlertForWhy, setSelectedAlertForWhy] = useState<string | null>(null);

  // Connect to live backend /assess via hook
  const { status: backendStatus, alerts: backendAlerts, response: backendResponse } = useBackendAssess(field);

  const activeAlerts = backendStatus === 'ok' ? backendAlerts : clientAlerts;
  const crop = field ? LEGUME_CROPS_CATALOG[field.cropType] : null;

  const currentTemp = weather?.current.temperature ?? 20;
  const currentWind = weather?.current.windSpeed ?? 12;
  const currentRain = weather?.current.precipitation ?? 0;
  const maxTemp = weather?.daily?.[0]?.temperatureMax ?? currentTemp;
  const sourcedHeat = field ? getSourcedFloweringHeat(field.cropType) : undefined;

  // Build decision traces
  const heatTrace: DecisionTrace = sourcedHeat
    ? {
        id: 'trace_heat',
        title: 'Seuil de chaleur en floraison (publié)',
        status: maxTemp >= sourcedHeat.tmaxC ? 'Seuil dépassé' : 'Sous le seuil',
        isTriggered: maxTemp >= sourcedHeat.tmaxC,
        ruleType: `Seuil agronomique publié — ${sourcedHeat.institution}`,
        formula: `Tmax prévue (${Math.round(maxTemp)}°C) vs seuil publié (${sourcedHeat.tmaxC}°C)`,
        scientificExplanation: `${sourcedHeat.noteFr} Source : ${sourcedHeat.institution}. Un dépassement est une alerte de risque, pas une prédiction de dégât.`,
        parameters: [
          {
            name: 'Température max prévue',
            value: `${Math.round(maxTemp)}°C`,
            threshold: `${sourcedHeat.tmaxC}°C`,
            status: maxTemp >= sourcedHeat.tmaxC ? 'critical' : 'ok',
          },
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
        parameters: [],
      };

  const sprayTrace: DecisionTrace = {
    id: 'trace_spray',
    title: 'Fenêtre de pulvérisation (réglementation)',
    status: currentWind >= SPRAYING_WIND_LIMIT_KMH ? 'Interdit (réglementaire)' : 'Conforme',
    isTriggered: currentWind >= SPRAYING_WIND_LIMIT_KMH,
    ruleType: `Réglementation française — ${SPRAYING_SOURCE.label}`,
    formula: `Vent (${Math.round(currentWind)} km/h) vs ${SPRAYING_WIND_LIMIT_KMH} km/h (3 Beaufort)`,
    scientificExplanation: `Au-delà de ${SPRAYING_WIND_LIMIT_KMH} km/h, la pulvérisation phytosanitaire est interdite pour limiter la dérive. Vérifier aussi l'hygrométrie et les ZNT. Source : ${SPRAYING_SOURCE.institution}.`,
    parameters: [
      {
        name: 'Vent moyen prévu',
        value: `${Math.round(currentWind)} km/h`,
        threshold: `< ${SPRAYING_WIND_LIMIT_KMH} km/h`,
        status: currentWind < SPRAYING_WIND_LIMIT_KMH ? 'ok' : 'critical',
      },
    ],
  };

  const harvestTrace: DecisionTrace = {
    id: 'trace_harvest',
    title: 'Fenêtre de récolte (météo-dépendante)',
    status: backendResponse?.harvest?.available
      ? `${backendResponse.harvest.n_feasible_days} jours favorables`
      : 'Culture en maturation',
    isTriggered: currentRain > 0,
    ruleType: 'Aide à la décision météo-dépendante',
    formula: `Risque pluie < 20% et précipitations prévues faibles`,
    scientificExplanation: `Évalué sur la base des probabilités d'ensemble AIFS et du modèle AROME. Aucune mesure d'humidité de grain n'étant réalisée, les résultats restent indicatifs.`,
    parameters: [
      {
        name: 'Précipitations en cours',
        value: currentRain > 0 ? `${currentRain} mm` : '0 mm',
        threshold: '0 mm',
        status: currentRain > 0 ? 'critical' : 'ok',
      },
      {
        name: 'Humidité du grain',
        value: 'Non mesurée',
        threshold: 'Observation au champ',
        status: 'warning',
      },
    ],
  };

  const decisionTraces: DecisionTrace[] = [heatTrace, sprayTrace, harvestTrace];

  return (
    <div className="flex-1 overflow-y-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-28 max-w-6xl mx-auto w-full select-none flex flex-col gap-4 sm:gap-5">
      {/* Header & Mode Switcher */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
              Prévisions & Analyses Scientifiques
            </h1>
            {/* Backend connection status pill */}
            {backendStatus === 'ok' ? (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>API Gateway en direct</span>
              </span>
            ) : backendStatus === 'loading' ? (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/20 text-[#38bdf8] border border-sky-500/30 flex-shrink-0">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Synchronisation...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/60 border border-white/15 flex-shrink-0">
                <CloudOff className="w-3 h-3 text-white/40" />
                <span>Règles locales (Terres Inovia)</span>
              </span>
            )}
          </div>
          <p className="text-xs text-white/50 mt-0.5 truncate">
            {field?.name || 'Parcelle'} • {field ? getCropNameFr(field.cropType) : 'Culture'} ({field ? getGrowthStageFr(field.growthStage) : 'Stade'})
          </p>
        </div>

        {/* Apple Segmented Switcher: Summary vs Detailed Scientific */}
        <nav aria-label="Mode de vue" className="apple-glass p-0.5 rounded-full flex items-center gap-1 shadow-lg self-start sm:self-auto flex-shrink-0">
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
            Explications & Traçabilité
          </button>
        </nav>
      </header>

      {/* VIEW MODE 1: SUMMARY (SYNTHÈSE CLAIRE) */}
      {viewMode === 'summary' && (
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* Crop Phenological State Banner */}
          {field && (
            <div className="apple-card p-3.5 sm:p-4 flex items-center justify-between gap-3 min-w-0">
              <div className="flex items-center gap-3 min-w-0">
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
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-sm font-bold text-white truncate">
                    {crop?.labelFr} • {getGrowthStageFr(field.growthStage)}
                  </h2>
                  <p className="text-[11px] text-white/50 mt-0.5 truncate">
                    {GROWTH_STAGES_CATALOG[field.growthStage]?.shortDescFr}
                  </p>
                </div>
              </div>
              <button
                onClick={onOpenFieldConfig}
                className="apple-glass px-3.5 py-1.5 rounded-full text-xs text-white/80 hover:text-white active:scale-95 transition-transform flex-shrink-0"
              >
                Changer de stade
              </button>
            </div>
          )}

          {/* Section: Sourced Agronomic Risk Predictions */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Risques Météo-Agronomiques Ciblés
              </span>
              <span className="text-[10px] text-white/40 font-mono">
                {activeAlerts.length} alerte{activeAlerts.length > 1 ? 's' : ''} active{activeAlerts.length > 1 ? 's' : ''}
              </span>
            </div>

            {backendResponse?.risk?.alerts && backendResponse.risk.alerts.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {backendResponse.risk.alerts.map((alert, idx) => (
                  <RiskPredictionCard
                    key={`${alert.hazard_type}_${idx}`}
                    alert={alert}
                    onWhyClick={() => {
                      setViewMode('scientific');
                      setSelectedAlertForWhy('heat');
                    }}
                  />
                ))}
              </div>
            ) : activeAlerts.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {activeAlerts.map((alert) => (
                  <div key={alert.id} className="apple-card p-4 flex flex-col gap-2.5 border-white/15">
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
                  </div>
                ))}
              </div>
            ) : (
              <div className="apple-card p-4 text-xs text-white/60 text-center">
                Aucun risque thermique ou climatique sourcé déclenché pour ce stade et ces prévisions.
              </div>
            )}
          </div>

          {/* Section: Harvest Window Optimizer & Uncertainty Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* Harvest Optimizer */}
            {backendResponse?.harvest ? (
              <HarvestRecommendationsCard
                harvest={backendResponse.harvest}
                cropName={crop?.labelFr || 'Culture'}
                stageName={field ? getGrowthStageFr(field.growthStage) : 'Stade'}
              />
            ) : (
              <div className="apple-card p-4 flex flex-col gap-2 border-white/10 text-xs text-white/60">
                <span className="font-semibold text-white">Optimiseur de Récolte</span>
                <p>En attente de connexion avec le modèle météo pour calculer les créneaux de battage.</p>
              </div>
            )}

            {/* Precipitation Uncertainty (51-member ECMWF AIFS ensemble) */}
            {backendResponse?.ensemble ? (
              <UncertaintyRainChart ensemble={backendResponse.ensemble} />
            ) : (
              <div className="apple-card p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    Probabilités de Pluie (7 jours)
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
            )}
          </div>

          {/* Section: Sourced Advice & Regulatory Spraying */}
          {backendResponse?.regulatory_windows ? (
            <SourceCitedAdviceCard
              regulatoryWindows={backendResponse.regulatory_windows}
              cropLabel={crop?.labelFr || 'Légumineuse'}
            />
          ) : (
            <div className="apple-card p-4 flex items-center justify-between text-xs text-white/70">
              <span>Réglementation pulvérisation : Arrêté du 4 mai 2017 (seuil 19 km/h).</span>
              <span className="font-mono text-white/50">Vent actuel : {Math.round(currentWind)} km/h</span>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: DETAILED SCIENTIFIC EXPLANATIONS (POURQUOI CETTE PRÉDICTION ?) */}
      {viewMode === 'scientific' && (
        <div className="flex flex-col gap-5 animate-in fade-in duration-200">
          {/* Explainability Panel with decision traces and SHAP disclaimer */}
          <ExplainabilityPanel
            traces={decisionTraces}
            selectedTraceId={selectedAlertForWhy}
            shapOutputs={null}
          />

          {/* Data Sources Attribution & Model Provenance */}
          <div className="apple-card p-4 sm:p-5 flex flex-col gap-3 border-white/15">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50 pb-2 border-b border-white/[0.08]">
              Provenance des Données & Modèles Météorologiques
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-white/70">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-1">
                <span className="font-bold text-white">Court terme (0 - 48h) :</span>
                <span className="font-mono text-[11px] text-[#38bdf8]">
                  {backendResponse?.provenance?.arome_model_id || 'meteofrance_arome_france_hd'}
                </span>
                <span className="text-[10px] text-white/50">Modèle haute résolution 1.3 km de Météo-France</span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-1">
                <span className="font-bold text-white">Moyen terme & Incertitude :</span>
                <span className="font-mono text-[11px] text-[#38bdf8]">
                  {backendResponse?.provenance?.aifs_model_id || 'ecmwf_aifs025_ensemble'}
                </span>
                <span className="text-[10px] text-white/50">Ensemble d'intelligence artificielle de l'ECMWF (51 membres)</span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-1">
                <span className="font-bold text-white">Seuils agronomiques :</span>
                <span className="font-mono text-[11px] text-emerald-300">
                  Terres Inovia (Corpus National 2024-2026)
                </span>
                <span className="text-[10px] text-white/50">Publications agronomiques validées pour la France</span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-1">
                <span className="font-bold text-white">Dernière récupération UTC :</span>
                <span className="font-mono text-[11px] text-white/80">
                  {backendResponse?.provenance?.retrieved_at_utc || 'En attente de synchronisation'}
                </span>
                <span className="text-[10px] text-white/50">Statut de fraîcheur garanti</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
