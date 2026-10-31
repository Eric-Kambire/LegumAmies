import React from 'react';
import { FRENCH_AGRI_BASINS } from '../../data/frenchAgriBasins';
import type { FrenchAgriBasin } from '../../data/frenchAgriBasins';

interface QuickBasinsProps {
  onSelectBasin: (basin: FrenchAgriBasin) => void;
  selectedBasinId?: string;
}

export const QuickBasins: React.FC<QuickBasinsProps> = ({
  onSelectBasin,
  selectedBasinId,
}) => {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 select-none">
      {FRENCH_AGRI_BASINS.map((basin) => {
        const isSelected = selectedBasinId === basin.id;
        return (
          <button
            key={basin.id}
            onClick={() => onSelectBasin(basin)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95 flex items-center gap-1.5 ${
              isSelected
                ? 'bg-white text-black font-semibold shadow-md'
                : 'apple-glass text-white/80 hover:text-white'
            }`}
          >
            <span>{basin.name.split(' ')[0]}</span>
          </button>
        );
      })}
    </div>
  );
};
