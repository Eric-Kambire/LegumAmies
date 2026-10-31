import React from 'react';
import { Sun, Cloud, CloudRain, CloudLightning, Calendar } from 'lucide-react';
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
    if (code <= 2) return <Sun className="w-4 h-4 text-amber-300" />;
    if (code >= 80 || code >= 95) return <CloudLightning className="w-4 h-4 text-amber-400" />;
    if (code >= 50) return <CloudRain className="w-4 h-4 text-sky-400" />;
    return <Cloud className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="flex flex-col gap-2 select-none">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 px-1">
        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
        <span className="font-semibold uppercase tracking-wider text-[10px]">Prévisions à 7 Jours</span>
      </div>

      <div className="flex flex-col divide-y divide-slate-800/60 bg-slate-800/30 border border-slate-700/40 rounded-2xl p-2.5">
        {daily.slice(0, 7).map((day, idx) => {
          const leftPercent = ((day.temperatureMin - weekMin) / weekRange) * 100;
          const widthPercent = Math.max(
            ((day.temperatureMax - day.temperatureMin) / weekRange) * 100,
            8
          );

          return (
            <div
              key={day.date}
              className="flex items-center justify-between py-2 px-1 text-xs text-slate-300"
            >
              <span className="w-20 font-medium capitalize text-slate-200">
                {getDayLabel(day.date, idx)}
              </span>

              <div className="flex items-center gap-1.5 w-16">
                {getDailyIcon(day.weatherCode)}
                {day.precipitationProbabilityMax > 20 ? (
                  <span className="text-[10px] font-mono text-sky-400">
                    {day.precipitationProbabilityMax}%
                  </span>
                ) : (
                  <span className="text-[10px] text-transparent select-none">-</span>
                )}
              </div>

              <span className="w-8 text-right font-mono text-slate-400">
                {Math.round(day.temperatureMin)}°
              </span>

              <div className="flex-1 mx-3 h-1.5 bg-slate-700/40 rounded-full relative overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-sky-400 via-emerald-400 to-amber-400"
                  style={{
                    left: `${Math.max(0, leftPercent)}%`,
                    width: `${Math.min(100 - leftPercent, widthPercent)}%`,
                  }}
                />
              </div>

              <span className="w-8 text-left font-mono font-semibold text-slate-100">
                {Math.round(day.temperatureMax)}°
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
