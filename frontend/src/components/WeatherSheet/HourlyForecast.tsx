import React from 'react';
import { Clock, Sun, Moon, Cloud, CloudRain, CloudLightning, CloudDrizzle } from 'lucide-react';
import type { HourlyForecastPoint } from '../../types/weather';

interface HourlyForecastProps {
  hourly: HourlyForecastPoint[];
}

export const HourlyForecast: React.FC<HourlyForecastProps> = ({ hourly }) => {
  const getIcon = (code: number, hourStr: string) => {
    const hour = parseInt(hourStr.slice(11, 13), 10);
    const isDay = hour >= 7 && hour < 21;

    if (code === 0) {
      return isDay ? (
        <Sun className="w-5 h-5 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.4)]" />
      ) : (
        <Moon className="w-5 h-5 text-indigo-300" />
      );
    }
    if (code <= 2) {
      return <Sun className="w-5 h-5 text-amber-300/90" />;
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
    return <Cloud className="w-5 h-5 text-white/70" />;
  };

  return (
    <div className="apple-card p-3.5 select-none">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-xs text-white/50 font-semibold uppercase tracking-wider mb-2.5 pb-2 border-b border-white/[0.08]">
        <Clock className="w-3.5 h-3.5" />
        <span>Prévisions horaires</span>
      </div>

      {/* Horizontal Scroller */}
      <div className="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {hourly.slice(0, 24).map((h, idx) => {
          const hourLabel = idx === 0 ? 'Maintenant' : `${parseInt(h.time.slice(11, 13), 10)} h`;

          return (
            <div
              key={h.time}
              className="flex flex-col items-center gap-2 min-w-[50px] text-xs flex-shrink-0"
            >
              <span className="text-[12px] text-white/70 font-medium whitespace-nowrap">
                {hourLabel}
              </span>

              <div className="my-0.5">{getIcon(h.weatherCode, h.time)}</div>

              {h.precipitationProbability > 15 ? (
                <span className="text-[11px] font-semibold text-[#38bdf8]">
                  {h.precipitationProbability}%
                </span>
              ) : (
                <span className="text-[11px] text-transparent select-none">-</span>
              )}

              <span className="font-medium text-sm text-white">
                {Math.round(h.temperature)}°
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
