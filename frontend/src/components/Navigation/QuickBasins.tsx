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
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 px-1 -mx-1 select-none">
      {FRENCH_AGRI_BASINS.map((basin) => {
        const isSelected = selectedBasinId === basin.id;
        return (
          <button
            key={basin.id}
            onClick={() => onSelectBasin(basin)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
              isSelected
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950 font-semibold'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800/80'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{basin.name.split(' ')[0]}</span>
          </button>
        );
      })}
    </div>
  );
};
