import React from 'react';
import { MapPin, Sparkles } from 'lucide-react';
import type { LocationWeatherData } from '../../types/weather';
import type { SelectedField } from '../../types/agricultural';
import { getCropNameFr, getGrowthStageFr } from '../../services/agriRiskService';
import { getWmoWeatherDescription } from '../../services/weatherApi';

interface CurrentMetricsProps {
  weather: LocationWeatherData;
  field: SelectedField | null;
  onOpenFieldConfig: () => void;
}

export const CurrentMetrics: React.FC<CurrentMetricsProps> = ({
  weather,
  field,
  onOpenFieldConfig,
}) => {
  const current = weather.current;
  const today = weather.daily[0];
  const condition = getWmoWeatherDescription(current.weatherCode, current.isDay);

  return (
    <div className="flex flex-col gap-2 select-none">
      {/* Top Location & Parcel Tag */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
          <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="truncate max-w-[220px] sm:max-w-xs text-slate-200">
            {field?.commune || `${weather.latitude.toFixed(3)}°N, ${weather.longitude.toFixed(3)}°E`}
          </span>
          {field?.departmentCode && (
            <span className="text-slate-500 font-mono">({field.departmentCode})</span>
          )}
        </div>

        {/* Field configuration button / badge */}
        <button
          onClick={onOpenFieldConfig}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 text-[11px] font-medium transition-all active:scale-95"
        >
          <Sparkles className="w-3 h-3" />
          <span>
            {field ? `${getCropNameFr(field.cropType)}` : 'Configurer la culture'}
          </span>
        </button>
      </div>

      {/* Hero Temperature & Condition */}
      <div className="flex items-baseline justify-between mt-1">
        <div>
          <div className="flex items-start">
            <span className="text-5xl sm:text-6xl font-bold tracking-tighter text-white font-mono">
              {Math.round(current.temperature)}
            </span>
            <span className="text-2xl sm:text-3xl font-light text-emerald-400 ml-0.5">°C</span>
          </div>
          <p className="text-sm font-medium text-slate-300 mt-0.5">{condition.labelFr}</p>
        </div>

        {/* High / Low & Wind Summary */}
        <div className="text-right text-xs text-slate-400 flex flex-col gap-0.5">
          {today && (
            <div className="font-mono text-slate-300">
              <span className="text-rose-400">Max {Math.round(today.temperatureMax)}°</span>
              <span className="mx-1 text-slate-600">•</span>
              <span className="text-sky-400">Min {Math.round(today.temperatureMin)}°</span>
            </div>
          )}
          <div className="text-[11px]">
            Vent <span className="font-mono text-slate-300">{current.windSpeed} km/h</span>
            {current.windGusts > current.windSpeed && (
              <span className="text-amber-400 font-mono"> (raf. {current.windGusts})</span>
            )}
          </div>
          <div className="text-[11px]">
            Humidité <span className="font-mono text-slate-300">{current.relativeHumidity}%</span>
          </div>
        </div>
      </div>

      {/* Active Crop Stage Alert Banner if configured */}
      {field && (
        <div className="mt-1 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-sm">🌱</span>
            <span className="text-slate-300 font-medium">
              {getCropNameFr(field.cropType)} • <span className="text-emerald-400">{getGrowthStageFr(field.growthStage)}</span>
            </span>
          </div>
          <span className="text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer" onClick={onOpenFieldConfig}>
            Modifier
          </span>
        </div>
      )}
    </div>
  );
};
