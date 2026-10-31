import React from 'react';
import {
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Layers,
  ArrowRight,
  TrendingUp,
  Map as MapIcon,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import type { SelectedField, AgriculturalRiskAlert } from '../../types/agricultural';
import type { LocationWeatherData } from '../../types/weather';
import { getCropNameFr, getGrowthStageFr } from '../../services/agriRiskService';
import { LEGUME_CROPS_CATALOG } from '../../data/legumeCatalog';
import { CropGlyph } from '../Common/LegumeGlyphs';

// Fixed reference date computed at module initialization for pure component rendering
const TODAY_FORMATTED = new Date().toLocaleDateString('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

interface HomeViewProps {
  fields: SelectedField[];
  activeField: SelectedField | null;
  onSelectActiveField: (field: SelectedField) => void;
  weather: LocationWeatherData | null;
  alerts: AgriculturalRiskAlert[];
  onNavigateToTab: (tab: 'weather' | 'fields' | 'insights' | 'notifications') => void;
  onOpenCreateField: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  fields,
  activeField,
  onSelectActiveField,
  weather,
  alerts,
  onNavigateToTab,
  onOpenCreateField,
}) => {
  const todayFormatted = TODAY_FORMATTED;

  const totalHectares = fields.reduce((acc, f) => acc + (f.areaHectares || 0), 0);

  // Generate a personalized agricultural briefing based on live weather & active crops
  const getDailyBriefing = () => {
    if (!weather) return "Chargement des conditions météo locales...";
    const temp = Math.round(weather.current.temperature);
    const wind = weather.current.windSpeed;
    const rain = weather.current.precipitation;

    if (rain > 0) {
      return `Pluie en cours (${rain.toFixed(1)} mm) sur votre secteur. Chantiers de battage suspendus et pulvérisations interdites. Profitez-en pour mettre à jour les stades phénologiques de vos parcelles.`;
    }
    if (temp >= 28) {
      return `Chaleur marquée (${temp}°C) aujourd'hui. Vos légumineuses en floraison subissent un stress thermique. Évitez les interventions foliaires en journée et reportez la moisson aux heures plus fraîches.`;
    }
    if (wind < 15) {
      return `Excellentes conditions ce matin : vent calme (${wind} km/h) et hygrométrie favorable. Fenêtre de traitement optimale ouverte jusqu'en début d'après-midi.`;
    }
    return `Temps doux (${temp}°C) avec un vent modéré (${wind} km/h). Risque d'égrenage faible. Consultez le calendrier de récolte pour anticiper la dessiccation du grain.`;
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pt-6 pb-28 max-w-6xl mx-auto w-full select-none flex flex-col gap-5">
      {/* 1. Welcoming Header (Apple iOS Style) */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <img
            src="/legumeAmi.png"
            alt="LegumAmies Logo"
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-contain shadow-lg border border-white/20 bg-black/20 flex-shrink-0"
          />
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50 capitalize block truncate">
              {todayFormatted}
            </span>
            <h1 className="text-xl sm:text-3xl font-semibold tracking-tight text-white mt-0.5 truncate">
              Tableau de Bord Agricole
            </h1>
            <p className="text-xs text-white/60 mt-0.5 truncate">
              {fields.length} {fields.length > 1 ? 'parcelles enregistrées' : 'parcelle enregistrée'} • {totalHectares} ha sous surveillance
            </p>
          </div>
        </div>

        <button
          onClick={onOpenCreateField}
          className="apple-glass px-4 py-2 rounded-full text-xs font-semibold text-white flex items-center gap-1.5 shadow-md active:scale-95 transition-transform flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ajouter une parcelle</span>
        </button>
      </div>

      {/* Main Responsive Grid (Mobile: 1 col, Desktop: 12 cols split) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (lg:col-span-7): Daily Briefing + Active Field + Critical Alerts */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* 2. Daily Agricultural Briefing Card */}
          <div className="apple-card p-4 relative overflow-hidden bg-gradient-to-br from-white/[0.08] to-white/[0.03]">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/[0.08]">
              <span className="w-2 h-2 rounded-full bg-[#007aff] animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                Briefing Agronomique du Jour
              </span>
            </div>
            <p className="text-xs sm:text-sm text-white/85 leading-relaxed font-normal">
              {getDailyBriefing()}
            </p>
          </div>

          {/* 3. Active Field Live Status Hero Card */}
          {activeField && weather && (
            <div
              onClick={() => onNavigateToTab('weather')}
              className="apple-card p-5 cursor-pointer hover:bg-white/[0.1] transition-all active:scale-[0.99] flex flex-col gap-3 group"
            >
              <div className="flex items-center justify-between text-xs text-white/60">
                <div className="flex items-center gap-1.5 font-medium text-white/80">
                  <MapPin className="w-3.5 h-3.5 text-[#007aff]" />
                  <span className="text-sm font-semibold text-white">{activeField.name}</span>
                  <span>• {activeField.commune || 'France'}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-white/50 group-hover:text-white transition-colors">
                  <span>Voir la carte</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              <div className="flex items-baseline justify-between my-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-thin tracking-tighter text-white">
                    {Math.round(weather.current.temperature)}°
                  </span>
                  <span className="text-xs text-white/70 font-medium capitalize">
                    Vent {weather.current.windSpeed} km/h • Humidité {weather.current.relativeHumidity}%
                  </span>
                </div>

                <div className="text-right">
                  <div
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border shadow-xs"
                    style={{
                      backgroundColor: LEGUME_CROPS_CATALOG[activeField.cropType]?.accent.bg || 'rgba(255,255,255,0.1)',
                      color: LEGUME_CROPS_CATALOG[activeField.cropType]?.accent.text || '#fff',
                      borderColor: LEGUME_CROPS_CATALOG[activeField.cropType]?.accent.border || 'rgba(255,255,255,0.2)',
                    }}
                  >
                    <CropGlyph crop={activeField.cropType} size={15} />
                    <span>{getCropNameFr(activeField.cropType)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2.5 border-t border-white/[0.08] flex items-center justify-between text-xs">
                <span className="text-white/60">
                  Stade : <strong className="text-white font-medium">{getGrowthStageFr(activeField.growthStage)}</strong>
                </span>
                <span className="text-[#38bdf8] text-[11px] font-medium flex items-center gap-1">
                  <span>Météo détaillée & radar</span>
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          )}

          {/* 4. Critical Farm Risks & Recommendations */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Alertes & Risques Météo
              </span>
              <button
                onClick={() => onNavigateToTab('insights')}
                className="text-[11px] text-[#38bdf8] hover:underline font-medium"
              >
                Toutes les analyses
              </button>
            </div>

            {alerts.length > 0 ? (
              <div className="flex flex-col gap-2">
                {alerts.slice(0, 2).map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => onNavigateToTab('insights')}
                    className="apple-card p-3.5 flex items-start gap-3 cursor-pointer hover:bg-white/[0.1] transition-all"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        alert.severity === 'critique'
                          ? 'bg-rose-500/20 text-rose-300'
                          : alert.severity === 'alerte'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-[#22c55e]/20 text-[#34d399]'
                      }`}
                    >
                      {alert.severity === 'favorable' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xs font-semibold text-white truncate">{alert.title}</h2>
                        <span className="text-[10px] text-white/40 font-mono ml-2">{alert.metricValue}</span>
                      </div>
                      <p className="text-[11px] text-white/70 mt-0.5 line-clamp-2 leading-relaxed">
                        {alert.recommendation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="apple-card p-4 flex items-center gap-3 text-xs text-white/60">
                <ShieldCheck className="w-5 h-5 text-[#22c55e] flex-shrink-0" />
                <span>Aucune anomalie critique détectée aujourd'hui sur vos parcelles.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (lg:col-span-5): Parcels Carousel/List + Quick Hub */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* 5. Registered Fields Grid */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Mes Parcelles ({fields.length})
              </span>
              <button
                onClick={() => onNavigateToTab('fields')}
                className="text-[11px] text-[#38bdf8] hover:underline font-medium"
              >
                Gérer le parcellaire
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
              {fields.map((f) => {
                const isSelected = activeField?.id === f.id;
                const cropInfo = LEGUME_CROPS_CATALOG[f.cropType];

                return (
                  <div
                    key={f.id}
                    onClick={() => onSelectActiveField(f)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'apple-glass border-white/30 shadow-lg'
                        : 'apple-card hover:bg-white/[0.1]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-xl flex items-center justify-center border shadow-xs"
                          style={{
                            backgroundColor: cropInfo?.accent.bg || 'rgba(255,255,255,0.08)',
                            color: cropInfo?.accent.text || '#fff',
                            borderColor: cropInfo?.accent.border || 'rgba(255,255,255,0.15)',
                          }}
                        >
                          <CropGlyph crop={f.cropType} size={15} />
                        </div>
                        <span className="text-xs font-semibold text-white truncate max-w-[150px]">
                          {f.name}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-[#007aff]" title="Parcelle active" />
                      )}
                    </div>

                    <div className="text-[11px] text-white/60 flex items-center justify-between">
                      <span>{f.commune || 'France'}</span>
                      <span>{f.areaHectares ? `${f.areaHectares} ha` : ''}</span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px]">
                      <span className="text-white/45">Stade phénologique :</span>
                      <span className="text-white font-medium">{getGrowthStageFr(f.growthStage)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6. Quick Module Navigation Hub */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              onClick={() => onNavigateToTab('weather')}
              className="apple-card p-3 flex flex-col items-center text-center gap-1.5 hover:bg-white/[0.1] transition-all active:scale-95"
            >
              <MapIcon className="w-5 h-5 text-[#38bdf8]" />
              <span className="text-[11px] font-medium text-white">Carte Météo</span>
            </button>

            <button
              onClick={() => onNavigateToTab('insights')}
              className="apple-card p-3 flex flex-col items-center text-center gap-1.5 hover:bg-white/[0.1] transition-all active:scale-95"
            >
              <TrendingUp className="w-5 h-5 text-[#34d399]" />
              <span className="text-[11px] font-medium text-white">Prévisions</span>
            </button>

            <button
              onClick={() => onNavigateToTab('fields')}
              className="apple-card p-3 flex flex-col items-center text-center gap-1.5 hover:bg-white/[0.1] transition-all active:scale-95"
            >
              <Layers className="w-5 h-5 text-amber-300" />
              <span className="text-[11px] font-medium text-white">Parcelles</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
