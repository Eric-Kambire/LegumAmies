import React from 'react';

export const IntensityLegend: React.FC = () => {
  return (
    <div className="apple-glass px-3.5 py-1.5 rounded-full text-xs flex items-center gap-2.5 select-none shadow-lg">
      <div className="flex items-center gap-1.5 text-white/60 text-[11px] font-medium">
        <span>Précipitations</span>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-white/50">
        <span>Faible</span>
        <div className="h-1.5 w-20 rounded-full bg-gradient-to-r from-[#38bdf8] via-[#22c55e] via-[#eab308] to-[#ef4444]" />
        <span>Forte</span>
      </div>
    </div>
  );
};
