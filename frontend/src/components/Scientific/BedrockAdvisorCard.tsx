import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  AlertTriangle,
  BookOpen,
  ExternalLink,
  ShieldAlert,
  Info,
} from 'lucide-react';
import type { SelectedField } from '../../types/agricultural';
import type { AdvisorResponse } from '../../types/backend-contract';
import { askAdvisor, isBackendConfigured } from '../../services/legumamiesApi';
import { getCropNameFr, getGrowthStageFr } from '../../services/agriRiskService';

interface BedrockAdvisorCardProps {
  field: SelectedField | null;
}

export const BedrockAdvisorCard: React.FC<BedrockAdvisorCardProps> = ({ field }) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AdvisorResponse | null>(null);

  const defaultQuestions = field
    ? [
        `Quel est le risque de chaleur sur ma parcelle de ${getCropNameFr(field.cropType)} (${getGrowthStageFr(field.growthStage)}) ?`,
        `Quelles sont les conditions météo recommandées pour traiter ?`,
        `Le créneau de récolte est-il menacé par les pluies ?`,
      ]
    : [
        'Quels sont les seuils de stress thermique sur les protéagineux ?',
        'Quelles sont les règles de pulvérisation selon l\'Arrêté du 4 mai 2017 ?',
      ];

  const handleAsk = async (queryText?: string) => {
    const q = (queryText || question).trim();
    if (!q) return;

    if (queryText) {
      setQuestion(queryText);
    }

    if (!isBackendConfigured()) {
      setError(
        "L'API FastAPI n'est pas configurée (VITE_API_BASE_URL manquant). Le conseiller Bedrock requiert le backend connecté."
      );
      setResponse(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resp = await askAdvisor({
        field: field
          ? {
              latitude: field.latitude,
              longitude: field.longitude,
              crop: field.cropType,
              growth_stage: field.growthStage,
              harvest_ready: field.growthStage === 'pret_recolter',
              field_name: field.name,
            }
          : undefined,
        question: q,
      });

      setResponse(resp);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de communication avec le conseiller Bedrock';
      setError(
        `${msg}. Aucune réponse générative non sourcée n'est affichée lorsque le modèle ou la Knowledge Base est indisponible.`
      );
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="apple-card p-4 sm:p-5 flex flex-col gap-4 border-white/15">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.08] min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                Conseiller Agronomique IA (Bedrock Converse)
              </h3>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-purple-500/20 text-purple-200 border border-purple-500/30">
                KB C5WRYFYF1O
              </span>
            </div>
            <p className="text-[10px] text-white/50 truncate">
              Synthèse grounded sur le corpus Terres Inovia et les prévisions réelles AROME / AIFS
            </p>
          </div>
        </div>
      </div>

      {/* Suggested Quick Questions */}
      <div className="flex flex-wrap gap-1.5">
        {defaultQuestions.map((s, idx) => (
          <button
            key={idx}
            onClick={() => handleAsk(s)}
            disabled={loading}
            className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/80 hover:text-white transition-all text-left truncate max-w-full disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Question Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk();
        }}
        className="flex gap-2 min-w-0"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={
            field
              ? `Posez une question pour ${field.name} (${getCropNameFr(field.cropType)})...`
              : 'Posez une question agronomique...'
          }
          disabled={loading}
          className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-400/60"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 disabled:opacity-40 text-xs font-semibold text-white transition-all shadow-sm flex-shrink-0"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">Consulter</span>
        </button>
      </form>

      {/* Loading state */}
      {loading && (
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-3 text-xs text-white/70">
          <Loader2 className="w-4 h-4 animate-spin text-purple-400 flex-shrink-0" />
          <span>
            Interrogation de la Knowledge Base Terres Inovia et vérification météo déterministe...
          </span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs text-rose-200">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold block text-white">Conseiller IA indisponible</span>
            <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Response Display */}
      {response && !loading && (
        <div className="flex flex-col gap-3 pt-2 border-t border-white/[0.08] text-xs">
          {/* Answer Section */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-purple-300 uppercase tracking-wider">
                Synthèse Grounded
              </span>
              <span className="text-[10px] font-mono text-white/40">
                {response.model_id || 'Modèle déterministe'}
              </span>
            </div>
            <p className="text-white/90 leading-relaxed whitespace-pre-line text-xs sm:text-sm">
              {response.answer}
            </p>
          </div>

          {/* Action Suggestions */}
          {response.actions && response.actions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                Actions Suggérées (À confirmer au champ) :
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {response.actions.map((act, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-white truncate text-[11px]">
                        {act.title}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 flex-shrink-0">
                        {act.verified ? 'Vérifié' : 'À valider'}
                      </span>
                    </div>
                    <span className="text-[10px] text-white/60">Base : {act.basis}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Citations & Evidence */}
          {response.citations && response.citations.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                Sources Techniques Citées :
              </span>
              <div className="flex flex-col gap-1.5">
                {response.citations.map((cite, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start justify-between gap-2"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="font-semibold text-white/90 block truncate text-[11px]">
                          {cite.institution || 'Terres Inovia'} — {cite.document || cite.hazard || 'Guide technique'}
                        </span>
                        {cite.snippet && (
                          <p className="text-[10px] text-white/60 line-clamp-2 mt-0.5">
                            "{cite.snippet}"
                          </p>
                        )}
                      </div>
                    </div>

                    {cite.source_url && (
                      <a
                        href={cite.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#38bdf8] hover:underline flex items-center gap-1 text-[10px] flex-shrink-0"
                      >
                        <span>Consulter</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Uncertainty & Limitations */}
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-1 text-[10px] text-white/50">
            {response.uncertainty?.note && (
              <div className="flex items-center gap-1 text-white/70">
                <ShieldAlert className="w-3 h-3 text-amber-400 flex-shrink-0" />
                <span>Incertitude ensemble : {response.uncertainty.note}</span>
              </div>
            )}
            <div className="flex items-start gap-1">
              <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>
                {response.limitations?.join(' ') ||
                  "Aucune estimation de rendement, d'économie phytosanitaire ou de bénéfice économique n'est fournie."}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
