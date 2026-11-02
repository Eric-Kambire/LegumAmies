import React, { useEffect, useMemo, useRef } from 'react';
import { ArrowRight, BarChart3, BookOpen, CloudSun, Flame, Send, Sprout, Trash2, X } from 'lucide-react';
import { AmiAvatar } from './AmiAvatar';
import { AmiMessage } from './AmiMessage';
import { AmiContextSelector } from './AmiContextSelector';
import { AMI_CAPABILITY_BLURBS, AMI_EXPLORE_ACTIONS, buildQuickActions, type AmiCapabilityKind } from './amiCapabilities';
import type { AmiChat } from '../../hooks/useAmiChat';
import type { SelectedField } from '../../types/agricultural';
import type { AppTab } from '../Navigation/AppleTabBar';
import { getCropNameFr, getGrowthStageFr } from '../../services/agriRiskService';

interface AmiChatPanelProps {
  ami: AmiChat;
  fields: SelectedField[];
  activeField: SelectedField | null;
  onSelectField: (field: SelectedField) => void;
  returnFocusRef: React.RefObject<HTMLElement | null>;
  /** Lets Ami take the farmer to the relevant screen (agentic navigation). */
  onNavigate?: (tab: AppTab) => void;
}

const MAX_LEN = 1000;
const FOCUSABLE = 'button:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], input:not([disabled])';

const CAPABILITY_ICON: Record<AmiCapabilityKind, React.ComponentType<{ className?: string }>> = {
  risk: Flame,
  frost: Flame,
  spray: CloudSun,
  harvest: Sprout,
  guide: BookOpen,
  weather: CloudSun,
  generic: Sprout,
};

const EXPLORE_ICON: Record<AppTab, React.ComponentType<{ className?: string }>> = {
  home: Sprout,
  weather: CloudSun,
  fields: Sprout,
  insights: BarChart3,
  notifications: BarChart3,
};

export const AmiChatPanel: React.FC<AmiChatPanelProps> = ({ ami, fields, activeField, onSelectField, returnFocusRef, onNavigate }) => {
  const { isOpen, messages, loading, draft, mode, position } = ami;
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Full-text suggestions for the empty state (prefill, never auto-send).
  const suggestions = useMemo(() => {
    if (mode === 'position') {
      return ['Quelles sont les conditions météo à ma position ?', 'Y a-t-il de la pluie prévue dans les prochains jours ici ?'];
    }
    if (!activeField) return ['Quels sont les seuils de stress thermique sur les protéagineux ?'];
    const crop = getCropNameFr(activeField.cropType).toLowerCase();
    return [
      `Quel est le risque de chaleur pour mon ${crop} (${getGrowthStageFr(activeField.growthStage).toLowerCase()}) ?`,
      'Puis-je traiter dans les prochains jours ?',
      'La pluie menace-t-elle ma récolte ?',
    ];
  }, [mode, activeField]);

  // Compact, context-aware capability chips used as follow-ups after an answer.
  const quickActions = useMemo(() => buildQuickActions(mode, activeField), [mode, activeField]);
  const positionBlocked = mode === 'position' && !position;

  // Focus management: move focus in on open, restore it to the launcher on close.
  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    const returnTarget = returnFocusRef.current;
    return () => {
      window.clearTimeout(t);
      returnTarget?.focus();
    };
  }, [isOpen, returnFocusRef]);

  // Escape closes the panel wherever the focus is (the panel is non-modal on desktop).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ami.close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, ami]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, isOpen]);

  // Prefilled questions (from other screens) should be visible and editable.
  useEffect(() => {
    if (isOpen && draft && inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [draft, isOpen]);

  if (!isOpen) return null;

  const canSend = !loading && draft.trim().length > 0 && !positionBlocked;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      ami.close();
      return;
    }
    if (e.key === 'Tab' && panelRef.current) {
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      // Trap focus inside the dialog (modal on phones, harmless on desktop).
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const submit = () => {
    if (canSend) void ami.ask(draft);
  };

  // A quick action is agentic: one tap runs the full grounded tool pipeline.
  const runQuick = (question: string) => {
    if (loading || positionBlocked) return;
    void ami.ask(question);
  };

  const goTo = (tab: AppTab) => {
    onNavigate?.(tab);
  };

  // Representative question for a capability blurb (so the showcase is actionable).
  const questionForKind = (kind: AmiCapabilityKind): string => {
    const match = quickActions.find((q) => q.kind === kind);
    return match?.question ?? suggestions[0];
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Assistant agricole Ami"
      onKeyDown={handleKeyDown}
      data-testid="ami-panel"
      className="ami-panel fixed z-[850] flex flex-col apple-glass text-white overflow-hidden max-md:inset-0 max-md:rounded-none md:w-[420px] md:rounded-[28px] animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] md:pt-3 pb-3 bg-gradient-to-b from-white/[0.06] to-transparent">
        <span className="relative flex-shrink-0">
          <AmiAvatar size={36} />
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0b0f19]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold leading-tight" data-testid="ami-title">
            {ami.contextLabel}
          </h2>
          <p className="text-[11px] text-white/50">Conseiller agricole IA · réponses sourcées</p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={ami.clear}
            aria-label="Effacer l'historique de la conversation"
            title="Effacer l'historique"
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={ami.close}
          aria-label="Fermer Ami"
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 hover:bg-white/20"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <AmiContextSelector ami={ami} fields={fields} activeField={activeField} onSelectField={onSelectField} />

      {/* Conversation */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3" aria-live="polite" data-testid="ami-thread">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-4 py-2">
            <div className="text-center flex flex-col items-center gap-1.5 pt-1">
              <AmiAvatar size={48} />
              <p className="text-sm font-semibold text-white">Bonjour, je suis Ami</p>
              <p className="text-xs text-white/60 max-w-[18rem] leading-relaxed">
                {mode === 'position'
                  ? 'Posez une question sur la météo à votre position, ou choisissez une action ci-dessous.'
                  : 'Votre conseiller pour les légumineuses. Je combine la météo, les règles de risque et les guides Terres Inovia.'}
              </p>
            </div>

            {/* What Ami can do — capability showcase (actionable) */}
            <div className="grid grid-cols-2 gap-2" data-testid="ami-capabilities">
              {AMI_CAPABILITY_BLURBS.map((c) => {
                const Icon = CAPABILITY_ICON[c.kind];
                return (
                  <button
                    key={c.kind}
                    type="button"
                    disabled={positionBlocked}
                    onClick={() => runQuick(questionForKind(c.kind))}
                    className="text-left rounded-2xl bg-white/[0.05] border border-white/10 p-2.5 hover:bg-white/[0.1] hover:border-[#38bdf8]/30 disabled:opacity-40 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-white">
                      <Icon className="w-3.5 h-3.5 text-[#38bdf8]" />
                      {c.title}
                    </span>
                    <span className="block mt-0.5 text-[10.5px] text-white/55 leading-snug">{c.detail}</span>
                  </button>
                );
              })}
            </div>

            {/* Starter questions (prefill, editable) */}
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold px-0.5">Questions rapides</p>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={positionBlocked}
                  onClick={() => ami.setDraft(s)}
                  className="text-left text-xs px-3 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-white/80 hover:bg-white/10 disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Explore — Ami can take you to the right screen */}
            {onNavigate && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold px-0.5">Explorer</p>
                <div className="flex flex-wrap gap-1.5">
                  {AMI_EXPLORE_ACTIONS.map((a) => {
                    const Icon = EXPLORE_ICON[a.tab];
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => goTo(a.tab)}
                        className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-white/75 hover:bg-white/10"
                      >
                        <Icon className="w-3 h-3 text-white/55" />
                        {a.label}
                        <ArrowRight className="w-3 h-3 text-white/40" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          messages.map((m, i) => {
            const prevUser = [...messages.slice(0, i)].reverse().find((x) => x.role === 'user');
            return <AmiMessage key={m.id} message={m} onRetry={(q) => void ami.ask(q)} previousQuestion={prevUser?.text} />;
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Agentic follow-up row: one-tap grounded actions + navigation, shown once a conversation exists. */}
      {messages.length > 0 && !positionBlocked && (
        <div className="px-3 pt-2 flex gap-1.5 overflow-x-auto scrollbar-none" data-testid="ami-quick-actions">
          {quickActions.map((q) => {
            const Icon = CAPABILITY_ICON[q.kind];
            return (
              <button
                key={q.id}
                type="button"
                disabled={loading}
                onClick={() => runQuick(q.question)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] px-2.5 py-1.5 rounded-full bg-white/[0.07] border border-white/10 text-white/80 hover:bg-white/12 disabled:opacity-40 flex-shrink-0"
              >
                <Icon className="w-3 h-3 text-[#38bdf8]" />
                {q.label}
              </button>
            );
          })}
          {onNavigate &&
            AMI_EXPLORE_ACTIONS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => goTo(a.tab)}
                className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] px-2.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-white/60 hover:bg-white/10 flex-shrink-0"
              >
                {a.label}
                <ArrowRight className="w-3 h-3 text-white/40" />
              </button>
            ))}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] border-t border-white/[0.08]"
      >
        {positionBlocked && (
          <p className="text-[11px] text-amber-200 px-1 pb-1.5">Choisissez d'abord une position pour poser une question près de vous.</p>
        )}
        <div className="flex items-end gap-2">
          <label htmlFor="ami-input" className="sr-only">
            Votre question pour Ami
          </label>
          <textarea
            id="ami-input"
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={MAX_LEN}
            onChange={(e) => {
              ami.setDraft(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Écrire à Ami…"
            disabled={loading}
            className="flex-1 resize-none rounded-2xl bg-black/35 border border-white/15 px-3.5 py-2.5 text-[13px] text-white placeholder-white/35 focus:outline-none focus:border-[#38bdf8]/60 select-text"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Envoyer la question"
            className="w-10 h-10 rounded-full bg-[#0a84ff] disabled:bg-white/15 disabled:text-white/40 text-white flex items-center justify-center flex-shrink-0 active:scale-95 transition-colors"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <p className="text-[10px] text-white/40 px-1 pt-1.5 leading-relaxed">
          Chaque question est analysée séparément ; l'historique reste sur votre appareil. Ami ne remplace pas un conseil agronomique.
          {draft.length > 900 ? ` ${MAX_LEN - draft.length} caractères restants.` : ''}
        </p>
      </form>
    </div>
  );
};
