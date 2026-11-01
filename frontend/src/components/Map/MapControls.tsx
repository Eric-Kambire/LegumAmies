import React, { useState } from 'react';
import {
  Navigation,
  CloudRain,
  Cloud,
  Thermometer,
  Wind,
  Sun,
  Moon,
  RefreshCw,
  Layers2,
  X,
  Map as MapIcon,
  Sprout,
} from 'lucide-react';
import type { WeatherLayerType, LocationWeatherData } from '../../types/weather';

export interface MapOverlayState { soil: boolean; rpg: boolean; admin: boolean; opacity: number }

interface MapControlsProps {
  overlays: MapOverlayState;
  onOverlaysChange: (next: MapOverlayState) => void;
  activeLayer: WeatherLayerType;
  onLayerChange: (layer: WeatherLayerType) => void;
  onLocateMe: () => void;
  isLocating: boolean;
  onResetFranceView: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onRefreshWeather: () => void;
  isRefreshing: boolean;
  isCached: boolean;
  dataSource: string;
  weather: LocationWeatherData | null;
}

export const MapControls: React.FC<MapControlsProps> = ({
  activeLayer,
  onLayerChange,
  overlays,
  onOverlaysChange,
  onLocateMe,
  isLocating,
  onResetFranceView,
  isDarkMode,
  onToggleTheme,
  onRefreshWeather,
  isRefreshing,
  isCached,
  dataSource,
  weather,
}) => {
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const layers: Array<{ id: WeatherLayerType; label: string; icon: React.ReactNode }> = [
    { id: 'radar', label: 'Pluie', icon: <CloudRain className="w-3.5 h-3.5" /> },
    { id: 'clouds', label: 'Nuages', icon: <Cloud className="w-3.5 h-3.5" /> },
    { id: 'temperature', label: 'Temp.', icon: <Thermometer className="w-3.5 h-3.5" /> },
    { id: 'wind', label: 'Vent', icon: <Wind className="w-3.5 h-3.5" /> },
  ];

  return (
    <>
      {/* Compact, collapsible map layer switcher. Weather modes use local field values unless raster tiles exist. */}
      {/* z-[520] keeps the layer toggle and its panel above the weather bottom-sheet (z-[500]) so mode buttons stay clickable on desktop. */}
      <div className="absolute top-3 right-3 z-[520] flex flex-col items-end gap-2 pointer-events-auto">
        <button type="button" onClick={() => setIsLayersOpen((v) => !v)} aria-label="Personnaliser les couches de carte" aria-expanded={isLayersOpen} className="apple-glass flex items-center gap-2 rounded-full px-3.5 py-2.5 text-xs font-semibold text-white shadow-xl border border-white/15">
          <Layers2 className="w-4 h-4 text-sky-300"/> Couches <span className="text-white/45">· {layers.find((l) => l.id === activeLayer)?.label}</span>
        </button>
        {isLayersOpen && (
          <div role="group" aria-label="Personnaliser la carte" className="w-[min(310px,calc(100vw-1.5rem))] max-h-[min(590px,calc(100vh-12rem))] overflow-y-auto rounded-3xl apple-glass border border-white/20 p-3.5 shadow-2xl text-white">
            <div className="flex items-center justify-between mb-2.5">
              <strong className="text-xs">Personnaliser la carte</strong>
              <button type="button" aria-label="Fermer les couches" onClick={() => setIsLayersOpen(false)} className="rounded-lg p-1 hover:bg-white/10"><X className="w-4 h-4"/></button>
            </div>
            <p className="text-[10px] font-semibold tracking-wider uppercase text-white/45 mb-2">Affichage météo</p>
            <div className="grid grid-cols-2 gap-1.5">
              {layers.map((layer) => <button type="button" key={layer.id} onClick={() => onLayerChange(layer.id)} aria-pressed={activeLayer === layer.id} className={`rounded-xl p-2.5 flex items-center gap-2 text-[11px] text-left border ${activeLayer === layer.id ? 'bg-sky-500/20 border-sky-400/40 text-white' : 'bg-white/[0.04] border-white/10 text-white/65'}`}>{layer.icon}{layer.label}</button>)}
            </div>
            <p className="text-[10px] leading-relaxed text-white/40 mt-2">{activeLayer === 'radar' ? 'Radar RainViewer : observations et extrapolations très court terme.' : 'Valeur météo au point sélectionné (Open-Meteo), pas une carte nationale interpolée.'}</p>
            <div className="h-px bg-white/10 my-3" />
            <p className="text-[10px] font-semibold tracking-wider uppercase text-white/45 mb-2">Couches territoriales</p>
            {([
              ['soil', 'Argile · SoilGrids', Sprout],
              ['rpg', 'Parcelles RPG 2024', MapIcon],
              ['admin', 'Communes IGN', Layers2],
            ] as const).map(([key, label, Icon]) => (
              <label key={key} className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 hover:bg-white/[0.05] cursor-pointer">
                <span className="flex items-center gap-2 text-xs text-white/75"><Icon className="w-4 h-4 text-emerald-300" />{label}</span>
                <input type="checkbox" checked={overlays[key]} onChange={(e) => onOverlaysChange({ ...overlays, [key]: e.target.checked })} className="accent-emerald-400 w-4 h-4" />
              </label>
            ))}
            <p className="text-[10px] leading-relaxed text-white/40 mt-1">RPG et limites : extrait Castelnaudary. Sols : carte ISRIC 250 m.</p>
            <div className="flex items-center justify-between mt-3 mb-1"><label htmlFor="map-overlay-opacity" className="text-[11px] text-white/60">Opacité des couches</label><span className="text-[11px] font-mono text-white/65">{Math.round(overlays.opacity * 100)}%</span></div>
            <input id="map-overlay-opacity" type="range" min={0.2} max={0.9} step={0.05} value={overlays.opacity} onChange={(e) => onOverlaysChange({ ...overlays, opacity: Number(e.target.value) })} className="w-full accent-emerald-400"/>
            <p className="text-[10px] text-white/40 mt-2">Sources : ISRIC SoilGrids, IGN / RPG / ASP, Open-Meteo et RainViewer.</p>
          </div>
        )}
      </div>

      {activeLayer !== 'radar' && (
        <aside aria-label="Météo locale sur la carte" className="absolute left-3 top-[4.7rem] lg:top-[8.5rem] z-[440] w-[min(218px,calc(100vw-7rem))] rounded-[20px] apple-glass px-3.5 py-3 text-white border border-white/15 shadow-xl pointer-events-auto">
          <div className="flex items-center gap-2 text-[11px] text-white/55 font-medium mb-2">
            {activeLayer === 'wind' ? <Wind className="w-4 h-4 text-sky-300" /> : activeLayer === 'clouds' ? <Cloud className="w-4 h-4 text-sky-300"/> : <Thermometer className="w-4 h-4 text-amber-300"/>}
            <span>{activeLayer === 'wind' ? 'Vent au point sélectionné' : activeLayer === 'clouds' ? 'Couverture nuageuse' : 'Température locale'}</span>
          </div>
          {weather ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[30px] font-light leading-none tabular-nums">
                  {activeLayer === 'wind' ? Math.round(weather.current.windSpeed) : activeLayer === 'clouds' ? Math.round(weather.current.cloudCover) : Math.round(weather.current.temperature)}
                </span>
                <span className="text-xs text-white/65">{activeLayer === 'wind' ? 'km/h' : activeLayer === 'clouds' ? '%' : '°C'}</span>
                {activeLayer === 'wind' && <Navigation className="w-5 h-5 text-sky-300 ml-auto" aria-label="Direction du vent" style={{ transform: `rotate(${(weather.current.windDirection + 180) % 360}deg)` }} />}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                {activeLayer === 'clouds' ? <div className="h-full bg-sky-300 rounded-full" style={{ width: `${Math.min(100, Math.max(0, weather.current.cloudCover))}%` }} /> : <div className="h-full bg-sky-400 rounded-full w-full opacity-60"/>}
              </div>
              <p className="text-[10px] text-white/45 mt-2 leading-snug">
                {activeLayer === 'wind' ? `Direction météo ${Math.round(weather.current.windDirection)}° · 10 m` : activeLayer === 'clouds' ? 'Fraction de ciel couvert par les nuages' : 'Température de l’air à 2 m'}.
              </p>
              <p className="text-[10px] text-white/35 mt-1 truncate">{weather.dataSource} · {weather.isCached ? 'cache' : 'actualisé'} · point GPS</p>
            </>
          ) : <p className="text-xs text-white/60">Chargement des prévisions pour la parcelle…</p>}
        </aside>
      )}

      {/* Floating Circular Action Buttons (Apple Maps Style) */}
      <div className="absolute top-[4.5rem] right-4 z-[400] flex flex-col gap-2.5">
        {/* Locate Me */}
        <button
          onClick={onLocateMe}
          disabled={isLocating}
          className="w-11 h-11 rounded-full apple-glass flex items-center justify-center text-white/90 shadow-xl transition-all active:scale-90 disabled:opacity-50"
          title="Me localiser (GPS)"
          aria-label="Me localiser"
        >
          {isLocating ? (
            <RefreshCw className="w-4 h-4 animate-spin text-[#007aff]" />
          ) : (
            <Navigation className="w-4 h-4 fill-current text-[#007aff]" />
          )}
        </button>

        {/* France National View Reset */}
        <button
          onClick={onResetFranceView}
          className="w-11 h-11 rounded-full apple-glass flex items-center justify-center text-white/90 shadow-xl transition-all active:scale-90 text-xs font-semibold"
          title="Vue France Métropolitaine"
          aria-label="Vue France"
        >
          <span>FR</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="w-11 h-11 rounded-full apple-glass flex items-center justify-center text-white/90 shadow-xl transition-all active:scale-90"
          title={isDarkMode ? 'Mode clair' : 'Mode sombre'}
          aria-label="Basculer le thème"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-sky-200" />}
        </button>
      </div>

      {/* Bottom Left: Data Freshness Badge */}
      <div className="absolute bottom-4 left-4 z-[400] hidden sm:flex items-center gap-2 apple-glass px-3 py-1.5 rounded-full text-[11px] text-white/70 shadow-md">
        <span
          className={`w-2 h-2 rounded-full ${
            isCached ? 'bg-amber-400' : 'bg-[#22c55e] animate-pulse'
          }`}
        />
        <span>{isCached ? 'Données en cache' : dataSource.split(' ')[0]}</span>
        <button
          onClick={onRefreshWeather}
          disabled={isRefreshing}
          className="hover:text-white transition-colors ml-1 p-0.5"
          title="Actualiser les données"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </>
  );
};
