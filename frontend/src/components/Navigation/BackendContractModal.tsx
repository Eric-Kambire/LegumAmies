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

  const contractJson = `// Contrat réel — Légume'Ami ClimateShield API (FastAPI)
// Types : frontend/src/types/backend-contract.ts  •  Schéma : src/api/schemas.py
// Base URL : VITE_API_BASE_URL

GET /health   -> { "status": "ok", ... }
GET /meta     -> vocabulaire cultures/stades, mappings FR<->EN,
                 catalogue de règles sourcées (Terres Inovia)

// Évaluation complète d'une parcelle (prévision réelle + risques sourcés)
POST /assess
Request: {
  "latitude": 48.70,
  "longitude": 2.20,
  "crop": "feverole",            // FR ou EN accepté
  "growth_stage": "floraison",
  "harvest_ready": false,
  "rain_threshold_mm": 5.0
}
Response (extrait) : {
  "weather":  { "model_id": "meteofrance_arome_france_hd", "hourly": [ ... ] },
  "ensemble": { "model_id": "ecmwf_aifs025_ensemble",
                "ensemble_members_valid": 51, "daily": [ ... ] },
  "risk":     { "alerts": [ { "hazard_type": "...", "threshold_value": 25,
                "observed_value": 0, "source_url": "https://www.terresinovia.fr/...",
                "validation_status": "published" } ] },
  "harvest":  { "available": false, "days": [ ... ], "note": "weather-only..." },
  "regulatory_windows": [ { "spraying_allowed": true, "threshold_kmh": 19,
                "source": "Arrêté du 4 mai 2017" } ],
  "provenance": { "arome_model_id": "...", "aifs_model_id": "...",
                "agronomic_sources": [ ... ] }
}

// Pas de valeurs inventées : ni humidité de grain prédite, ni coût de séchage,
// ni % d'égrenage, ni résumé IA, ni prix de revalorisation.`;

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
                AROME France HD • ECMWF AIFS • règles Terres Inovia
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
              <p className="font-semibold text-white">Backend FastAPI</p>
              <p className="text-[10px] text-white/50">AROME/AIFS + règles sourcées (POST /assess)</p>
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
