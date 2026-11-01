import React from 'react';
import { MapPin, SlidersHorizontal, Sprout } from 'lucide-react';
import type { LocationWeatherData } from '../../types/weather';
import type { SelectedField } from '../../types/agricultural';
import { getCropNameFr, getGrowthStageFr } from '../../services/agriRiskService';
import { getWmoWeatherDescription } from '../../services/weatherApi';
import { CropGlyph } from '../Common/LegumeGlyphs';

interface CurrentMetricsProps {
  weather: LocationWeatherData;
  field: SelectedField | null;
  onOpenFieldConfig: () => void;
  pointMode?: boolean;
  pointLabel?: string;
  onBackToField?: () => void;
}

export const CurrentMetrics: React.FC<CurrentMetricsProps> = ({
  weather,
  field,
  onOpenFieldConfig,
  pointMode = false,
  pointLabel,
  onBackToField,
}) => {
  const current = weather.current;
  const today = weather.daily[0];
  const condition = getWmoWeatherDescription(current.weatherCode, current.isDay);

  const cityName = pointMode ? pointLabel || 'Point sélectionné' : field?.commune || `${weather.latitude.toFixed(2)}°, ${weather.longitude.toFixed(2)}°`;

  return (
    <div className="flex flex-col items-center text-center select-none pt-1 pb-2">
      {/* City / Commune Header */}
      <div className="flex items-center gap-1.5 text-white/75 text-sm font-medium tracking-tight">
        <MapPin className="w-3.5 h-3.5 text-white/60" />
        <span className="truncate max-w-[260px]">{cityName}</span>
        {!pointMode && field?.departmentCode && (
          <span className="text-white/40 text-xs font-normal">({field.departmentCode})</span>
        )}
      </div>

      {/* Hero Temperature (Apple Weather Signature Style) */}
      <div className="text-[76px] sm:text-[84px] font-thin text-white tracking-tighter leading-none my-1 select-none">
        {Math.round(current.temperature)}°
      </div>

      {/* Condition label */}
      <p className="text-sm font-medium text-white/80 tracking-normal capitalize">
        {condition.labelFr}
      </p>

      {/* High / Low */}
      {today && (
        <div className="text-xs font-medium text-white/65 mt-0.5 tracking-wide">
          <span>H: {Math.round(today.temperatureMax)}°</span>
          <span className="mx-2 text-white/30">•</span>
          <span>B: {Math.round(today.temperatureMin)}°</span>
        </div>
      )}

      {/* Agricultural Capsule Pill (Apple HIG style) */}
      {pointMode ? (
        <button
          type="button"
          onClick={onBackToField}
          className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.12] hover:bg-white/[0.18] border border-white/[0.15] text-xs text-white/90 font-medium transition-all active:scale-95 shadow-sm"
        >
          <Sprout className="w-3.5 h-3.5 text-white/70" aria-hidden="true" />
          <span>Point exploré · revenir à ma parcelle</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpenFieldConfig}
          className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.12] hover:bg-white/[0.18] border border-white/[0.15] text-xs text-white/90 font-medium transition-all active:scale-95 shadow-sm"
        >
          {field ? (
            <CropGlyph crop={field.cropType} size={15} />
          ) : (
            <Sprout className="w-3.5 h-3.5 text-white/70" />
          )}
          <span>
            {field ? `${getCropNameFr(field.cropType)} • ${getGrowthStageFr(field.growthStage)}` : 'Configurer la parcelle'}
          </span>
          <SlidersHorizontal className="w-3 h-3 text-white/50 ml-0.5" />
        </button>
      )}
    </div>
  );
};
