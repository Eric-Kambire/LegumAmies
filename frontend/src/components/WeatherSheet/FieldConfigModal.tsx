import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import type { LegumeCropType, CropGrowthStage, SelectedField } from '../../types/agricultural';
import { CropGlyph } from '../Common/LegumeGlyphs';

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
  const [name, setName] = useState(currentField?.name || 'Parcelle Légumineuse');
  const [cropType, setCropType] = useState<LegumeCropType>(currentField?.cropType || 'pois_chiche');
  const [growthStage, setGrowthStage] = useState<CropGrowthStage>(
    currentField?.growthStage || 'floraison'
  );
  const [areaHectares, setAreaHectares] = useState<number | undefined>(
    currentField?.areaHectares || 12
  );

  if (!isOpen) return null;

  const crops: Array<{ id: LegumeCropType; label: string }> = [
    { id: 'pois_chiche', label: 'Pois chiche' },
    { id: 'lentille', label: 'Lentille verte / blonde' },
    { id: 'feverole', label: 'Féverole' },
    { id: 'pois', label: 'Pois protéagineux' },
    { id: 'soja', label: 'Soja local sans OGM' },
    { id: 'lupin', label: 'Lupin blanc' },
    { id: 'haricot_sec', label: 'Haricot sec' },
  ];

  const stages: Array<{ id: CropGrowthStage; label: string; desc: string }> = [
    { id: 'vegetatif', label: '1. Végétatif', desc: 'Levée et développement foliaire' },
    { id: 'floraison', label: '2. Floraison', desc: 'Sensibilité aux fortes chaleurs (>28°C)' },
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
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="apple-glass rounded-[28px] max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-white max-h-[90vh] overflow-y-auto scrollbar-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.1] pb-3">
          <div>
            <h3 className="font-semibold text-base text-white">Configurer la Parcelle</h3>
            <p className="text-xs text-white/50 mt-0.5">
              {commune ? `${commune} • ` : ''}
              {latitude.toFixed(2)}°N, {longitude.toFixed(2)}°E
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Field Name Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/70">Nom de la parcelle</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Parcelle du Moulin"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.08] border border-white/[0.12] text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>

        {/* Crop Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/70">Légumineuse</label>
          <div className="grid grid-cols-2 gap-2">
            {crops.map((c) => {
              const isSelected = cropType === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCropType(c.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs text-left transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-white/20 border-white/40 text-white font-semibold'
                      : 'bg-white/[0.05] border-white/[0.08] text-white/75 hover:bg-white/[0.1]'
                  }`}
                >
                  <CropGlyph crop={c.id} size={16} />
                  <span className="truncate">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Growth Stage Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/70">Stade phénologique</label>
          <div className="flex flex-col gap-1.5">
            {stages.map((s) => {
              const isSelected = growthStage === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setGrowthStage(s.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs text-left transition-all active:scale-98 ${
                    isSelected
                      ? 'bg-white/20 border-white/40 text-white font-medium'
                      : 'bg-white/[0.05] border-white/[0.08] text-white/75 hover:bg-white/[0.1]'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-white">{s.label}</p>
                    <p className="text-[10px] text-white/50 mt-0.5">{s.desc}</p>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-white flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Surface Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/70">Surface (hectares - optionnel)</label>
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={areaHectares || ''}
            onChange={(e) => setAreaHectares(parseFloat(e.target.value) || undefined)}
            placeholder="Ex : 12"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.08] border border-white/[0.12] text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.1]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-medium text-white/60 hover:text-white transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-full bg-white text-black font-semibold text-xs transition-all active:scale-95 shadow-md"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};
