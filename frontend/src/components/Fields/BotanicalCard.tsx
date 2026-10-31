import React from 'react';
import type { LegumeCropType, CropGrowthStage } from '../../types/agricultural';
import { LEGUME_CROPS_CATALOG, GROWTH_STAGES_CATALOG } from '../../data/legumeCatalog';

interface BotanicalCardProps {
  cropType?: LegumeCropType;
  growthStage?: CropGrowthStage;
  isSelected?: boolean;
  onClick?: () => void;
  variant?: 'crop' | 'stage';
}

export const BotanicalCard: React.FC<BotanicalCardProps> = ({
  cropType,
  growthStage,
  isSelected = false,
  onClick,
  variant = 'crop',
}) => {
  if (variant === 'crop' && cropType) {
    const crop = LEGUME_CROPS_CATALOG[cropType];
    if (!crop) return null;

    return (
      <div
        onClick={onClick}
        className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-2 active:scale-98 ${
          isSelected
            ? 'apple-glass border-white/40 shadow-xl bg-white/[0.15]'
            : 'apple-card hover:bg-white/[0.1]'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-2xl bg-white/[0.08] flex items-center justify-center text-xl shadow-inner">
            {crop.emoji}
          </div>
          {isSelected && (
            <span className="w-2 h-2 rounded-full bg-[#007aff]" />
          )}
        </div>

        <div>
          <h4 className="text-xs font-semibold text-white tracking-tight">{crop.labelFr}</h4>
          <p className="text-[10px] text-white/50 italic font-mono mt-0.5">{crop.scientificName}</p>
        </div>

        <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-white/60">
          <span>Semis : {crop.typicalSowingMonths.split(' ')[0]}</span>
          <span className="text-white/40 font-mono">Tmax {crop.heatThresholdC}°C</span>
        </div>
      </div>
    );
  }

  if (variant === 'stage' && growthStage) {
    const stage = GROWTH_STAGES_CATALOG[growthStage];
    if (!stage) return null;

    return (
      <div
        onClick={onClick}
        className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-2 active:scale-98 ${
          isSelected
            ? 'apple-glass border-white/40 shadow-xl bg-white/[0.15]'
            : 'apple-card hover:bg-white/[0.1]'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-2xl bg-white/[0.08] flex items-center justify-center text-xl">
            {stage.emoji}
          </div>
          {isSelected && (
            <span className="w-2 h-2 rounded-full bg-[#007aff]" />
          )}
        </div>

        <div>
          <h4 className="text-xs font-semibold text-white tracking-tight">{stage.labelFr}</h4>
          <p className="text-[11px] text-white/70 mt-0.5 leading-snug">{stage.shortDescFr}</p>
        </div>

        <div className="pt-1.5 border-t border-white/[0.06] flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-wider text-white/40 font-semibold">Risques clés</span>
          <p className="text-[10px] text-white/60 truncate">{stage.criticalRisks[0]}</p>
        </div>
      </div>
    );
  }

  return null;
};
