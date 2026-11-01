import React, { useState } from 'react';
import {
  CloudOff,
  RefreshCw,
} from 'lucide-react';
import type { LocationWeatherData } from '../../types/weather';
import type { SelectedField, AgriculturalRiskAlert } from '../../types/agricultural';
import type { AssessResponse } from '../../types/backend-contract';
import type { BackendStatus } from '../../hooks/useBackendAssess';
import { getCropNameFr, getGrowthStageFr } from '../../services/agriRiskService';
import { LEGUME_CROPS_CATALOG, GROWTH_STAGES_CATALOG } from '../../data/legumeCatalog';
import {
  getSourcedFloweringHeat,
  SPRAYING_WIND_LIMIT_KMH,
  SPRAYING_SOURCE,
} from '../../data/sourcedAgronomy';
import { CropGlyph } from '../Common/LegumeGlyphs';
import { RiskPredictionCard } from '../Scientific/RiskPredictionCard';
import { HarvestRecommendationsCard } from '../Scientific/HarvestRecommendationsCard';
import { UncertaintyRainChart } from '../Scientific/UncertaintyRainChart';
import { SourceCitedAdviceCard } from '../Scientific/SourceCitedAdviceCard';
import { ExplainabilityPanel, type DecisionTrace } from '../Scientific/ExplainabilityPanel';
import { FloweringHeatRiskChart } from '../Scientific/FloweringHeatRiskChart';
import { SoilIntelligenceCard } from '../Scientific/SoilIntelligenceCard';

interface ForecastInsightsViewProps {
  weather: LocationWeatherData | null;
  field: SelectedField | null;
  alerts: AgriculturalRiskAlert[];
  backendStatus?: BackendStatus;
  backendResponse?: AssessResponse | null;
  onOpenFieldConfig: () => void;
}

const localizeHarvestNote = (note?: string) =>
  note && /deterministic weather-only decision aid|weather-only,\s*provisional/i.test(note)
    ? 'Aide à la décision fondée uniquement sur la météo, sans validation agronomique complète. La disponibilité du matériel n’est pas fournie : les jours sont considérés disponibles à titre provisoire. L’humidité du grain et la portance du sol ne sont pas mesurées.'
    : note;

export const ForecastInsightsView: React.FC<ForecastInsightsViewProps> = ({
  weather,
  field,
  alerts,
  backendStatus = 'disabled',
  backendResponse = null,
  onOpenFieldConfig,
}) => {
  const [viewMode, setViewMode] = useState<'summary' | 'scientific'>('summary');
  const [selectedAlertForWhy, setSelectedAlertForWhy] = useState<string | null>(null);

  const crop = field ? LEGUME_CROPS_CATALOG[field.cropType] : null;

  // Strict data honesty: do not use factual fake defaults (e.g. 20°C, 12 km/h, 0 mm)
  const currentTemp = weather?.current?.temperature ?? null;
  const currentWind = weather?.current?.windSpeed ?? null;
  const maxTemp = weather?.daily?.[0]?.temperatureMax ?? currentTemp;
  const sourcedHeat = field ? getSourcedFloweringHeat(field.cropType) : undefined;

  // Build decision traces without fabricated values or invented formulas
  const heatTrace: DecisionTrace = sourcedHeat
    ? {
        id: 'trace_heat',
        title: 'Seuil de chaleur en floraison (publié)',
        status:
          maxTemp !== null
            ? maxTemp >= sourcedHeat.tmaxC
              ? 'Seuil dépassé'
              : 'Sous le seuil'
            : 'Donnée météo indisponible',
        isTriggered: maxTemp !== null ? maxTemp >= sourcedHeat.tmaxC : false,
        ruleType: `Seuil agronomique publié — ${sourcedHeat.institution}`,
        formula:
          maxTemp !== null
            ? `Tmax prévue (${Math.round(maxTemp)}°C) vs seuil publié (${sourcedHeat.tmaxC}°C)`
            : `Donnée de température indisponible`,
        scientificExplanation: `${sourcedHeat.noteFr} Source : ${sourcedHeat.institution}. Un dépassement est une alerte de risque, pas une prédiction de dégât.`,
        parameters: [
          {
            name: 'Température max prévue',
            value: maxTemp !== null ? `${Math.round(maxTemp)}°C` : 'Non disponible',
            threshold: `${sourcedHeat.tmaxC}°C`,
            status: maxTemp !== null ? (maxTemp >= sourcedHeat.tmaxC ? 'critical' : 'ok') : 'warning',
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
    title: 'Fenêtre de pulvérisation (réglementation vent)',
    status:
      currentWind !== null
        ? currentWind >= SPRAYING_WIND_LIMIT_KMH
          ? 'Vent > 19 km/h (interdit)'
          : 'Vent ≤ 19 km/h (critère respecté)'
        : 'Donnée de vent indisponible',
    isTriggered: currentWind !== null ? currentWind >= SPRAYING_WIND_LIMIT_KMH : false,
    ruleType: `Réglementation française — ${SPRAYING_SOURCE.label}`,
    formula:
      currentWind !== null
        ? `Vent moyen (${Math.round(currentWind)} km/h) vs limite légale ${SPRAYING_WIND_LIMIT_KMH} km/h (3 Beaufort)`
        : `Donnée de vent non disponible`,
    scientificExplanation: `Au-delà de ${SPRAYING_WIND_LIMIT_KMH} km/h, la pulvérisation phytosanitaire est interdite pour limiter la dérive. Source : ${SPRAYING_SOURCE.institution}. Attention : ce critère ne constitue pas une autorisation globale (l'Arrêté du 4 mai 2017 fixe le seuil légal de vent ; l'hygrométrie > 60% est une recommandation agronomique d'efficacité, non une loi universelle ; vérifier ZNT et DSR).`,
    parameters: [
      {
        name: 'Vent moyen prévu',
        value: currentWind !== null ? `${Math.round(currentWind)} km/h` : 'Non disponible',
        threshold: `< ${SPRAYING_WIND_LIMIT_KMH} km/h`,
        status: currentWind !== null ? (currentWind < SPRAYING_WIND_LIMIT_KMH ? 'ok' : 'critical') : 'warning',
      },
    ],
  };

  const harvestTrace: DecisionTrace = backendResponse?.harvest?.available
    ? {
        id: 'trace_harvest',
        title: 'Fenêtre de récolte (classement météo)',
        status: `${backendResponse.harvest.n_feasible_days} créneaux favorables`,
        isTriggered: true,
        ruleType: 'Classement météo déterministe (sans portance sol)',
        formula: `Pondérations algorithme : ${Object.entries(backendResponse.harvest.weights || {})
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}`,
        scientificExplanation:
          localizeHarvestNote(backendResponse.harvest.days[0]?.explanation) ||
          localizeHarvestNote(backendResponse.harvest.note) ||
          'Classement basé sur les probabilités de pluie AIFS.',
        parameters: [
          {
            name: 'Créneau optimal recommandé',
            value: backendResponse.harvest.recommended_date_local || 'Aucun',
            threshold: 'Date la plus proche sans pluie',
            status: 'ok',
          },
          {
            name: 'Jours favorables identifiés',
            value: `${backendResponse.harvest.n_feasible_days}`,
            threshold: '≥ 1 jour',
            status: backendResponse.harvest.n_feasible_days > 0 ? 'ok' : 'warning',
          },
        ],
      }
    : {
        id: 'trace_harvest',
        title: 'Fenêtre de récolte',
        status: 'Non engagée',
        isTriggered: false,
        ruleType: 'Aide à la décision inactive avant maturité',
        formula: 'Condition : stade phénologique == prêt à récolter',
        scientificExplanation:
          localizeHarvestNote(backendResponse?.harvest?.note) ||
          'La parcelle n\'a pas atteint le stade prêt à récolter. L\'algorithme de battage ne s\'active qu\'à maturité pour éviter les récoltes prématurées.',
        parameters: [
          {
            name: 'Stade phénologique actuel',
            value: field ? getGrowthStageFr(field.growthStage) : 'Non défini',
            threshold: 'Prêt à récolter',
            status: 'warning',
          },
        ],
      };

  const decisionTraces: DecisionTrace[] = [heatTrace, sprayTrace, harvestTrace];

  return (
    <div className="app-page-scroll flex-1 overflow-y-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-6 max-w-6xl mx-auto w-full flex flex-col gap-4 sm:gap-5">
      {/* Header & Mode Switcher */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/legumeAmi.png"
            alt="Légume'Ami Logo"
            className="w-10 h-10 object-contain drop-shadow-md flex-shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
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
            <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
              {field?.name || 'Parcelle'} • {field ? getCropNameFr(field.cropType) : 'Culture'} ({field ? getGrowthStageFr(field.growthStage) : 'Stade'})
            </p>
          </div>
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

          <FloweringHeatRiskChart field={field} assessment={backendResponse} />

          {/* Section: Sourced Agronomic Risk Predictions */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Risques Météo-Agronomiques Ciblés
              </span>
              <span className="text-[10px] text-white/40 font-mono">
                {alerts.length} alerte{alerts.length > 1 ? 's' : ''} active{alerts.length > 1 ? 's' : ''}
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
            ) : alerts.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {alerts.map((alert) => (
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
              <span>Réglementation pulvérisation : Arrêté du 4 mai 2017 (seuil légal 19 km/h).</span>
              <span className="font-mono text-white/50">
                {currentWind !== null ? `Vent prévu : ${Math.round(currentWind)} km/h` : 'Vent non mesuré'}
              </span>
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


          <SoilIntelligenceCard field={field} />

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
