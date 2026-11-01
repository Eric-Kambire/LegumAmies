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

const DEMO_FIELD_IDS = new Set(['field_lauragais_1', 'field_beauce_2', 'field_berry_3']);
const isDemoField = (field: SelectedField) => Boolean(field.isDemo) || DEMO_FIELD_IDS.has(field.id);

interface HomeViewProps {
  fields: SelectedField[];
  activeField: SelectedField | null;
  onSelectActiveField: (field: SelectedField) => void;
  weather: LocationWeatherData | null;
  alerts: AgriculturalRiskAlert[];
  onNavigateToTab: (tab: 'weather' | 'fields' | 'insights' | 'notifications') => void;
  onOpenCreateField: () => void;
  currentHour: number;
}

export const HomeView: React.FC<HomeViewProps> = ({
  fields,
  activeField,
  onSelectActiveField,
  weather,
  alerts,
  onNavigateToTab,
  onOpenCreateField,
  currentHour,
}) => {
  const timeOfDay = currentHour < 6 ? 'Cette nuit' : currentHour < 12 ? 'Ce matin' : currentHour < 18 ? 'Cet après-midi' : 'Ce soir';
  const allFieldsAreDemo = fields.length > 0 && fields.every(isDemoField);
  const totalHectares = fields.reduce((acc, f) => acc + (f.areaHectares || 0), 0);

  const getDailyBriefing = () => {
    if (!weather) return 'Chargement des conditions météo locales et de leur provenance…';

    const temperature = Math.round(weather.current.temperature);
    const wind = Math.round(weather.current.windSpeed);
    const rain = weather.current.precipitation;
    const humidity = weather.current.relativeHumidity;
    const stage = activeField ? getGrowthStageFr(activeField.growthStage).toLowerCase() : 'stade non renseigné';

    if (rain > 0) {
      return `${timeOfDay}, ${rain.toFixed(1)} mm de précipitations sont signalés par les données météo disponibles. La parcelle est au stade ${stage}. Consultez la carte et les analyses avant toute décision au champ.`;
    }
    if (wind >= 19) {
      return `${timeOfDay}, le vent estimé est de ${wind} km/h. Il atteint le seuil réglementaire utilisé par Légume'Ami pour signaler un risque de dérive. Les détails et la source sont disponibles dans Analyses.`;
    }
    return `${timeOfDay}, les données météo disponibles indiquent ${temperature} °C, ${wind} km/h de vent et ${humidity}% d’humidité pour une parcelle au stade ${stage}. Ces mesures décrivent la situation actuelle ; vérifiez les prévisions, la rosée et les contraintes de la parcelle avant d’intervenir.`;
  };

  return (
    <div className="app-page-scroll flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pt-6 max-w-6xl mx-auto w-full flex flex-col gap-5">
      {/* 1. Welcoming Header (Apple iOS Style) */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <img
            src="/legumeAmi.png"
            alt="Légume'Ami Logo"
            className="w-12 h-12 sm:w-14 sm:h-14 object-contain drop-shadow-lg flex-shrink-0"
          />
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50 capitalize block truncate">
              Point météo local
            </span>
            <h1 className="text-xl sm:text-3xl font-semibold tracking-tight text-white mt-0.5 leading-tight">
              Tableau de bord agricole
            </h1>
            <p className="text-xs text-white/60 mt-0.5 leading-relaxed">
              {allFieldsAreDemo
                ? `${fields.length} parcelles d'exemple • ${totalHectares} ha de démonstration`
                : `${fields.length} ${fields.length > 1 ? 'parcelles enregistrées' : 'parcelle enregistrée'} • ${totalHectares} ha sous surveillance`}
            </p>
          </div>
        </div>

        <button
          onClick={onOpenCreateField}
          className="apple-glass px-4 py-2 rounded-full text-xs font-semibold text-white flex items-center gap-1.5 shadow-md active:scale-95 transition-transform flex-shrink-0"
          aria-label="Créer une parcelle réelle"
          title="Créer une parcelle réelle"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ajouter une parcelle</span>
        </button>
      </div>

      {allFieldsAreDemo && (
        <section className="apple-card p-3.5 flex items-center justify-between gap-3 border-amber-500/25">
          <div className="min-w-0"><p className="text-xs font-semibold text-amber-200">Mode démonstration</p><p className="text-[11px] text-white/60 mt-0.5">Ces parcelles sont des exemples préchargés. Créez votre parcelle pour obtenir un suivi personnel.</p></div>
          <button onClick={onOpenCreateField} className="text-xs text-[#38bdf8] font-semibold hover:underline flex-shrink-0">Créer la mienne</button>
        </section>
      )}

      {/* Main Responsive Grid (Mobile: 1 col, Desktop: 12 cols split) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (lg:col-span-7): Daily Briefing + Active Field + Critical Alerts */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* 2. Daily Agricultural Briefing Card */}
          <div className="apple-card p-4 relative overflow-hidden bg-gradient-to-br from-white/[0.08] to-white/[0.03]">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/[0.08]">
              <span className="w-2 h-2 rounded-full bg-[#007aff] animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                Point météo actuel
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
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onNavigateToTab('weather');
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Voir la météo détaillée de ${activeField.name}`}
              className="apple-card p-5 cursor-pointer hover:bg-white/[0.1] transition-all active:scale-[0.99] flex flex-col gap-3 group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-white/60">
                <div className="flex items-start gap-1.5 font-medium text-white/80 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-[#007aff] flex-shrink-0 mt-0.5" />
                  <span className="text-sm font-semibold text-white leading-snug">{activeField.name}</span>
                  {isDemoField(activeField) && <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[9px] text-amber-200 flex-shrink-0">Démo</span>}
                  <span className="text-white/60">• {activeField.commune || 'France'}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-white/50 group-hover:text-white transition-colors flex-shrink-0">
                  <span>Voir la carte</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 my-0.5">
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
                      <p className="text-[11px] text-white/70 mt-0.5 leading-relaxed">
                        {alert.metricValue} — détails, incertitudes et source réglementaire dans Analyses.
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
                        {isDemoField(f) && <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[9px] text-amber-200">Démo</span>}
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
