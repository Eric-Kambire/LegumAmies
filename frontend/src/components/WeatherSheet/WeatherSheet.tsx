import React, { useEffect, useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Terminal,
  Minimize2,
  Maximize2,
  MapPin,
} from 'lucide-react';
import type { LocationWeatherData } from '../../types/weather';
import type { SelectedField, AgriculturalRiskAlert } from '../../types/agricultural';
import { CurrentMetrics } from './CurrentMetrics';
import { HourlyForecast } from './HourlyForecast';
import { DailyForecast } from './DailyForecast';
import { AgriRiskCard } from './AgriRiskCard';
import { getWmoWeatherDescription } from '../../services/weatherApi';

interface WeatherSheetProps {
  weather: LocationWeatherData | null;
  isLoading: boolean;
  error: string | null;
  selectedField: SelectedField | null;
  agriAlerts: AgriculturalRiskAlert[];
  onOpenFieldConfig: () => void;
  onOpenBackendContract: () => void;
  /** True when the weather shown is for a clicked/GPS point, not for the selected field. */
  pointMode?: boolean;
  pointLabel?: string;
  onBackToField?: () => void;
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
  pointMode = false,
  pointLabel,
  onBackToField,
}) => {
  const [snap, setSnap] = useState<SheetSnap>('half');
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState<boolean>(false);

  // Publish the sheet height so other fixed layers (radar timeline, Ami) can stack above it.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.sheetSnap = isLoading || error || !weather ? 'peek' : snap;
    return () => {
      delete root.dataset.sheetSnap;
    };
  }, [snap, isLoading, error, weather]);

  // Real Touch Drag Gesture Support for Android & iOS Mobile
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - touchStartY;
    setDragOffset(delta);
  };

  const handleTouchEnd = () => {
    if (touchStartY === null) return;
    setIsDragging(false);

    const threshold = 35; // px gesture sensitivity
    if (dragOffset > threshold) {
      // Dragged down
      if (snap === 'full') setSnap('half');
      else if (snap === 'half') setSnap('peek');
    } else if (dragOffset < -threshold) {
      // Dragged up
      if (snap === 'peek') setSnap('half');
      else if (snap === 'half') setSnap('full');
    }

    setTouchStartY(null);
    setDragOffset(0);
  };

  const toggleMobileSnap = () => {
    if (snap === 'peek') setSnap('half');
    else if (snap === 'half') setSnap('full');
    else setSnap('peek');
  };

  if (isLoading) {
    return (
      <div className="map-bottom-sheet absolute left-0 right-0 lg:left-auto lg:right-20 lg:top-20 lg:w-[420px] z-[500] p-6 apple-glass rounded-t-[28px] lg:rounded-[28px] animate-pulse">
        <div className="w-9 h-1 bg-white/20 rounded-full mx-auto mb-4 lg:hidden" />
        <div className="h-4 bg-white/10 rounded-md w-1/3 mx-auto mb-3" />
        <div className="h-14 bg-white/10 rounded-md w-1/2 mx-auto mb-4" />
        <div className="h-28 bg-white/10 rounded-2xl w-full" />
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="map-bottom-sheet absolute left-0 right-0 lg:left-auto lg:right-20 lg:top-20 lg:w-[420px] z-[500] p-6 apple-glass rounded-t-[28px] lg:rounded-[28px] text-xs text-white">
        <p className="font-semibold text-rose-300">Météo indisponible</p>
        <p className="text-white/60 mt-1">{error || 'Touchez un point en France pour charger les prévisions.'}</p>
      </div>
    );
  }

  const current = weather.current;
  const condition = getWmoWeatherDescription(current.weatherCode, current.isDay);
  const locationLabel = pointMode ? pointLabel || 'Point sélectionné' : selectedField?.commune || selectedField?.name || 'France';

  // Desktop Collapsed Dock: Compact floating widget that never covers the map
  if (isDesktopCollapsed) {
    return (
      <div className="hidden lg:flex absolute right-20 bottom-6 z-[500] apple-glass px-4 py-2.5 rounded-full items-center gap-3 shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 select-none">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span className="text-xs font-bold text-white max-w-[140px] truncate">{locationLabel}</span>
          <span className="text-xs font-semibold text-white/90">{Math.round(current.temperature)}°C</span>
          <span className="text-[11px] text-white/50">{condition.labelFr}</span>
        </div>

        <button
          onClick={() => setIsDesktopCollapsed(false)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-black text-xs font-bold hover:bg-white/90 active:scale-95 transition-all shadow-sm"
          title="Afficher les détails météo"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Détails</span>
        </button>
      </div>
    );
  }

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
      style={{
        transform: isDragging && dragOffset > 0 ? `translateY(${Math.min(dragOffset, 120)}px)` : undefined,
      }}
      className={`map-bottom-sheet absolute left-0 right-0 lg:left-auto lg:right-20 lg:top-20 lg:w-[420px] lg:max-h-[calc(100vh-6.5rem)] lg:h-auto z-[500] apple-glass rounded-t-[28px] lg:rounded-[28px] flex flex-col transition-all duration-300 ease-out overflow-hidden shadow-2xl ${getMobileHeightClass()}`}
    >
      {/* 1. Desktop Header Bar: Minimize / Expand Action to free up the map */}
      <div className="hidden lg:flex items-center justify-between px-4 pt-3 pb-1 border-b border-white/[0.08] select-none">
        <div className="flex items-center gap-1.5 text-xs text-white/70">
          <MapPin className="w-3.5 h-3.5 text-white/50" />
          <span className="font-semibold text-white truncate max-w-[200px]">{locationLabel}</span>
        </div>

        <button
          onClick={() => setIsDesktopCollapsed(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-white/15 text-white/60 hover:text-white text-[11px] transition-all active:scale-95 cursor-pointer"
          title="Réduire le volet pour voir la carte complète"
        >
          <Minimize2 className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span>Réduire</span>
        </button>
      </div>

      {/* 2. Mobile Interactive Drag Handle & Gesture Touch Zone */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={toggleMobileSnap}
        className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-pointer lg:hidden select-none active:opacity-60 touch-none"
      >
        <div className="w-11 h-1.5 rounded-full bg-white/40 mb-1.5 transition-colors hover:bg-white/60" />
        <div className="text-[10px] text-white/50 flex items-center gap-1 font-medium">
          {snap === 'full' ? (
            <>
              <span>Glisser ou toucher pour réduire</span>
              <ChevronDown className="w-3.5 h-3.5 text-white/70" />
            </>
          ) : (
            <>
              <span>Glisser pour étendre</span>
              <ChevronUp className="w-3.5 h-3.5 text-white/70" />
            </>
          )}
        </div>
      </div>

      {/* 3. Sheet Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-1 flex flex-col gap-3.5 scrollbar-none">
        {/* 1. Signature Apple Weather Hero */}
        <CurrentMetrics
          weather={weather}
          field={selectedField}
          onOpenFieldConfig={onOpenFieldConfig}
          pointMode={pointMode}
          pointLabel={pointLabel}
          onBackToField={onBackToField}
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
        {snap !== 'peek' && !pointMode && (
          <AgriRiskCard
            alerts={agriAlerts}
            hasFieldConfigured={!!selectedField}
            onOpenFieldConfig={onOpenFieldConfig}
          />
        )}

        {/* 5. Footer info */}
        {(snap === 'full' || typeof window !== 'undefined') && (
          <div className="pt-2 flex items-center justify-between text-[11px] text-white/40 px-1 border-t border-white/[0.06]">
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
