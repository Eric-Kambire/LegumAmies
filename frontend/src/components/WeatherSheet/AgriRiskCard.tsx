import React from 'react';
import { Sprout, AlertCircle, AlertTriangle, CheckCircle2, Sliders } from 'lucide-react';
import type { AgriculturalRiskAlert, RiskSeverity } from '../../types/agricultural';

interface AgriRiskCardProps {
  alerts: AgriculturalRiskAlert[];
  hasFieldConfigured: boolean;
  onOpenFieldConfig: () => void;
}

export const AgriRiskCard: React.FC<AgriRiskCardProps> = ({
  alerts,
  hasFieldConfigured,
  onOpenFieldConfig,
}) => {
  if (!hasFieldConfigured) {
    return (
      <div className="apple-card p-3.5 flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-2.5">
          <Sprout className="w-5 h-5 text-[#34d399] flex-shrink-0" />
          <div>
            <p className="font-semibold text-white">Diagnostic Agronomique</p>
            <p className="text-white/60 text-[11px] mt-0.5">
              Sélectionnez une culture pour calculer les seuils de risque.
            </p>
          </div>
        </div>
        <button
          onClick={onOpenFieldConfig}
          className="px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white font-medium text-xs transition-all active:scale-95 flex-shrink-0 ml-2"
        >
          Configurer
        </button>
      </div>
    );
  }

  const getSeverityBadge = (severity: RiskSeverity) => {
    switch (severity) {
      case 'critique':
        return (
          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Critique
          </span>
        );
      case 'alerte':
        return (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Vigilance
          </span>
        );
      case 'vigilance':
        return (
          <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-medium flex items-center gap-1">
            <Sliders className="w-3 h-3" />
            Surveillance
          </span>
        );
      case 'favorable':
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Favorable
          </span>
        );
    }
  };

  return (
    <div className="apple-card p-3.5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between text-xs text-white/50 font-semibold uppercase tracking-wider mb-2.5 pb-2 border-b border-white/[0.08]">
        <div className="flex items-center gap-1.5">
          <Sprout className="w-3.5 h-3.5" />
          <span>Diagnostic agronomique</span>
        </div>
        <span className="text-[10px] text-white/40 font-normal">Filière Légumineuses</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="p-3 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-xs flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white text-[13px]">{alert.title}</span>
              {getSeverityBadge(alert.severity)}
            </div>

            <p className="text-white/70 text-[11px] leading-relaxed">{alert.description}</p>

            <div className="bg-black/30 rounded-xl p-2.5 mt-0.5 text-[11px] text-white/80 leading-normal">
              <span className="font-semibold text-white/90">Action : </span>
              <span>{alert.recommendation}</span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-white/40 pt-1 border-t border-white/[0.06] font-mono">
              <span>Mesuré : {alert.metricValue}</span>
              <span>Seuil : {alert.triggerThreshold}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
