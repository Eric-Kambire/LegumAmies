import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, MapPin, MessageCircle, Plus, Sprout, WifiOff } from 'lucide-react';
import type { SelectedField, AgriculturalRiskAlert, RiskSeverity } from '../../types/agricultural';
import type { LocationWeatherData } from '../../types/weather';
import type { BackendStatus } from '../../hooks/useBackendAssess';
import { getCropNameFr, getGrowthStageFr } from '../../services/agriRiskService';
import { isDemoField } from '../../services/provenance';
import { LEGUME_CROPS_CATALOG } from '../../data/legumeCatalog';
import { CropGlyph } from '../Common/LegumeGlyphs';
import { DemoFieldBadge } from '../Common/ProvenanceBadge';

interface HomeViewProps {
  fields: SelectedField[];
  activeField: SelectedField | null;
  onSelectActiveField: (field: SelectedField) => void;
  /** Weather of the selected FIELD (not of an inspected map point). */
  weather: LocationWeatherData | null;
  alerts: AgriculturalRiskAlert[];
  backendStatus: BackendStatus;
  onNavigateToTab: (tab: 'weather' | 'fields' | 'insights' | 'notifications') => void;
  onOpenCreateField: () => void;
  onAskAmi: (question: string) => void;
  currentHour: number;
}

const SEVERITY_RANK: Record<RiskSeverity, number> = { critique: 3, alerte: 2, vigilance: 1, favorable: 0 };

const SEVERITY_STYLE: Record<RiskSeverity, { chip: string; label: string }> = {
  critique: { chip: 'bg-rose-500/20 text-rose-200 border-rose-500/30', label: 'Critique' },
  alerte: { chip: 'bg-amber-500/20 text-amber-200 border-amber-500/30', label: 'Alerte' },
  vigilance: { chip: 'bg-sky-500/20 text-sky-200 border-sky-500/30', label: 'Vigilance' },
  favorable: { chip: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30', label: 'Favorable' },
};

const shortName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '').trim() || name;

export const HomeView: React.FC<HomeViewProps> = ({
  fields,
  activeField,
  onSelectActiveField,
  weather,
  alerts,
  backendStatus,
  onNavigateToTab,
  onOpenCreateField,
  onAskAmi,
  currentHour,
}) => {
  const greeting = currentHour < 6 ? 'Bonne nuit' : currentHour < 18 ? 'Bonjour' : 'Bonsoir';
  const timeOfDay = currentHour < 6 ? 'Cette nuit' : currentHour < 12 ? 'Ce matin' : currentHour < 18 ? 'Cet après-midi' : 'Ce soir';
  const isFirstVisit = fields.length > 0 && fields.every(isDemoField);

  const topRisk = [...alerts]
    .filter((a) => a.severity !== 'favorable')
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])[0];

  const crop = activeField ? getCropNameFr(activeField.cropType) : '';
  const stage = activeField ? getGrowthStageFr(activeField.growthStage) : '';

  const briefing = (() => {
    if (!weather) return null;
    const c = weather.current;
    const base = `${timeOfDay} : ${Math.round(c.temperature)} °C, vent ${Math.round(c.windSpeed)} km/h, humidité ${c.relativeHumidity} %.`;
    return c.precipitation > 0 ? `${base} ${c.precipitation.toFixed(1)} mm de pluie dans l'heure.` : base;
  })();

  const retrieved = weather ? new Date(weather.retrievedAt) : null;
  const retrievedLabel =
    retrieved && !Number.isNaN(retrieved.getTime())
      ? retrieved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : null;

  const askQuestion = topRisk
    ? `Explique-moi ce risque pour ma parcelle : ${topRisk.title}`
    : `Quelles sont les conditions cette semaine pour mon ${crop.toLowerCase()} ?`;

  return (
    <div className="app-page-scroll flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pt-5 max-w-5xl mx-auto w-full flex flex-col gap-4">
      {/* Header: one line of context, one title */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/legumeAmi.png" alt="Logo Légume'Ami" className="w-11 h-11 object-contain drop-shadow-lg flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white leading-tight">{greeting}</h1>
            <p className="text-xs text-white/55 leading-snug">
              {isFirstVisit ? 'Voici une parcelle d\u2019exemple pour découvrir l\u2019application.' : 'Voici l\u2019état de votre parcelle.'}
            </p>
          </div>
        </div>
        {!isFirstVisit && (
          <button
            type="button"
            onClick={onOpenCreateField}
            className="w-10 h-10 rounded-full apple-glass flex items-center justify-center text-white shadow-md active:scale-95 flex-shrink-0"
            aria-label="Créer une parcelle"
            title="Créer une parcelle"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </header>

      {/* First visit: the single call to action */}
      {isFirstVisit && (
        <section
          data-testid="first-visit-card"
          className="apple-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-[#0a84ff]/35 bg-gradient-to-br from-[#0a84ff]/15 to-transparent"
        >
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-9 h-9 rounded-2xl bg-[#0a84ff]/25 text-[#7cc4ff] flex items-center justify-center flex-shrink-0">
              <Sprout className="w-4 h-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">Commencez par votre parcelle</h2>
              <p className="text-xs text-white/60 leading-relaxed mt-0.5">
                Indiquez où elle se trouve et ce que vous y cultivez : les prévisions et les risques seront calculés pour elle.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenCreateField}
            data-testid="create-first-field"
            className="px-4 py-2 rounded-full bg-white text-black text-xs font-semibold shadow-md active:scale-95 whitespace-nowrap self-start sm:self-auto"
          >
            Créer ma première parcelle
          </button>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Hero: selected parcel, its real weather, its main risk */}
        {activeField && (
          <section aria-label="Parcelle sélectionnée" className="lg:col-span-7 apple-card p-4 sm:p-5 flex flex-col gap-4" data-testid="home-hero">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 sm:gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-semibold text-white leading-snug">{activeField.name}</h2>
                  {isDemoField(activeField) && <DemoFieldBadge />}
                </div>
                <p className="flex items-center gap-1 text-xs text-white/55 mt-0.5">
                  <MapPin className="w-3 h-3" aria-hidden="true" />
                  {activeField.commune || 'France'}
                  {activeField.areaHectares ? ` · ${activeField.areaHectares} ha` : ''}
                </p>
              </div>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border flex-shrink-0 self-start"
                style={{
                  backgroundColor: LEGUME_CROPS_CATALOG[activeField.cropType]?.accent.bg,
                  color: LEGUME_CROPS_CATALOG[activeField.cropType]?.accent.text,
                  borderColor: LEGUME_CROPS_CATALOG[activeField.cropType]?.accent.border,
                }}
              >
                <CropGlyph crop={activeField.cropType} size={14} />
                <span>
                  {crop} · {stage}
                </span>
              </span>
            </div>

            {weather ? (
              <div className="flex items-end justify-between gap-3">
                <div>
                  <span className="text-6xl font-thin tracking-tighter text-white leading-none">{Math.round(weather.current.temperature)}°</span>
                  <p className="text-xs text-white/60 mt-1">{briefing}</p>
                </div>
              </div>
            ) : (
              <div className="animate-pulse flex flex-col gap-2" role="status" aria-label="Chargement de la météo de la parcelle">
                <div className="h-12 w-24 rounded-xl bg-white/10" />
                <div className="h-3 w-3/4 rounded bg-white/10" />
              </div>
            )}

            {weather?.isCached && (
              <p className="flex items-center gap-1.5 text-[11px] text-amber-200" data-testid="cached-weather">
                <WifiOff className="w-3.5 h-3.5" aria-hidden="true" /> Données en cache : la prévision peut ne plus être à jour.
              </p>
            )}

            {/* Main risk */}
            <div className="rounded-2xl bg-black/25 border border-white/[0.08] p-3.5 flex flex-col gap-2.5" data-testid="main-risk">
              {topRisk ? (
                <>
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[11px] uppercase tracking-wider text-white/45 font-semibold">Risque principal</p>
                        <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${SEVERITY_STYLE[topRisk.severity].chip}`}>
                          {SEVERITY_STYLE[topRisk.severity].label}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-white leading-snug mt-0.5">{topRisk.title}</h3>
                      <p className="text-xs text-white/60 mt-0.5">
                        Prévu : <span className="font-mono text-white/85">{topRisk.metricValue}</span>
                        {topRisk.triggerThreshold ? (
                          <>
                            {' '}
                            · seuil <span className="font-mono text-white/85">{topRisk.triggerThreshold}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <p className="text-xs text-white/70 leading-relaxed">
                    {weather
                      ? 'Aucun seuil publié n\u2019est dépassé dans la prévision actuelle pour ce stade.'
                      : 'Analyse du risque en attente de la prévision.'}
                  </p>
                </div>
              )}
              <p className="text-[10px] text-white/40">
                {backendStatus === 'ok'
                  ? 'Prévision AROME/AIFS via l\u2019API Légume\u2019Ami'
                  : backendStatus === 'loading'
                    ? 'Analyse en cours…'
                    : 'Règles locales sourcées (API indisponible)'}
                {retrievedLabel ? ` · météo de ${retrievedLabel}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateToTab('insights')}
                data-testid="home-primary-cta"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black text-xs font-semibold shadow-md active:scale-95"
              >
                {topRisk ? 'Voir l\u2019analyse du risque' : 'Voir les prévisions'} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateToTab('weather')}
                className="px-3 py-2 rounded-full text-xs font-medium text-white/80 hover:text-white hover:bg-white/10"
              >
                Voir sur la carte
              </button>
              <button
                type="button"
                onClick={() => onAskAmi(askQuestion)}
                data-testid="home-ask-ami"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium text-[#7cc4ff] hover:bg-white/10"
              >
                <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> Demander à Ami
              </button>
            </div>
          </section>
        )}

        {/* Parcels: switch in one tap */}
        <section aria-label="Mes parcelles" className="lg:col-span-5 flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">Mes parcelles</h2>
            <button type="button" onClick={() => onNavigateToTab('fields')} className="text-[11px] text-[#38bdf8] hover:underline font-medium">
              Gérer
            </button>
          </div>
          <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1 -mx-1 px-1 snap-x">
            {fields.map((f) => {
              const selected = activeField?.id === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelectActiveField(f)}
                  aria-pressed={selected}
                  className={`snap-start flex items-center gap-3 text-left px-3 py-2.5 rounded-2xl border min-w-[14rem] lg:min-w-0 transition-colors ${
                    selected ? 'apple-glass border-white/30' : 'apple-card hover:bg-white/[0.1]'
                  }`}
                >
                  <span
                    className="w-8 h-8 rounded-xl flex items-center justify-center border flex-shrink-0"
                    style={{
                      backgroundColor: LEGUME_CROPS_CATALOG[f.cropType]?.accent.bg,
                      color: LEGUME_CROPS_CATALOG[f.cropType]?.accent.text,
                      borderColor: LEGUME_CROPS_CATALOG[f.cropType]?.accent.border,
                    }}
                  >
                    <CropGlyph crop={f.cropType} size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white truncate">{shortName(f.name)}</span>
                      {isDemoField(f) && <DemoFieldBadge />}
                    </span>
                    <span className="block text-[11px] text-white/50 truncate">
                      {f.commune || 'France'} · {getGrowthStageFr(f.growthStage)}
                    </span>
                  </span>
                  {selected && <span className="w-2 h-2 rounded-full bg-[#0a84ff] flex-shrink-0" title="Parcelle active" />}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
