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
      <div className="absolute bottom-0 left-0 right-0 md:left-auto md:right-6 md:top-20 md:bottom-6 md:w-[400px] lg:w-[420px] z-[500] p-6 apple-glass rounded-t-[28px] md:rounded-[28px] animate-pulse">
        <div className="w-9 h-1 bg-white/20 rounded-full mx-auto mb-4 md:hidden" />
        <div className="h-4 bg-white/10 rounded-md w-1/3 mx-auto mb-3" />
        <div className="h-14 bg-white/10 rounded-md w-1/2 mx-auto mb-4" />
        <div className="h-28 bg-white/10 rounded-2xl w-full" />
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="absolute bottom-0 left-0 right-0 md:left-auto md:right-6 md:top-20 md:bottom-6 md:w-[400px] lg:w-[420px] z-[500] p-6 apple-glass rounded-t-[28px] md:rounded-[28px] text-xs text-white">
        <p className="font-semibold text-rose-300">Météo indisponible</p>
        <p className="text-white/60 mt-1">{error || 'Touchez un point en France pour charger les prévisions.'}</p>
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
        return 'h-32';
      case 'half':
        return 'h-[52vh]';
      case 'full':
        return 'h-[86vh]';
    }
  };

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 md:left-auto md:right-6 md:top-20 md:bottom-6 md:w-[400px] lg:w-[420px] md:max-h-[calc(100vh-6.5rem)] md:h-auto z-[500] apple-glass rounded-t-[28px] md:rounded-[28px] flex flex-col transition-all duration-300 ease-out overflow-hidden ${getMobileHeightClass()}`}
    >
      {/* iOS Drag Handle Indicator (Mobile only) */}
      <div
        onClick={toggleSnap}
        className="w-full pt-2.5 pb-1 flex flex-col items-center justify-center cursor-pointer md:hidden select-none active:opacity-60"
      >
        <div className="w-9 h-1 rounded-full bg-white/30 mb-1" />
        <div className="text-[10px] text-white/40 flex items-center gap-1 font-medium">
          {snap === 'full' ? (
            <>
              <span>Réduire</span>
              <ChevronDown className="w-3 h-3" />
            </>
          ) : (
            <>
              <span>Glisser pour afficher les détails</span>
              <ChevronUp className="w-3 h-3" />
            </>
          )}
        </div>
      </div>

      {/* Sheet Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-1 flex flex-col gap-3.5 scrollbar-none">
        {/* 1. Signature Apple Weather Hero */}
        <CurrentMetrics
          weather={weather}
          field={selectedField}
          onOpenFieldConfig={onOpenFieldConfig}
        />

        {/* 2. 24h Hourly Forecast Card */}
        {snap !== 'peek' && (
          <HourlyForecast hourly={weather.hourly} />
        )}

        {/* 3. 7-Day Forecast Card */}
        {snap !== 'peek' && (
          <DailyForecast daily={weather.daily} />
        )}

        {/* 4. Agricultural Risk Assessment Card */}
        {snap !== 'peek' && (
          <AgriRiskCard
            alerts={agriAlerts}
            hasFieldConfigured={!!selectedField}
            onOpenFieldConfig={onOpenFieldConfig}
          />
        )}

        {/* 5. Footer info */}
        {snap === 'full' && (
          <div className="pt-2 flex items-center justify-between text-[11px] text-white/40 px-1">
            <span>{weather.dataSource}</span>
            <button
              onClick={onOpenBackendContract}
              className="flex items-center gap-1 text-[#38bdf8] hover:underline"
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
