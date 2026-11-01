import React, { useMemo, useRef, useState } from 'react';
import { CloudOff, MessageCircle, RefreshCw, Thermometer } from 'lucide-react';
import type { LocationWeatherData } from '../../types/weather';
import type { SelectedField, AgriculturalRiskAlert } from '../../types/agricultural';
import type { AssessResponse } from '../../types/backend-contract';
import type { BackendStatus } from '../../hooks/useBackendAssess';
import { getCropNameFr, getGrowthStageFr } from '../../services/agriRiskService';
import { LEGUME_CROPS_CATALOG } from '../../data/legumeCatalog';
import {
  getSourcedFloweringHeat,
  SPRAYING_WIND_LIMIT_KMH,
  SPRAYING_SOURCE,
} from '../../data/sourcedAgronomy';
import { isDemoField } from '../../services/provenance';
import { useNow } from '../../hooks/useNow';
import { computeExposure, hourlyFromBackend, resolveHeatThreshold, selectWindow } from '../../services/heatRisk';
import { DemoFieldBadge } from '../Common/ProvenanceBadge';
import { RiskPredictionCard } from '../Scientific/RiskPredictionCard';
import { HarvestRecommendationsCard } from '../Scientific/HarvestRecommendationsCard';
import { UncertaintyRainChart } from '../Scientific/UncertaintyRainChart';
import { SourceCitedAdviceCard } from '../Scientific/SourceCitedAdviceCard';
import { FloweringHeatRiskChart } from '../Scientific/FloweringHeatRiskChart';
import { SoilIntelligencePanel } from '../Scientific/SoilIntelligencePanel';
import { ExplainabilityPanel, type DecisionTrace } from '../Scientific/ExplainabilityPanel';

interface ForecastInsightsViewProps {
  weather: LocationWeatherData | null;
  field: SelectedField | null;
  alerts: AgriculturalRiskAlert[];
  backendStatus?: BackendStatus;
  backendResponse?: AssessResponse | null;
  onOpenFieldConfig: () => void;
  onAskAmi: (question: string) => void;
}

type SciTab = 'risk' | 'evolution' | 'scenarios' | 'method';
const TABS: Array<{ id: SciTab; label: string }> = [
  { id: 'risk', label: 'Risque' },
  { id: 'evolution', label: 'Évolution' },
  { id: 'scenarios', label: 'Scénarios' },
  { id: 'method', label: 'Méthode' },
];

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
  onAskAmi,
}) => {
  const clock = useNow();
  const [tab, setTab] = useState<SciTab>('risk');
  const [evolutionView, setEvolutionView] = useState<'heat' | 'rain'>('heat');
  const [selectedAlertForWhy, setSelectedAlertForWhy] = useState<string | null>(null);
  const tabRefs = useRef<Record<SciTab, HTMLButtonElement | null>>({ risk: null, evolution: null, scenarios: null, method: null });

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

  // Compact heat exposure for the summary card, from the same hourly points as the chart.
  const heatSummary = useMemo(() => {
    if (!field) return null;
    const resolution = resolveHeatThreshold(field, backendResponse?.risk?.alerts);
    if (resolution.kind !== 'threshold') return { resolution, hours: null as number | null, window: 0 };
    const win = selectWindow(hourlyFromBackend(backendResponse), 48, clock);
    if (win.length < 2) return { resolution, hours: null as number | null, window: 0 };
    return { resolution, hours: computeExposure(win, resolution.threshold.value).hoursAbove, window: win.length };
  }, [field, backendResponse, clock]);

  const blockedSpraying = (backendResponse?.regulatory_windows ?? []).filter((w) => !w.spraying_allowed);
  const harvest = backendResponse?.harvest;

  const askHeat = field
    ? `Quel est le risque de chaleur pour mon ${getCropNameFr(field.cropType).toLowerCase()} (${getGrowthStageFr(field.growthStage).toLowerCase()}) dans les 48 prochaines heures ?`
    : 'Quels sont les seuils de stress thermique sur les protéagineux ?';

  const goToHeat = () => {
    setEvolutionView('heat');
    setTab('evolution');
  };

  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    const next = e.key === 'ArrowRight' ? index + 1 : e.key === 'ArrowLeft' ? index - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const target = TABS[(next + TABS.length) % TABS.length].id;
    setTab(target);
    tabRefs.current[target]?.focus();
  };

  const statusPill =
    backendStatus === 'ok' ? (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> API Légume'Ami en direct
      </span>
    ) : backendStatus === 'loading' ? (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-[#38bdf8]">
        <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" /> Synchronisation…
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-200">
        <CloudOff className="w-3 h-3" aria-hidden="true" /> API indisponible : règles locales sourcées
      </span>
    );

  const retrieved = backendResponse?.provenance?.retrieved_at_utc
    ? new Date(backendResponse.provenance.retrieved_at_utc).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="app-page-scroll flex-1 overflow-y-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-6 max-w-5xl mx-auto w-full flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <img src="/legumeAmi.png" alt="Logo Légume'Ami" className="w-10 h-10 object-contain drop-shadow-md flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">Analyses</h1>
            {field ? (
              <>
                <p className="text-xs text-white/70 leading-snug flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium">{field.name}</span>
                  {isDemoField(field) && <DemoFieldBadge />}
                </p>
                <p className="text-xs text-white/50 leading-snug">
                  {getCropNameFr(field.cropType)} · {getGrowthStageFr(field.growthStage)}
                </p>
              </>
            ) : (
              <p className="text-xs text-white/55">Aucune parcelle sélectionnée</p>
            )}
            <p className="mt-1 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
              {statusPill}
              {retrieved && <span className="text-[11px] text-white/40">prévision du {retrieved}</span>}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onAskAmi(askHeat)}
          data-testid="insights-ask-ami"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex-shrink-0 active:scale-95"
        >
          <MessageCircle className="w-3.5 h-3.5 text-[#7cc4ff]" aria-hidden="true" />
          <span className="hidden sm:inline">Demander à Ami</span>
          <span className="sm:hidden">Ami</span>
        </button>
      </header>

      {/* Compact scientific panel: Risque / Évolution / Scénarios / Méthode */}
      <div role="tablist" aria-label="Analyses scientifiques" className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-black/30 border border-white/[0.08]">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el;
            }}
            id={`sci-tab-${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`sci-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onTabKey(e, i)}
            data-testid={`tab-${t.id}`}
            className={`py-2 rounded-xl text-xs font-semibold transition-colors ${tab === t.id ? 'bg-white text-black shadow' : 'text-white/65 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* RISQUE */}
      {tab === 'risk' && (
        <div role="tabpanel" id="sci-panel-risk" aria-labelledby="sci-tab-risk" className="flex flex-col gap-3" data-testid="panel-risk">
          {field && heatSummary && (
            <section className="apple-card p-4 flex items-center justify-between gap-3" data-testid="heat-summary-card">
              <div className="flex items-start gap-3 min-w-0">
                <span className="w-9 h-9 rounded-2xl bg-orange-500/20 text-orange-300 flex items-center justify-center flex-shrink-0">
                  <Thermometer className="w-4 h-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-white leading-snug">Chaleur en floraison</h2>
                  {heatSummary.resolution.kind === 'threshold' && heatSummary.hours !== null ? (
                    <p className="text-xs text-white/65 leading-relaxed">
                      <span className="font-mono text-white" data-testid="heat-summary-hours">{heatSummary.hours} h</span> au-dessus de{' '}
                      {heatSummary.resolution.threshold.value} °C sur les {heatSummary.window} prochaines heures.
                    </p>
                  ) : (
                    <p className="text-xs text-white/55 leading-relaxed">
                      {heatSummary.resolution.kind === 'none' ? heatSummary.resolution.reason : 'Prévision horaire indisponible.'}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={goToHeat}
                data-testid="open-heat-curve"
                className="px-3.5 py-2 rounded-full bg-white text-black text-xs font-semibold flex-shrink-0 active:scale-95"
              >
                Voir la courbe
              </button>
            </section>
          )}

          {backendResponse?.risk?.alerts && backendResponse.risk.alerts.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {backendResponse.risk.alerts.map((alert, idx) => (
                <RiskPredictionCard
                  key={`${alert.hazard_type}_${idx}`}
                  alert={alert}
                  onWhyClick={() => {
                    setSelectedAlertForWhy('trace_heat');
                    setTab('method');
                  }}
                />
              ))}
            </div>
          ) : alerts.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {alerts.map((alert) => (
                <article key={alert.id} className="apple-card p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold text-white leading-snug">{alert.title}</h2>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${
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
                  <p className="text-xs text-white/60 leading-relaxed">{alert.recommendation}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="apple-card p-4 text-xs text-white/65 leading-relaxed" data-testid="no-risk">
              Aucun seuil publié n'est dépassé dans la prévision actuelle pour ce stade. Les seuils sans source publiée ne sont jamais affichés.
            </div>
          )}

          <details className="apple-card group" data-testid="spraying-details">
            <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-white">Traitement : réglementation du vent</span>
              <span className={blockedSpraying.length ? 'text-amber-200' : 'text-white/55'}>
                {backendResponse
                  ? blockedSpraying.length
                    ? `vent > ${SPRAYING_WIND_LIMIT_KMH} km/h prévu ${blockedSpraying.length} jour${blockedSpraying.length > 1 ? 's' : ''}`
                    : 'aucun jour au-dessus de la limite'
                  : `limite ${SPRAYING_WIND_LIMIT_KMH} km/h`}
              </span>
            </summary>
            <div className="px-3 pb-3">
              {backendResponse?.regulatory_windows ? (
                <SourceCitedAdviceCard regulatoryWindows={backendResponse.regulatory_windows} cropLabel={crop?.labelFr || 'Légumineuse'} />
              ) : (
                <p className="px-1 text-xs text-white/65 leading-relaxed">
                  {SPRAYING_SOURCE.label}. La prévision de vent par jour sera affichée dès que l'API répond.
                </p>
              )}
            </div>
          </details>

          <details className="apple-card" data-testid="harvest-details">
            <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-white">Récolte : aide météo</span>
              <span className="text-white/55">
                {harvest
                  ? harvest.available
                    ? harvest.recommended_date_local
                      ? `créneau ${harvest.recommended_date_local}`
                      : 'aucun créneau favorable'
                    : field
                      ? `non engagée (${getGrowthStageFr(field.growthStage).toLowerCase()})`
                      : 'non engagée'
                  : 'en attente de l\u2019API'}
              </span>
            </summary>
            <div className="px-3 pb-3">
              {harvest ? (
                <HarvestRecommendationsCard harvest={harvest} cropName={crop?.labelFr || 'Culture'} stageName={field ? getGrowthStageFr(field.growthStage) : 'Stade'} />
              ) : (
                <p className="px-1 text-xs text-white/65">Le classement des créneaux nécessite la réponse de l'API.</p>
              )}
            </div>
          </details>

          {field && (
            <button
              type="button"
              onClick={onOpenFieldConfig}
              className="self-start text-xs text-[#38bdf8] hover:underline"
            >
              Le stade ne correspond pas ? Modifier la culture ou le stade
            </button>
          )}
        </div>
      )}

      {/* ÉVOLUTION */}
      {tab === 'evolution' && (
        <div role="tabpanel" id="sci-panel-evolution" aria-labelledby="sci-tab-evolution" className="flex flex-col gap-3" data-testid="panel-evolution">
          <div role="group" aria-label="Variable à afficher" className="self-start flex p-0.5 rounded-full bg-black/30">
            {([
              ['heat', 'Chaleur'],
              ['rain', 'Pluie'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={evolutionView === id}
                onClick={() => setEvolutionView(id)}
                data-testid={`evolution-${id}`}
                className={`px-4 py-1.5 rounded-full text-xs font-medium ${evolutionView === id ? 'bg-white text-black' : 'text-white/65 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {evolutionView === 'heat' && field && (
            <FloweringHeatRiskChart field={field} backendResponse={backendResponse} fallbackWeather={weather} />
          )}

          {evolutionView === 'rain' &&
            (backendResponse?.ensemble ? (
              <UncertaintyRainChart ensemble={backendResponse.ensemble} />
            ) : (
              <div className="apple-card p-4 text-xs text-white/65 leading-relaxed" data-testid="rain-unavailable">
                <p className="font-semibold text-white mb-1">Incertitude de pluie indisponible</p>
                L'ensemble AIFS est fourni par l'API, qui ne répond pas pour le moment. Prévision déterministe des prochains jours (Open-Meteo) :
                <ul className="mt-2 divide-y divide-white/[0.06]">
                  {(weather?.daily ?? []).slice(0, 5).map((d) => (
                    <li key={d.date} className="py-1.5 flex justify-between">
                      <span className="capitalize">{new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</span>
                      <span className="font-mono">{d.precipitationSum > 0 ? `${d.precipitationSum} mm` : 'sec'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}

      {/* SCÉNARIOS (sol) */}
      {tab === 'scenarios' && field && (
        <div role="tabpanel" id="sci-panel-scenarios" aria-labelledby="sci-tab-scenarios" data-testid="panel-scenarios">
          <SoilIntelligencePanel field={field} />
        </div>
      )}

      {/* MÉTHODE */}
      {tab === 'method' && (
        <div role="tabpanel" id="sci-panel-method" aria-labelledby="sci-tab-method" className="flex flex-col gap-3" data-testid="panel-method">
          <ExplainabilityPanel traces={decisionTraces} selectedTraceId={selectedAlertForWhy} shapOutputs={null} />
          <div className="apple-card p-4 flex flex-col gap-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">Provenance des données</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-white/70">
              <div className="rounded-xl bg-white/[0.04] p-2.5">
                <dt className="font-semibold text-white">Court terme (0 à 48 h)</dt>
                <dd className="font-mono text-[11px] text-[#38bdf8]">{backendResponse?.provenance?.arome_model_id || 'meteofrance_arome_france_hd'}</dd>
                <dd className="text-[10px] text-white/45">Modèle haute résolution de Météo-France</dd>
              </div>
              <div className="rounded-xl bg-white/[0.04] p-2.5">
                <dt className="font-semibold text-white">Moyen terme et incertitude</dt>
                <dd className="font-mono text-[11px] text-[#38bdf8]">{backendResponse?.provenance?.aifs_model_id || 'ecmwf_aifs025_ensemble'}</dd>
                <dd className="text-[10px] text-white/45">Ensemble de {backendResponse?.ensemble?.ensemble_members_valid ?? 51} membres de l'ECMWF</dd>
              </div>
              <div className="rounded-xl bg-white/[0.04] p-2.5">
                <dt className="font-semibold text-white">Seuils agronomiques</dt>
                <dd className="text-[11px] text-emerald-300">Terres Inovia, seuils publiés</dd>
                <dd className="text-[10px] text-white/45">Les cultures sans seuil publié n'ont aucune alerte de chaleur.</dd>
              </div>
              <div className="rounded-xl bg-white/[0.04] p-2.5">
                <dt className="font-semibold text-white">Dernière récupération</dt>
                <dd className="font-mono text-[11px] text-white/80">{backendResponse?.provenance?.retrieved_at_utc || 'En attente de synchronisation'}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
};
