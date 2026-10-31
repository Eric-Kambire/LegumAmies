import React, { useState } from 'react';
import { X, Check, Sprout, Sparkles } from 'lucide-react';
import type { LegumeCropType, CropGrowthStage, SelectedField } from '../../types/agricultural';

interface FieldConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentField: SelectedField | null;
  latitude: number;
  longitude: number;
  commune?: string;
  onSaveField: (field: SelectedField) => void;
}

export const FieldConfigModal: React.FC<FieldConfigModalProps> = ({
  isOpen,
  onClose,
  currentField,
  latitude,
  longitude,
  commune,
  onSaveField,
}) => {
  const [name, setName] = useState(currentField?.name || 'Ma Parcelle Légumineuse');
  const [cropType, setCropType] = useState<LegumeCropType>(currentField?.cropType || 'pois_chiche');
  const [growthStage, setGrowthStage] = useState<CropGrowthStage>(
    currentField?.growthStage || 'floraison'
  );
  const [areaHectares, setAreaHectares] = useState<number | undefined>(
    currentField?.areaHectares || 12
  );

  if (!isOpen) return null;

  const crops: Array<{ id: LegumeCropType; label: string; icon: string }> = [
    { id: 'pois_chiche', label: 'Pois chiche', icon: '🟡' },
    { id: 'lentille', label: 'Lentille verte / blonde', icon: '🟢' },
    { id: 'feverole', label: 'Féverole', icon: '🟤' },
    { id: 'pois', label: 'Pois protéagineux', icon: '🟢' },
    { id: 'soja', label: 'Soja local sans OGM', icon: '🌱' },
    { id: 'lupin', label: 'Lupin blanc', icon: '🌾' },
    { id: 'haricot_sec', label: 'Haricot sec (lingot/coco)', icon: '⚪' },
  ];

  const stages: Array<{ id: CropGrowthStage; label: string; desc: string }> = [
    { id: 'vegetatif', label: '1. Végétatif', desc: 'Levée et développement foliaire' },
    { id: 'floraison', label: '2. Floraison', desc: 'Stade critique face aux chaleurs (>28°C)' },
    { id: 'formation_gousses', label: '3. Formation des gousses', desc: 'Sensibilité au stress hydrique' },
    { id: 'remplissage_grain', label: '4. Remplissage du grain', desc: 'Accumulation des protéines' },
    { id: 'pret_recolter', label: '5. Prêt à récolter', desc: 'Surveillance humidité et égrenage' },
  ];

  const handleSave = () => {
    const updatedField: SelectedField = {
      id: currentField?.id || `field_${Date.now()}`,
      name: name.trim() || 'Parcelle Légumineuse',
      latitude,
      longitude,
      commune: commune || currentField?.commune,
      cropType,
      growthStage,
      areaHectares,
      createdAt: currentField?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveField(updatedField);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 shadow-2xl flex flex-col gap-4 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Sprout className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Configurer la Parcelle</h3>
              <p className="text-[11px] text-slate-400">
                {commune ? `${commune} • ` : ''}
                {latitude.toFixed(3)}°N, {longitude.toFixed(3)}°E
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

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">Nom de la parcelle</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Parcelle du Moulin, Champ Nord"
            className="w-full px-3.5 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">Légumineuse cultivée</label>
          <div className="grid grid-cols-2 gap-2">
            {crops.map((c) => {
              const isSelected = cropType === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCropType(c.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs text-left transition-all ${
                    isSelected
                      ? 'bg-emerald-600/15 border-emerald-500 text-emerald-300 font-semibold shadow-sm'
                      : 'bg-slate-800/40 border-slate-700/40 text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <span className="text-base">{c.icon}</span>
                  <span className="truncate">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">Stade phénologique actuel</label>
          <div className="flex flex-col gap-1.5">
            {stages.map((s) => {
              const isSelected = growthStage === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setGrowthStage(s.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs text-left transition-all ${
                    isSelected
                      ? 'bg-emerald-600/15 border-emerald-500 text-emerald-300 font-medium'
                      : 'bg-slate-800/40 border-slate-700/40 text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <div>
                    <p className="font-semibold">{s.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.desc}</p>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">Surface (hectares - optionnel)</label>
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={areaHectares || ''}
            onChange={(e) => setAreaHectares(parseFloat(e.target.value) || undefined)}
            placeholder="Ex : 15"
            className="w-full px-3.5 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-950 transition-all active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Enregistrer la parcelle</span>
          </button>
        </div>
      </div>
    </div>
  );
};
