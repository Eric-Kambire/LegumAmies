import React from 'react';
import { Crosshair, Loader2, MapPin, Navigation, Sprout } from 'lucide-react';
import type { AmiChat } from '../../hooks/useAmiChat';
import type { SelectedField } from '../../types/agricultural';
import { getCropNameFr, getGrowthStageFr } from '../../services/agriRiskService';
import { isDemoField } from '../../services/provenance';

interface AmiContextSelectorProps {
  ami: AmiChat;
  fields: SelectedField[];
  activeField: SelectedField | null;
  onSelectField: (field: SelectedField) => void;
}

const fmt = (v: number) => v.toFixed(3);

/** Chooses what Ami reasons about: the selected farm field, or the user's actual position. */
export const AmiContextSelector: React.FC<AmiContextSelectorProps> = ({
  ami,
  fields,
  activeField,
  onSelectField,
}) => {
  const { mode, position, geoStatus, geoMessage } = ami;

  return (
    <div className="px-4 pb-3 border-b border-white/[0.08]" data-testid="ami-context">
      <div role="radiogroup" aria-label="Contexte de la question" className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-black/30">
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'field'}
          onClick={() => ami.setMode('field')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-[10px] text-xs font-medium transition-colors ${
            mode === 'field' ? 'bg-white text-black' : 'text-white/65 hover:text-white'
          }`}
        >
          <Sprout className="w-3.5 h-3.5" aria-hidden="true" /> Ma parcelle
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'position'}
          onClick={() => ami.setMode('position')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-[10px] text-xs font-medium transition-colors ${
            mode === 'position' ? 'bg-white text-black' : 'text-white/65 hover:text-white'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" aria-hidden="true" /> Près de moi
        </button>
      </div>

      {mode === 'field' ? (
        <div className="mt-2.5 flex flex-col gap-1.5">
          <label className="sr-only" htmlFor="ami-field-select">
            Parcelle de référence
          </label>
          <select
            id="ami-field-select"
            value={activeField?.id ?? ''}
            onChange={(e) => {
              const next = fields.find((f) => f.id === e.target.value);
              if (next) onSelectField(next);
            }}
            className="w-full rounded-xl bg-white/[0.08] border border-white/[0.12] px-3 py-2 text-xs text-white focus:outline-none"
          >
            {fields.map((f) => (
              <option key={f.id} value={f.id} className="bg-slate-900">
                {f.name}
                {isDemoField(f) ? ' (démo)' : ''}
              </option>
            ))}
          </select>
          {activeField && (
            <p className="text-[11px] text-white/55 leading-relaxed">
              {getCropNameFr(activeField.cropType)} · {getGrowthStageFr(activeField.growthStage)} · {fmt(activeField.latitude)}°N,{' '}
              {fmt(activeField.longitude)}°E
            </p>
          )}
        </div>
      ) : (
        <div className="mt-2.5 flex flex-col gap-2">
          {position ? (
            <p className="text-[11px] text-white/70 leading-relaxed flex items-start gap-1.5" data-testid="ami-position-info">
              <MapPin className="w-3.5 h-3.5 mt-0.5 text-[#38bdf8] flex-shrink-0" aria-hidden="true" />
              <span>
                {position.source === 'gps' ? 'Position GPS' : 'Point choisi sur la carte'} · {fmt(position.latitude)}°N,{' '}
                {fmt(position.longitude)}°E
                {position.accuracy ? ` · précision ±${Math.round(position.accuracy)} m` : ''}.
                <span className="block text-white/45">
                  Ami n'a pas de culture ni de stade pour ce point : il décrit seulement la météo locale.
                </span>
              </span>
            </p>
          ) : (
            <p className="text-[11px] text-white/60 leading-relaxed">
              Ami a besoin de votre position. Elle n'est lue qu'après votre accord et reste sur cet appareil jusqu'à l'envoi d'une
              question.
            </p>
          )}

          {geoMessage && (geoStatus === 'denied' || geoStatus === 'error' || geoStatus === 'outside') && (
            <p role="alert" className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-1.5">
              {geoMessage}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void ami.locate()}
              disabled={geoStatus === 'locating'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black text-xs font-semibold disabled:opacity-60 active:scale-95"
            >
              {geoStatus === 'locating' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {position?.source === 'gps' ? 'Actualiser ma position' : 'Utiliser ma position'}
            </button>
            <button
              type="button"
              onClick={ami.requestMapPick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white text-xs font-medium hover:bg-white/15 active:scale-95"
            >
              <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> Choisir sur la carte
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
