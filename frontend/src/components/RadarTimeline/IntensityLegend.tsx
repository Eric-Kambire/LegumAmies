import React from 'react';

export const IntensityLegend: React.FC = () => {
  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 px-3 py-2 rounded-xl text-xs flex items-center gap-3 shadow-lg select-none">
      <div className="flex items-center gap-1.5 text-slate-400 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span>Intensité pluie</span>
      </div>

      <div className="flex items-center gap-1 text-[10px] text-slate-300">
        <span>Faible</span>
        <div className="h-2 w-24 rounded-full bg-gradient-to-r from-sky-400 via-emerald-400 via-amber-400 to-rose-600 border border-white/10" />
        <span>Orage</span>
      </div>

      <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-400 border-l border-slate-800 pl-2">
        <span>&lt;1 mm/h</span>
        <span>•</span>
        <span>5 mm/h</span>
        <span>•</span>
        <span className="text-rose-400">&gt;20 mm/h</span>
      </div>
    </div>
  );
};
