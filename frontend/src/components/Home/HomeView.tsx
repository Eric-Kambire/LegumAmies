import React, { useState } from 'react';
import { Activity, ArrowRight, CloudRain, Droplets, MapPin, Plus, Sprout, ThermometerSun, Tractor, Wind } from 'lucide-react';
import type { SelectedField, AgriculturalRiskAlert } from '../../types/agricultural';
import type { LocationWeatherData } from '../../types/weather';
import type { AssessResponse } from '../../types/backend-contract';
import type { BackendStatus } from '../../hooks/useBackendAssess';
import { getCropNameFr, getGrowthStageFr } from '../../services/agriRiskService';
import { getSourcedFloweringHeat } from '../../data/sourcedAgronomy';
import { SoilIntelligenceCard } from '../Scientific/SoilIntelligenceCard';
import { FieldActivityJournal, readFieldEvents } from '../Fields/FieldActivityJournal';

const DEMO_FIELD_IDS = new Set(['field_lauragais_1', 'field_beauce_2', 'field_berry_3']);
const exampleField = (f: SelectedField) => Boolean(f.isDemo) || DEMO_FIELD_IDS.has(f.id);

interface HomeViewProps {
  fields: SelectedField[];
  activeField: SelectedField | null;
  onSelectActiveField: (field: SelectedField) => void;
  weather: LocationWeatherData | null;
  alerts: AgriculturalRiskAlert[];
  backendResponse?: AssessResponse | null;
  backendStatus?: BackendStatus;
  onNavigateToTab: (tab: 'weather' | 'fields' | 'insights' | 'notifications') => void;
  onOpenCreateField: () => void;
  currentHour: number;
}

export const HomeView: React.FC<HomeViewProps> = ({
  fields, activeField, onSelectActiveField, weather, alerts, backendResponse, backendStatus,
  onNavigateToTab, onOpenCreateField, currentHour,
}) => {
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalVersion, setJournalVersion] = useState(0);
  const records = activeField ? readFieldEvents(activeField.id) : [];
  const irrigation = records.filter((r) => r.type === 'irrigation').sort((a, b) => b.date.localeCompare(a.date))[0];
  void journalVersion;
  const realFields = fields.filter((f) => !exampleField(f));
  const allExamples = realFields.length === 0;
  const threshold = activeField?.growthStage === 'floraison' ? getSourcedFloweringHeat(activeField.cropType) : undefined;
  const temps = backendResponse?.weather.hourly.filter((p) => p.temperature_c !== null) || [];
  const heatHours = threshold ? temps.filter((p) => (p.temperature_c as number) > threshold.tmaxC).length : null;
  const harvest = backendResponse?.harvest;
  const rainNextDays = weather?.daily.slice(0, 3).reduce((v, day) => v + day.precipitationSum, 0);
  const dayLabel = currentHour < 6 ? 'Cette nuit' : currentHour < 12 ? 'Ce matin' : currentHour < 18 ? 'Cet après-midi' : 'Ce soir';
  const majorRisk = alerts.find((a) => a.severity === 'critique' || a.severity === 'alerte') || alerts[0];

  return (
    <div className="app-page-scroll flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pt-5 max-w-7xl mx-auto w-full space-y-4 text-white">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-emerald-300/75 font-semibold">Légume'Ami · Vue d'ensemble</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1">Votre exploitation, en un regard</h1>
          <p className="text-xs text-white/50 mt-1">{allExamples ? `${fields.length} parcelles d'exemple` : `${realFields.length} parcelle(s) enregistrée(s) · ${realFields.reduce((n, f) => n + (f.areaHectares || 0), 0)} ha`} · {dayLabel.toLowerCase()}</p>
        </div>
        <button onClick={onOpenCreateField} className="shrink-0 flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold hover:bg-white/10">
          <Plus className="w-4 h-4"/> <span className="hidden sm:inline">Nouvelle parcelle</span>
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3">
        <section className="apple-card p-4 sm:p-5 bg-gradient-to-br from-[#1b2b3b] to-[#151b2a] flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs text-white/60 min-w-0">
            <MapPin className="w-4 h-4 text-sky-300 shrink-0" />
            <span className="truncate font-semibold text-white">{activeField?.name || 'Sélectionnez une parcelle'}</span>
            <span className="hidden sm:inline">· {activeField?.commune || 'France'}</span>
            {activeField && exampleField(activeField) && <span className="text-[10px] text-amber-300 ml-auto">Exemple</span>}
          </div>
          <div className="flex items-center flex-wrap gap-4 sm:gap-7">
            <div className="flex items-baseline gap-1 text-white"><span className="text-5xl font-light tracking-tighter">{weather ? Math.round(weather.current.temperature) : '—'}</span><span className="text-2xl text-white/60">°C</span></div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <span className="text-xs text-white/65 flex items-center gap-1.5"><Wind className="w-3.5 h-3.5 text-sky-300"/>{weather ? `${Math.round(weather.current.windSpeed)} km/h` : '—'}</span>
              <span className="text-xs text-white/65 flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5 text-sky-300"/>{weather ? `${weather.current.relativeHumidity}%` : '—'}</span>
              <span className="text-xs text-white/65 flex items-center gap-1.5"><CloudRain className="w-3.5 h-3.5 text-sky-300"/>{weather ? `${weather.current.precipitation} mm` : '—'}</span>
              <span className="text-xs text-white/65 truncate">{activeField ? getGrowthStageFr(activeField.growthStage) : 'Stade'}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
            <p className="text-xs text-white/65 line-clamp-2">{majorRisk ? majorRisk.title : 'Aucune alerte agronomique déclenchée par les règles actives pour le moment.'}</p>
            <button type="button" onClick={() => onNavigateToTab(majorRisk ? 'insights' : 'weather')} className="text-sky-300 text-xs font-semibold flex items-center shrink-0 gap-1">Explorer <ArrowRight className="w-3.5 h-3.5"/></button>
          </div>
          <p className="text-[10px] text-white/35">{weather?.dataSource || 'Prévisions non disponibles'} · {weather?.isCached ? 'cache' : 'actualisé'} · {backendStatus === 'ok' ? 'ClimateShield synchronisé' : 'Évaluation ClimateShield en attente'}</p>
        </section>
        <section className="apple-card p-3.5 sm:p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-xs">Mes parcelles</h2><button onClick={() => onNavigateToTab('fields')} className="text-[11px] text-sky-300 hover:underline">Gérer</button></div>
          {fields.slice(0, 3).map((f) => <button key={f.id} onClick={() => onSelectActiveField(f)} className={`rounded-xl p-2.5 text-left flex items-center gap-2 border ${activeField?.id === f.id ? 'bg-sky-500/10 border-sky-400/30' : 'bg-white/[0.03] border-white/5 hover:bg-white/10'}`}>
            <Sprout className="w-4 h-4 text-emerald-300 shrink-0"/>
            <span className="min-w-0 flex-1"><span className="block text-xs font-medium truncate">{f.name}</span><span className="block text-[10px] text-white/40 truncate">{getCropNameFr(f.cropType)} · {getGrowthStageFr(f.growthStage)}</span></span>
            {activeField?.id === f.id && <span className="w-1.5 h-1.5 bg-sky-400 rounded-full" />}
          </button>)}
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">4 décisions pour votre parcelle</h2>
        <button type="button" onClick={() => setJournalOpen(true)} className="text-xs rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 flex gap-1.5 items-center text-emerald-200 hover:bg-emerald-500/20"><Tractor className="w-3.5 h-3.5"/> Enregistrer une intervention</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-stretch">
        <button type="button" onClick={() => onNavigateToTab('insights')} className="apple-card p-4 text-left hover:bg-white/[0.09] space-y-3 min-h-[205px] flex flex-col">
          <div className="flex items-center gap-2 text-amber-300"><ThermometerSun className="w-5 h-5"/><h3 className="text-xs font-semibold text-white">Flowering Risk</h3></div>
          <div className="flex-1"><p className="text-2xl font-semibold">{heatHours !== null ? `${heatHours} h` : '—'}</p><p className="text-[11px] text-white/55 mt-1">{heatHours !== null ? `Au-dessus de ${threshold?.tmaxC} °C (48h AROME)` : 'Seuil spécifique non actif pour cette culture ou ce stade.'}</p></div>
          <span className="text-sky-300 text-[11px] flex items-center gap-1">Courbe horaire <ArrowRight className="w-3 h-3"/></span>
        </button>
        <button type="button" onClick={() => setJournalOpen(true)} className="apple-card p-4 text-left hover:bg-white/[0.09] space-y-3 min-h-[205px] flex flex-col">
          <div className="flex items-center gap-2 text-sky-300"><Droplets className="w-5 h-5"/><h3 className="text-xs font-semibold text-white">Irrigation Timing</h3></div>
          <div className="flex-1"><p className="text-xl font-semibold">{rainNextDays !== undefined ? `${rainNextDays.toFixed(1)} mm` : '—'}</p><p className="text-[11px] text-white/55 mt-1">Pluie prévue sur 3 jours</p><p className="text-[11px] text-white/55 mt-2">{irrigation ? `Dernier arrosage : ${irrigation.quantity ?? '—'} ${irrigation.unit || ''} le ${irrigation.date}` : 'Ajoutez vos irrigations pour commencer le suivi.'}</p></div>
          <span className="text-sky-300 text-[11px] flex items-center gap-1">Journal · bilan hydrique à venir <ArrowRight className="w-3 h-3"/></span>
        </button>
        <button type="button" onClick={() => onNavigateToTab('insights')} className="apple-card p-4 text-left hover:bg-white/[0.09] space-y-3 min-h-[205px] flex flex-col">
          <div className="flex items-center gap-2 text-emerald-300"><Activity className="w-5 h-5"/><h3 className="text-xs font-semibold text-white">Harvest Windows</h3></div>
          <div className="flex-1"><p className="text-xl font-semibold">{harvest?.available && harvest.recommended_date_local ? new Date(harvest.recommended_date_local + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Culture en cours'}</p><p className="text-[11px] text-white/55 mt-1">{harvest?.available ? `${harvest.n_feasible_days} créneau(x) météo possible(s)` : 'Classement accessible à maturité déclarée.'}</p></div>
          <span className="text-sky-300 text-[11px] flex items-center gap-1">Ensemble AIFS · 51 membres max <ArrowRight className="w-3 h-3"/></span>
        </button>
        <div className="min-h-[205px]"><SoilIntelligenceCard field={activeField} compact /></div>
      </div>
      <p className="text-[10px] text-white/35 px-1">Les résultats sont calculés à partir des modèles météo, des règles agronomiques ou de l’étude géospatiale citée. Le journal des interventions est enregistré localement.</p>
      {journalOpen && activeField && <FieldActivityJournal field={activeField} onClose={() => setJournalOpen(false)} onSaved={() => setJournalVersion((v) => v + 1)} />}
    </div>
  );
};
