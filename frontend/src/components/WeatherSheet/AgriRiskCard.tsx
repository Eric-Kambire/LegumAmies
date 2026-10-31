import React from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle, AlertOctagon, HelpCircle } from 'lucide-react';
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
      <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-2xl p-3.5 flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-2.5">
          <HelpCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="font-semibold text-emerald-200">Activer le diagnostic agronomique</p>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Renseignez votre légumineuse et son stade pour afficher les risques météo ciblés.
            </p>
          </div>
        </div>
        <button
          onClick={onOpenFieldConfig}
          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md transition-all active:scale-95 flex-shrink-0 ml-2"
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
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-semibold">
            <AlertOctagon className="w-3 h-3" />
            Critique
          </span>
        );
      case 'alerte':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-semibold">
            <AlertTriangle className="w-3 h-3" />
            Vigilance
          </span>
        );
      case 'vigilance':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[10px] font-medium">
            <ShieldAlert className="w-3 h-3" />
            À surveiller
          </span>
        );
      case 'favorable':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Favorable
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-2.5 select-none">
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span className="font-semibold uppercase tracking-wider text-[10px]">
          Intelligence Agronomique & Risques
        </span>
        <span className="text-[10px] text-emerald-400 font-medium">Filière Légumineuses</span>
      </div>

      <div className="flex flex-col gap-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-3 rounded-2xl border text-xs flex flex-col gap-1.5 transition-all ${
              alert.severity === 'critique'
                ? 'bg-rose-950/20 border-rose-800/40 text-slate-200'
                : alert.severity === 'alerte'
                ? 'bg-amber-950/20 border-amber-800/40 text-slate-200'
                : alert.severity === 'favorable'
                ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-200'
                : 'bg-slate-800/40 border-slate-700/40 text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-100">{alert.title}</span>
              {getSeverityBadge(alert.severity)}
            </div>

            <p className="text-slate-300 text-[11px] leading-relaxed">{alert.description}</p>

            <div className="bg-black/25 rounded-xl p-2 mt-1 flex items-start gap-1.5 text-[11px] text-slate-300">
              <span className="text-emerald-400 font-semibold flex-shrink-0">Conseil :</span>
              <span>{alert.recommendation}</span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-white/5 font-mono">
              <span>Mesuré : {alert.metricValue}</span>
              <span>Seuil : {alert.triggerThreshold}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
