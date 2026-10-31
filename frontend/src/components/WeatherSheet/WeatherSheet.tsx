import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Terminal } from 'lucide-react';
import type { LocationWeatherData } from '../../types/weather';
import type { SelectedField, AgriculturalRiskAlert } from '../../types/agricultural';
import { CurrentMetrics } from './CurrentMetrics';
import { HourlyForecast } from './HourlyForecast';
import { DailyForecast } from './DailyForecast';
import { AgriRiskCard } from './AgriRiskCard';

interface WeatherSheetProps {
  weather: LocationWeatherData | null;
  isLoading: boolean;
  error: string | null;
  selectedField: SelectedField | null;
  agriAlerts: AgriculturalRiskAlert[];
  onOpenFieldConfig: () => void;
  onOpenBackendContract: () => void;
}

type SheetSnap = 'peek' | 'half' | 'full';

export const WeatherSheet: React.FC<WeatherSheetProps> = ({
  weather,
  isLoading,
  error,
  selectedField,
  agriAlerts,
  onOpenFieldConfig,
  onOpenBackendContract,
}) => {
  const [snap, setSnap] = useState<SheetSnap>('half');

  if (isLoading) {
    return (
      <div className="absolute bottom-0 left-0 right-0 sm:left-4 sm:bottom-4 sm:right-auto sm:w-96 z-[500] p-4 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl animate-pulse">
        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />
        <div className="h-4 bg-slate-800 rounded-md w-1/3 mb-2" />
        <div className="h-10 bg-slate-800 rounded-md w-1/2 mb-4" />
        <div className="h-20 bg-slate-800 rounded-xl w-full" />
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="absolute bottom-0 left-0 right-0 sm:left-4 sm:bottom-4 sm:right-auto sm:w-96 z-[500] p-4 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl text-xs text-rose-300">
        <p className="font-semibold">Météo indisponible</p>
        <p className="text-slate-400 mt-1">{error || 'Sélectionnez un point en France pour charger les prévisions.'}</p>
      </div>
    );
  }

  const toggleSnap = () => {
    if (snap === 'peek') setSnap('half');
    else if (snap === 'half') setSnap('full');
    else setSnap('peek');
  };

  const getMobileHeightClass = () => {
    switch (snap) {
      case 'peek':
        return 'h-28';
      case 'half':
        return 'h-[50vh]';
      case 'full':
        return 'h-[85vh]';
    }
  };

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 sm:left-4 sm:bottom-4 sm:right-auto sm:w-[380px] sm:max-h-[calc(100vh-2rem)] sm:h-auto z-[500] bg-slate-900/95 backdrop-blur-2xl border border-slate-800/90 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col transition-all duration-300 ease-out overflow-hidden ${getMobileHeightClass()}`}
    >
      {/* Mobile Draggable Handle Bar */}
      <div
        onClick={toggleSnap}
        className="w-full pt-2.5 pb-1 flex flex-col items-center justify-center cursor-pointer sm:hidden select-none active:opacity-70"
      >
        <div className="w-10 h-1 rounded-full bg-slate-700/80 mb-1" />
        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
          {snap === 'full' ? (
            <>
              <span>Réduire</span>
              <ChevronDown className="w-3 h-3" />
            </>
          ) : (
            <>
              <span>Glisser pour plus de détails</span>
              <ChevronUp className="w-3 h-3" />
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-2 flex flex-col gap-4">
        {/* 1. Header & Live Metrics */}
        <CurrentMetrics
          weather={weather}
          field={selectedField}
          onOpenFieldConfig={onOpenFieldConfig}
        />

        {/* 2. Hourly Forecast (Visible in half and full states) */}
        {snap !== 'peek' && (
          <div className="pt-1 border-t border-slate-800/80">
            <HourlyForecast hourly={weather.hourly} />
          </div>
        )}

        {/* 3. Agronomic Risk Intelligence */}
        {snap !== 'peek' && (
          <div className="pt-1 border-t border-slate-800/80">
            <AgriRiskCard
              alerts={agriAlerts}
              hasFieldConfigured={!!selectedField}
              onOpenFieldConfig={onOpenFieldConfig}
            />
          </div>
        )}

        {/* 4. 7-Day Daily Forecast (Visible in half and full states) */}
        {snap !== 'peek' && (
          <div className="pt-1 border-t border-slate-800/80">
            <DailyForecast daily={weather.daily} />
          </div>
        )}

        {/* 5. Footer info & Backend Integration link */}
        {snap === 'full' && (
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
            <span>{weather.dataSource}</span>
            <button
              onClick={onOpenBackendContract}
              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-mono"
            >
              <Terminal className="w-3 h-3" />
              <span>Contrat API Backend</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
