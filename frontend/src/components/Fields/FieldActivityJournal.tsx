import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus, Trash2, X } from 'lucide-react';
import type { SelectedField } from '../../types/agricultural';

export interface FieldEvent {
  id: string;
  fieldId: string;
  date: string;
  type: 'irrigation' | 'fertilizer' | 'biostimulant' | 'spraying' | 'tillage' | 'cover_crop' | 'crop_rotation';
  quantity?: number;
  unit?: string;
  product?: string;
  notes?: string;
}
export const JOURNAL_STORAGE_KEY = 'legumeami_field_journal_v1';
export function readFieldEvents(fieldId: string): FieldEvent[] {
  try {
    const raw = JSON.parse(localStorage.getItem(JOURNAL_STORAGE_KEY) || '[]') as FieldEvent[];
    return Array.isArray(raw) ? raw.filter((ev) => ev.fieldId === fieldId) : [];
  } catch { return []; }
}
const LABELS: Record<FieldEvent['type'], string> = {
  irrigation: 'Irrigation', fertilizer: 'Engrais / fertilisation', biostimulant: 'Biostimulant / inoculant',
  spraying: 'Traitement', tillage: 'Travail du sol', cover_crop: 'Couverture végétale', crop_rotation: 'Rotation / culture précédente',
};

export const FieldActivityJournal: React.FC<{ field: SelectedField; onClose: () => void; onSaved?: () => void }> = ({ field, onClose, onSaved }) => {
  const [events, setEvents] = useState<FieldEvent[]>(() => readFieldEvents(field.id));
  const [type, setType] = useState<FieldEvent['type']>('irrigation');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('mm');
  const [product, setProduct] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const sorted = useMemo(() => [...events].sort((a, b) => b.date.localeCompare(a.date)), [events]);

  useEffect(() => {
    const closeOnEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const persist = (next: FieldEvent[]) => {
    try {
      const all = JSON.parse(localStorage.getItem(JOURNAL_STORAGE_KEY) || '[]') as FieldEvent[];
      const others = Array.isArray(all) ? all.filter((ev) => ev.fieldId !== field.id) : [];
      localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([...others, ...next]));
      setEvents(next);
      onSaved?.();
      setError('');
    } catch { setError('Impossible de sauvegarder dans ce navigateur.'); }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = quantity.trim() === '' ? undefined : Number(quantity);
    if (!date || (amount !== undefined && (!Number.isFinite(amount) || amount < 0))) {
      setError('Vérifiez la date et la quantité.'); return;
    }
    const ev: FieldEvent = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `ev-${Date.now()}`,
      fieldId: field.id, date, type, quantity: amount, unit: amount !== undefined ? unit.trim() : undefined,
      product: product.trim() || undefined, notes: notes.trim() || undefined,
    };
    persist([...events, ev]); setQuantity(''); setProduct(''); setNotes('');
  };

  return (
    <div className="fixed inset-0 z-[850] bg-black/65 flex items-center justify-center p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="Journal de parcelle" className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[26px] border border-white/15 bg-[#182031] text-white p-4 sm:p-6 space-y-4 shadow-2xl">
        <header className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-emerald-300"/>
          <div className="min-w-0 flex-1"><h2 className="font-semibold">Journal de parcelle</h2><p className="text-[11px] text-white/55 truncate">{field.name} · interventions datées</p></div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-full p-2 hover:bg-white/10"><X className="w-4 h-4"/></button>
        </header>
        <form className="grid grid-cols-2 gap-3" onSubmit={handleSave}>
          <label className="col-span-2 text-xs text-white/70">Intervention<select value={type} onChange={(e) => { const t = e.target.value as FieldEvent['type']; setType(t); setUnit(t === 'irrigation' ? 'mm' : 'kg/ha'); }} className="block mt-1.5 w-full rounded-xl bg-[#202d40] p-2.5 text-white border border-white/15">{Object.entries(LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-xs text-white/70">Date<input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="block mt-1.5 w-full rounded-xl bg-[#202d40] p-2.5 text-white border border-white/15"/></label>
          <label className="text-xs text-white/70">Quantité<input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Facultatif" className="block mt-1.5 w-full rounded-xl bg-[#202d40] p-2.5 text-white border border-white/15"/></label>
          <label className="text-xs text-white/70">Unité<input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="mm, kg/ha, L/ha…" className="block mt-1.5 w-full rounded-xl bg-[#202d40] p-2.5 text-white border border-white/15"/></label>
          <label className="text-xs text-white/70">Produit / culture<input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Ex. : NPK, soja…" className="block mt-1.5 w-full rounded-xl bg-[#202d40] p-2.5 text-white border border-white/15"/></label>
          <label className="col-span-2 text-xs text-white/70">Observation<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes sur l'opération, quantité, état du sol…" className="block mt-1.5 w-full rounded-xl bg-[#202d40] p-2.5 text-white border border-white/15 resize-none"/></label>
          {error && <p role="alert" className="col-span-2 text-xs text-rose-300">{error}</p>}
          <button type="submit" className="col-span-2 flex items-center justify-center gap-2 p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold"><Plus className="w-4 h-4" />Enregistrer l’intervention</button>
        </form>
        <div className="border-t border-white/10 pt-3 space-y-2">
          <h3 className="text-xs font-semibold">Historique ({events.length})</h3>
          {sorted.length === 0 && <p className="text-xs text-white/50">Aucune intervention enregistrée pour cette parcelle.</p>}
          {sorted.map((ev) => <div key={ev.id} className="p-2.5 rounded-xl bg-white/[0.05] flex items-start gap-2">
            <div className="flex-1 min-w-0"><p className="text-xs font-medium">{LABELS[ev.type]} <span className="text-white/40">· {ev.date}</span></p><p className="text-[11px] text-white/55">{[ev.quantity !== undefined ? `${ev.quantity} ${ev.unit || ''}` : '', ev.product, ev.notes].filter(Boolean).join(' · ') || 'Intervention consignée'}</p></div>
            <button type="button" aria-label="Supprimer cette intervention" onClick={() => persist(events.filter((v) => v.id !== ev.id))} className="p-2 rounded-lg hover:bg-white/10 text-white/50"><Trash2 className="w-3.5 h-3.5"/></button>
          </div>)}
        </div>
        <p className="text-[10px] text-white/40">Les interventions sont enregistrées localement dans ce navigateur. Pas encore de synchronisation entre appareils.</p>
      </section>
    </div>
  );
};
