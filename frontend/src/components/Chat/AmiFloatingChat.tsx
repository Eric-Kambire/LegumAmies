import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, BookOpen, ChevronDown, Loader2, MapPin, MessageCircle, Navigation, Sprout, X } from 'lucide-react';
import type { SelectedField } from '../../types/agricultural';
import type { AdvisorResponse } from '../../types/backend-contract';
import { askAdvisor, isBackendConfigured } from '../../services/legumamiesApi';

type ChatMessage = { id: number; role: 'user' | 'assistant'; text: string; context: string; result?: AdvisorResponse };
type Position = { latitude: number; longitude: number; accuracy: number };

export const AmiFloatingChat: React.FC<{ field: SelectedField | null }> = ({ field }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'field' | 'gps'>('field');
  const [position, setPosition] = useState<Position | null>(null);
  const [positionError, setPositionError] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const nextId = useRef(0);
  const hasOpened = useRef(false);

  useEffect(() => {
    if (open) { hasOpened.current = true; inputRef.current?.focus(); }
    else if (hasOpened.current) launcherRef.current?.focus();
  }, [open]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, loading, open]);

  useEffect(() => {
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('keydown', escape); requestRef.current?.abort(); };
  }, []);

  const getGps = () => {
    setPositionError('');
    if (!navigator.geolocation) {
      setPositionError('La géolocalisation n’est pas disponible dans ce navigateur.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setPosition({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
      (err) => setPositionError(err.message || 'Position indisponible. Sélectionnez plutôt une parcelle.'),
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 12000 }
    );
  };

  const send = async (suggestion?: string) => {
    const text = (suggestion ?? question).trim();
    if (!text || loading) return;
    if (mode === 'gps' && !position) {
      setError('Activez votre position pour demander une analyse à proximité.');
      return;
    }
    if (mode === 'field' && !field) {
      setError('Sélectionnez d’abord une parcelle.');
      return;
    }
    setQuestion('');
    setError('');
    const context = mode === 'gps' ? 'Près de moi' : field?.name || 'Parcelle';
    setMessages((prev) => [...prev, { id: ++nextId.current, role: 'user', text, context }]);
    if (!isBackendConfigured()) {
      setError('Le conseiller AWS n’est pas configuré sur cette version.');
      return;
    }
    const ctrl = new AbortController();
    requestRef.current = ctrl;
    setLoading(true);
    try {
      const loc = mode === 'gps' ? position : field;
      const result = await askAdvisor({
        question: text,
        field: {
          latitude: loc?.latitude,
          longitude: loc?.longitude,
          ...(mode === 'field' && field ? {
            crop: field.cropType,
            growth_stage: field.growthStage,
            harvest_ready: field.growthStage === 'pret_recolter',
            field_name: field.name,
          } : {}),
        },
      }, ctrl.signal);
      setMessages((prev) => [...prev, {
        id: ++nextId.current, role: 'assistant', text: result.answer, result, context,
      }]);
    } catch (err) {
      if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : 'Le conseiller est momentanément indisponible.');
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
      requestRef.current = null;
    }
  };

  return (
    <>
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir Ami, conseiller agricole"
          className="fixed right-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 z-[760] flex items-center gap-2 rounded-full border border-emerald-400/30 bg-[#163f36] px-3 py-2.5 text-white shadow-2xl hover:bg-[#20594b] transition-colors"
        >
          <span aria-hidden="true" className="text-xl leading-none">🧑‍🌾</span>
          <span className="text-sm font-semibold">Ami</span>
          <MessageCircle className="w-4 h-4 text-emerald-200" aria-hidden="true" />
        </button>
      )}
      {open && (
        <section role="dialog" aria-modal="true" aria-label="Ami, conseiller agricole"
          className="fixed z-[810] inset-x-2 top-2 bottom-[calc(5.7rem+env(safe-area-inset-bottom,0px))] md:inset-auto md:right-5 md:bottom-5 md:w-[410px] md:h-[min(690px,calc(100vh-6rem))] flex flex-col overflow-hidden rounded-[26px] border border-white/15 bg-[#111927] text-white shadow-[0_20px_80px_rgba(0,0,0,0.7)]">
          <header className="shrink-0 p-3.5 border-b border-white/10 bg-gradient-to-r from-[#15372f] to-[#121d2a]">
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="w-10 h-10 rounded-full bg-emerald-400/15 flex items-center justify-center text-2xl">🧑‍🌾</span>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold">Ami <span className="text-emerald-300 font-medium">· Conseiller agricole</span></h2>
                <p className="text-[11px] text-white/55 truncate">Amazon Bedrock · Documents agronomiques cités</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer le chat" className="p-2 rounded-full hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={() => setMode('field')} aria-pressed={mode === 'field'} className={`flex-1 rounded-xl border px-2.5 py-2 text-[11px] text-left truncate ${mode === 'field' ? 'bg-emerald-400/15 border-emerald-400/40 text-emerald-100' : 'border-white/10 text-white/55'}`}>
                <Sprout className="w-3.5 h-3.5 inline mr-1.5" />{field?.name || 'Ma parcelle'}
              </button>
              <button type="button" onClick={() => { setMode('gps'); if (!position) getGps(); }} aria-pressed={mode === 'gps'} className={`rounded-xl border px-3 py-2 text-[11px] ${mode === 'gps' ? 'bg-emerald-400/15 border-emerald-400/40 text-emerald-100' : 'border-white/10 text-white/55'}`}>
                <Navigation className="w-3.5 h-3.5 inline mr-1" />Près de moi
              </button>
            </div>
            {mode === 'gps' && <p className="text-[10px] text-white/50 mt-1.5 flex items-center gap-1"><MapPin className="w-3 h-3"/>{position ? `GPS ±${Math.round(position.accuracy)} m` : positionError || 'Autorisez votre position.'} {!position && <button type="button" className="underline ml-1" onClick={getGps}>Réessayer</button>}</p>}
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-white/85">Bonjour ! Je peux expliquer les risques météo, les fenêtres de récolte et les références agronomiques selon votre parcelle ou votre position.</p>
                <p className="text-[11px] text-white/45">Choisissez une question pour commencer :</p>
                {['Quels sont les risques météo pour cette parcelle ?', 'Que disent les prévisions de pluie ?', 'Quelles précautions pour cette culture ?'].map((q) =>
                  <button type="button" key={q} onClick={() => void send(q)} className="block w-full text-left text-xs rounded-2xl p-3 bg-white/5 border border-white/10 hover:bg-white/10">{q}</button>
                )}
              </div>
            )}
            {messages.map((m) => <div key={m.id} className={m.role === 'user' ? 'ml-8' : 'mr-3'}>
              <p className="text-[10px] text-white/40 mb-1">{m.role === 'assistant' ? 'Ami' : 'Vous'} · {m.context}</p>
              <div className={`rounded-2xl px-3.5 py-3 text-[13px] whitespace-pre-wrap leading-relaxed ${m.role === 'user' ? 'bg-emerald-700/55' : 'bg-white/[0.07] border border-white/10'}`}>{m.text}</div>
              {m.result && (
                <div className="mt-2 space-y-1">
                  {m.result.actions?.slice(0, 3).map((a, i) => <div key={i} className="text-[11px] text-emerald-100/85 pl-2 border-l border-emerald-500/40">{a.title}</div>)}
                  {m.result.citations?.length > 0 && <details className="text-[11px] bg-white/5 rounded-xl px-3 py-2"><summary className="cursor-pointer flex items-center gap-1"><BookOpen className="w-3.5 h-3.5"/> Sources ({m.result.citations.length}) <ChevronDown className="ml-auto w-3 h-3"/></summary>
                    <div className="mt-2 space-y-2">{m.result.citations.slice(0, 8).map((c, i) => <div key={i} className="text-white/60">{c.source_url ? <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="underline text-sky-300">{c.institution || c.document || 'Document source'}</a> : (c.institution || c.document || 'Document')}{c.snippet && <p className="line-clamp-3">{c.snippet}</p>}</div>)}</div>
                  </details>}
                </div>
              )}
            </div>)}
            {loading && <p className="text-xs text-white/55 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Ami consulte les données et les sources…</p>}
            {error && <p role="alert" className="text-xs text-rose-200 bg-rose-500/10 rounded-xl p-3">{error}</p>}
            <div ref={endRef}/>
          </div>
          <form className="shrink-0 p-3 border-t border-white/10 bg-[#101623]" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <div className="flex items-end gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-3 py-2">
              <textarea ref={inputRef} value={question} maxLength={1000} rows={2} placeholder="Posez votre question sur cette parcelle…" onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} className="flex-1 min-w-0 bg-transparent text-[13px] text-white placeholder-white/35 resize-none outline-none" />
              <button type="submit" disabled={!question.trim() || loading} aria-label="Envoyer" className="rounded-xl p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"><ArrowUp className="w-4 h-4" /></button>
            </div>
            <p className="text-[10px] text-white/35 mt-1.5 text-center">Réponses documentées · chaque question est analysée dans son contexte</p>
          </form>
        </section>
      )}
    </>
  );
};
