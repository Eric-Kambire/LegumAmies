import React from 'react';
import { Cloud, CloudRain, Sun, Moon, CloudLightning, CloudDrizzle } from 'lucide-react';
import type { HourlyForecastPoint } from '../../types/weather';

interface HourlyForecastProps {
  hourly: HourlyForecastPoint[];
}

export const HourlyForecast: React.FC<HourlyForecastProps> = ({ hourly }) => {
  const getIcon = (code: number, hourStr: string) => {
    const hour = parseInt(hourStr.slice(11, 13), 10);
    const isDay = hour >= 7 && hour < 21;

    if (code === 0) {
      return isDay ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-300" />;
    }
    if (code <= 2) {
      return <Sun className="w-5 h-5 text-amber-300/80" />;
    }
    if (code >= 80 || code >= 95) {
      return <CloudLightning className="w-5 h-5 text-amber-400" />;
    }
    if (code >= 60) {
      return <CloudRain className="w-5 h-5 text-sky-400" />;
    }
    if (code >= 50) {
      return <CloudDrizzle className="w-5 h-5 text-sky-300" />;
    }
    return <Cloud className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="flex flex-col gap-2 select-none">
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span className="font-semibold uppercase tracking-wider text-[10px]">Prévisions 24 Heures</span>
        <span className="text-[10px] text-slate-500 font-mono">Modèle AROME / Open-Meteo</span>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-none -mx-1 px-1">
        {hourly.slice(0, 24).map((h, idx) => {
          const hourLabel = idx === 0 ? 'Maintenant' : `${h.time.slice(11, 13)}h`;

          return (
            <div
              key={h.time}
              className="flex flex-col items-center gap-1.5 min-w-[56px] py-2 px-1.5 rounded-xl bg-slate-800/40 border border-slate-700/40 text-xs flex-shrink-0"
            >
              <span className="text-[11px] text-slate-400 font-medium">{hourLabel}</span>
              
              <div className="my-0.5">{getIcon(h.weatherCode, h.time)}</div>

              {h.precipitationProbability > 15 ? (
                <span className="text-[10px] font-mono font-medium text-sky-400">
                  {h.precipitationProbability}%
                </span>
              ) : (
                <span className="text-[10px] text-transparent select-none">-</span>
              )}

              <span className="font-mono font-semibold text-slate-200">
                {Math.round(h.temperature)}°
              </span>

              <span className="text-[9px] text-slate-500 font-mono mt-0.5">
                {h.windSpeed}k
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
