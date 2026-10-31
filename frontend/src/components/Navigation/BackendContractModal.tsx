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
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="apple-glass rounded-[28px] max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 text-white max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.1] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Contrat d'Interface Backend (Python)</h3>
              <p className="text-[11px] text-white/50 font-mono">
                Météo-France AROME • ECMWF AIFS • Bedrock ML
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Pills */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
            <div>
              <p className="font-semibold text-white">Actif dans le Frontend PWA</p>
              <p className="text-[10px] text-white/50">Open-Meteo & Radar RainViewer Direct</p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#38bdf8]" />
            <div>
              <p className="font-semibold text-white">Prêt pour Backend Python</p>
              <p className="text-[10px] text-white/50">FastAPI, Bedrock GenAI & XGBoost</p>
            </div>
          </div>
        </div>

        {/* Code Snippet */}
        <div className="flex-1 overflow-y-auto bg-black/40 rounded-2xl border border-white/[0.08] p-3.5 font-mono text-xs text-white/80 relative">
          <button
            onClick={copyToClipboard}
            className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-[11px] text-white flex items-center gap-1 transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-[#22c55e]" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copié' : 'Copier'}</span>
          </button>
          <pre className="text-[11px] leading-relaxed whitespace-pre-wrap">{contractJson}</pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-white/50 pt-2 border-t border-white/[0.1]">
          <span>Types TypeScript : <code className="text-white/80">src/types/backend-contract.ts</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white font-medium text-xs transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
