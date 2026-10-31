import React from 'react';
import {
  Navigation,
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
    { id: 'radar', label: 'Pluie', icon: <CloudRain className="w-3.5 h-3.5" /> },
    { id: 'clouds', label: 'Nuages', icon: <Cloud className="w-3.5 h-3.5" /> },
    { id: 'temperature', label: 'Temp.', icon: <Thermometer className="w-3.5 h-3.5" /> },
    { id: 'wind', label: 'Vent', icon: <Wind className="w-3.5 h-3.5" /> },
  ];

  return (
    <>
      {/* Top Center: Apple HIG Pill Segmented Control */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] max-w-xs sm:max-w-sm w-[calc(100%-2rem)]">
        <div className="apple-glass p-1 rounded-full flex items-center justify-between gap-1 shadow-2xl">
          {layers.map((layer) => {
            const isActive = activeLayer === layer.id;
            return (
              <button
                key={layer.id}
                onClick={() => onLayerChange(layer.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-full text-xs transition-all active:scale-95 ${
                  isActive
                    ? 'bg-white/20 text-white font-semibold shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {layer.icon}
                <span className="tracking-tight">{layer.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Circular Action Buttons (Apple Maps Style) */}
      <div className="absolute top-20 sm:top-4 right-4 z-[400] flex flex-col gap-2.5">
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
