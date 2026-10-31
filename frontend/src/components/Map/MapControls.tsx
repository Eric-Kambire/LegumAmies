import React from 'react';
import {
  Navigation,
  MapPin,
  CloudRain,
  Cloud,
  Thermometer,
  Wind,
  Sun,
  Moon,
  RefreshCw,
} from 'lucide-react';
import type { WeatherLayerType } from '../../types/weather';

interface MapControlsProps {
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
}

export const MapControls: React.FC<MapControlsProps> = ({
  activeLayer,
  onLayerChange,
  onLocateMe,
  isLocating,
  onResetFranceView,
  isDarkMode,
  onToggleTheme,
  onRefreshWeather,
  isRefreshing,
  isCached,
  dataSource,
}) => {
  const layers: Array<{ id: WeatherLayerType; label: string; icon: React.ReactNode }> = [
    { id: 'radar', label: 'Pluie Radar', icon: <CloudRain className="w-3.5 h-3.5" /> },
    { id: 'clouds', label: 'Nuages', icon: <Cloud className="w-3.5 h-3.5" /> },
    { id: 'temperature', label: 'Température', icon: <Thermometer className="w-3.5 h-3.5" /> },
    { id: 'wind', label: 'Vent', icon: <Wind className="w-3.5 h-3.5" /> },
  ];

  return (
    <>
      {/* Top Center: Apple-style Layer Segmented Control */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] max-w-sm sm:max-w-md w-[calc(100%-2rem)]">
        <div className="bg-slate-900/85 backdrop-blur-md border border-slate-800/80 p-1 rounded-2xl shadow-xl flex items-center justify-between gap-1">
          {layers.map((layer) => {
            const isActive = activeLayer === layer.id;
            return (
              <button
                key={layer.id}
                onClick={() => onLayerChange(layer.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {layer.icon}
                <span className="hidden sm:inline">{layer.label}</span>
                <span className="sm:hidden">{layer.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Action Buttons (Top Right) */}
      <div className="absolute top-20 sm:top-4 right-4 z-[400] flex flex-col gap-2.5">
        <button
          onClick={onLocateMe}
          disabled={isLocating}
          className="w-10 h-10 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 text-slate-200 hover:text-emerald-400 backdrop-blur-md border border-slate-800/80 flex items-center justify-center shadow-lg transition-all active:scale-95 disabled:opacity-50"
          title="Me localiser (GPS)"
          aria-label="Me localiser"
        >
          {isLocating ? (
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
          ) : (
            <Navigation className="w-4 h-4 fill-current" />
          )}
        </button>

        <button
          onClick={onResetFranceView}
          className="w-10 h-10 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 text-slate-200 hover:text-white backdrop-blur-md border border-slate-800/80 flex items-center justify-center shadow-lg transition-all active:scale-95 text-xs font-semibold"
          title="Vue France Métropolitaine"
          aria-label="Vue France"
        >
          <span className="font-mono text-[11px] tracking-tight">FR</span>
        </button>

        <button
          onClick={onToggleTheme}
          className="w-10 h-10 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 text-slate-200 hover:text-amber-400 backdrop-blur-md border border-slate-800/80 flex items-center justify-center shadow-lg transition-all active:scale-95"
          title={isDarkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
          aria-label="Basculer le thème"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Top Left: Quick Pulse Basins Indicator */}
      <div className="absolute top-20 sm:top-4 left-4 z-[400] hidden md:flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 px-2.5 py-1.5 rounded-2xl text-xs shadow-lg">
        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-slate-300 font-medium">Bassins légumiers de France</span>
        <span className="text-[10px] text-slate-500 font-mono">(Cliquez sur un marqueur)</span>
      </div>

      {/* Bottom Left: Data Freshness Badge */}
      <div className="absolute bottom-4 left-4 z-[400] hidden sm:flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 px-2.5 py-1 rounded-xl text-[11px] text-slate-400 shadow-md">
        <span
          className={`w-2 h-2 rounded-full ${
            isCached ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
          }`}
        />
        <span>{isCached ? 'Données en cache' : dataSource.split(' ')[0]}</span>
        <button
          onClick={onRefreshWeather}
          disabled={isRefreshing}
          className="hover:text-emerald-400 transition-colors ml-1 p-0.5"
          title="Actualiser les données"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </>
  );
};
