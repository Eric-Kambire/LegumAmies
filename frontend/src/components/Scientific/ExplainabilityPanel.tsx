import React from 'react';
import { ShieldCheck, Layers, FileText } from 'lucide-react';

export interface DecisionTrace {
  id: string;
  title: string;
  status: string;
  isTriggered: boolean;
  ruleType: string;
  formula: string;
  scientificExplanation: string;
  parameters: Array<{
    name: string;
    value: string;
    threshold: string;
    status: 'ok' | 'warning' | 'critical';
  }>;
}

interface ExplainabilityPanelProps {
  traces: DecisionTrace[];
  selectedTraceId?: string | null;
  shapOutputs?: Record<string, number> | null;
}

export const ExplainabilityPanel: React.FC<ExplainabilityPanelProps> = ({
  traces,
  selectedTraceId,
  shapOutputs,
}) => {
  return (
    <div className="flex flex-col gap-4">
      {/* Transparency Guarantee Card */}
      <div className="apple-card p-4 bg-gradient-to-br from-sky-950/30 via-white/[0.03] to-transparent border-sky-800/30 text-xs text-white/80 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#38bdf8] flex-shrink-0" />
          <h4 className="font-bold text-white text-xs sm:text-sm">
            Transparence Scientifique & Explicabilité Déterministe
          </h4>
        </div>
        <p className="text-[11px] text-white/70 leading-relaxed">
          Toutes les recommandations de LegumAmies reposent sur des seuils agronomiques publiés (Terres Inovia), des modèles physiques (AROME / ECMWF AIFS) et des règles réglementaires officielles.
        </p>

        {/* SHAP explanation disclosure */}
        {shapOutputs && Object.keys(shapOutputs).length > 0 ? (
          <div className="p-3 rounded-xl bg-black/40 border border-white/10 mt-1 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs text-amber-300 font-semibold">
              <Layers className="w-3.5 h-3.5" />
              <span>Attributions SHAP validées (Modèle ML entraîné)</span>
            </div>
            <div className="flex flex-col gap-1.5 text-[11px]">
              {Object.entries(shapOutputs).map(([feature, val]) => (
                <div key={feature} className="flex items-center justify-between font-mono">
                  <span className="text-white/60">{feature} :</span>
                  <span className={val >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                    {val > 0 ? `+${val.toFixed(3)}` : val.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[10px] text-white/55 flex items-start gap-2 mt-1">
            <FileText className="w-3.5 h-3.5 text-white/40 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Garantie scientifique :</strong> Aucune attribution SHAP simulée ou fabriquée. Les calculs étant déterministes et vérifiables, la traçabilité des seuils remplace intégralement les boîtes noires statistiques.
            </span>
          </div>
        )}
      </div>

      {/* Decision Traces Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {traces.map((trace) => {
          const isSelected = selectedTraceId && trace.id.includes(selectedTraceId);

          return (
            <div
              key={trace.id}
              className={`apple-card p-4 flex flex-col gap-3 transition-all ${
                isSelected ? 'border-[#38bdf8] bg-sky-950/25 ring-1 ring-[#38bdf8]/40' : ''
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.08] min-w-0">
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">{trace.title}</h4>
                  <p className="text-[10px] text-white/40 truncate mt-0.5">{trace.ruleType}</p>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                    trace.isTriggered
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-white/10 text-white/60'
                  }`}
                >
                  {trace.status}
                </span>
              </div>

              {/* Condition / Formula */}
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-[11px] text-white/80">
                <span className="text-white/40 block text-[9px] uppercase tracking-wide">
                  Règle appliquée :
                </span>
                {trace.formula}
              </div>

              {/* Scientific Rationale */}
              <p className="text-xs text-white/75 leading-relaxed">
                {trace.scientificExplanation}
              </p>

              {/* Parameters Table */}
              {trace.parameters.length > 0 && (
                <div className="pt-2 border-t border-white/[0.06] flex flex-col gap-1.5 text-xs">
                  {trace.parameters.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px]">
                      <span className="text-white/60">{p.name} :</span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className={`font-semibold ${
                          p.status === 'critical' ? 'text-rose-300' : p.status === 'warning' ? 'text-amber-300' : 'text-emerald-300'
                        }`}>
                          {p.value}
                        </span>
                        <span className="text-white/40 text-[10px]">(Seuil : {p.threshold})</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
