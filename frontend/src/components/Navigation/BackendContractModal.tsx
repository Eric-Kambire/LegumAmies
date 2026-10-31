import React, { useState } from 'react';
import { X, Check, Copy, Server } from 'lucide-react';

interface BackendContractModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackendContractModal: React.FC<BackendContractModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const contractJson = `// Contrat d'interface FastAPI (Python Agent Kiro) <-> LegumAmies PWA
// Emplacement : frontend/src/types/backend-contract.ts

// 1. Récupération Météo-France AROME (1.3km)
POST /api/v1/weather/arome
Request: {
  "latitude": 43.3183,
  "longitude": 1.9538,
  "horizon_hours": 48,
  "variables": ["t2m", "rh2m", "precip_1h", "wind10m", "gust10m", "cloud_low"]
}
Response: {
  "model": "meteofrance_arome_1p3km",
  "run_time_utc": "2026-10-31T12:00:00Z",
  "hourly": [ ... ]
}

// 2. Modèle ML & Bedrock - Fenêtre de Récolte Optimale
POST /api/v1/harvest/window
Request: {
  "crop_type": "pois_chiche",
  "latitude": 43.3183,
  "longitude": 1.9538
}
Response: {
  "opportunity_score_0_100": 88,
  "recommendation_status": "GO_HARVEST",
  "optimal_start_date": "2026-08-04",
  "optimal_end_date": "2026-08-07",
  "predicted_grain_moisture_pct": 14.2,
  "drying_cost_estimate_eur_per_t": 0.0,
  "pod_shattering_risk_pct": 12.0,
  "advisor_summary_fr": "Conditions idéales : humidité sous 15% et vent modéré."
}

// 3. Revalorisation des Écarts de Tri (Upcycling Circulaire)
POST /api/v1/circular/match
Request: {
  "crop_type": "lentille",
  "defect_type": "brisure",
  "quantity_tonnes": 6.5,
  "department_code": "36"
}
Response: {
  "batch_id": "batch_9812",
  "upcycling_destinations": [
    {
      "sector": "meunerie_farine_pulse",
      "title_fr": "Farine de lentille verte pour biscuiterie",
      "estimated_price_eur_per_t": 620.0,
      "standard_animal_price_eur_per_t": 180.0,
      "value_recovery_pct": 244.4
    }
  ]
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(contractJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-5 shadow-2xl flex flex-col gap-4 text-slate-100 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Contrat d'Interface Backend (Python / Kiro)</h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Météo-France AROME • ECMWF AIFS • Bedrock ML
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Pills: Live vs Future */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-800/30 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <p className="font-semibold text-emerald-300">Actif dans le Frontend PWA</p>
              <p className="text-[10px] text-slate-400">Open-Meteo & Radar RainViewer Direct</p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-sky-950/20 border border-sky-800/30 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <div>
              <p className="font-semibold text-sky-300">Prêt pour Backend Python</p>
              <p className="text-[10px] text-slate-400">FastAPI, Bedrock GenAI & XGBoost</p>
            </div>
          </div>
        </div>

        {/* Code Snippet */}
        <div className="flex-1 overflow-y-auto bg-slate-950/90 rounded-2xl border border-slate-800/90 p-3 font-mono text-xs text-slate-300 relative">
          <button
            onClick={copyToClipboard}
            className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 flex items-center gap-1 transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copié' : 'Copier'}</span>
          </button>
          <pre className="text-[11px] leading-relaxed whitespace-pre-wrap">{contractJson}</pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
          <span>Types TypeScript : <code className="text-emerald-400">src/types/backend-contract.ts</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
