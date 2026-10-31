import React from 'react';
import { Calendar, Sun, Cloud, CloudRain, CloudLightning } from 'lucide-react';
import type { DailyForecastPoint } from '../../types/weather';

interface DailyForecastProps {
  daily: DailyForecastPoint[];
}

export const DailyForecast: React.FC<DailyForecastProps> = ({ daily }) => {
  if (daily.length === 0) return null;

  const weekMin = Math.min(...daily.map((d) => d.temperatureMin));
  const weekMax = Math.max(...daily.map((d) => d.temperatureMax));
  const weekRange = Math.max(weekMax - weekMin, 1);

  const getDayLabel = (dateStr: string, idx: number) => {
    if (idx === 0) return "Aujourd'hui";
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  };

  const getDailyIcon = (code: number) => {
    if (code === 0) return <Sun className="w-4 h-4 text-amber-400" />;
    if (code <= 2) return <Sun className="w-4 h-4 text-amber-300/90" />;
    if (code >= 80 || code >= 95) return <CloudLightning className="w-4 h-4 text-amber-400" />;
    if (code >= 50) return <CloudRain className="w-4 h-4 text-sky-400" />;
    return <Cloud className="w-4 h-4 text-white/70" />;
  };

  return (
    <div className="apple-card p-3.5 select-none">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-xs text-white/50 font-semibold uppercase tracking-wider mb-1 pb-2 border-b border-white/[0.08]">
        <Calendar className="w-3.5 h-3.5" />
        <span>Prévisions sur 7 jours</span>
      </div>

      {/* Daily rows */}
      <div className="flex flex-col divide-y divide-white/[0.06]">
        {daily.slice(0, 7).map((day, idx) => {
          const leftPercent = ((day.temperatureMin - weekMin) / weekRange) * 100;
          const widthPercent = Math.max(
            ((day.temperatureMax - day.temperatureMin) / weekRange) * 100,
            12
          );

          return (
            <div
              key={day.date}
              className="flex items-center justify-between py-2.5 text-xs text-white"
            >
              {/* Day Name */}
              <span className="w-20 font-medium capitalize text-white/90">
                {getDayLabel(day.date, idx)}
              </span>

              {/* Weather Icon & Rain % */}
              <div className="flex items-center gap-1.5 w-14">
                {getDailyIcon(day.weatherCode)}
                {day.precipitationProbabilityMax > 20 ? (
                  <span className="text-[11px] font-semibold text-[#38bdf8]">
                    {day.precipitationProbabilityMax}%
                  </span>
                ) : (
                  <span className="text-[11px] text-transparent select-none">-</span>
                )}
              </div>

              {/* Min Temp */}
              <span className="w-7 text-right font-medium text-white/50 text-[13px]">
                {Math.round(day.temperatureMin)}°
              </span>

              {/* Apple Weather gradient range bar */}
              <div className="flex-1 mx-3 h-1.5 bg-black/30 rounded-full relative overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-[#0ea5e9] via-[#22c55e] via-[#eab308] to-[#f97316]"
                  style={{
                    left: `${Math.max(0, leftPercent)}%`,
                    width: `${Math.min(100 - leftPercent, widthPercent)}%`,
                  }}
                />
              </div>

              {/* Max Temp */}
              <span className="w-7 text-left font-semibold text-white text-[13px]">
                {Math.round(day.temperatureMax)}°
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
