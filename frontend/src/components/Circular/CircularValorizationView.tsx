import React, { useState } from 'react';
import { Check, Building2, Mail, Sparkles } from 'lucide-react';
import type { LegumeCropType } from '../../types/agricultural';
import { getCropNameFr } from '../../services/agriRiskService';

interface UpcyclingChannel {
  id: string;
  title: string;
  category: string;
  pricePerTonne: number;
  description: string;
  compatibleDefects: string[];
}

export const CircularValorizationView: React.FC = () => {
  const [cropType, setCropType] = useState<LegumeCropType>('lentille');
  const [defectType, setDefectType] = useState<string>('brisure');
  const [quantityTonnes, setQuantityTonnes] = useState<number>(8);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [selectedBuyer, setSelectedBuyer] = useState<string | null>(null);

  const animalFeedPricePerTonne = 180;

  // Valorization channels for food industry
  const channels: UpcyclingChannel[] = [
    {
      id: 'meunerie',
      title: 'Meunerie & Farines Hyperprotéinées',
      category: 'Biscuiterie & Pâtes Françaises',
      pricePerTonne: 640,
      description: 'Le grain est directement moulu. Les brisures et calibres hétérogènes conservent 100% de leur valeur technique et amidon.',
      compatibleDefects: ['brisure', 'hors_calibre'],
    },
    {
      id: 'extrusion',
      title: 'Extrusion & Texturation (Alt-Meat)',
      category: 'Steaks & Hachés Végétaux',
      pricePerTonne: 720,
      description: 'Transformation thermomécanique pour créer des fibres de viande végétale. Seul le taux de protéines compte, l\'aspect visuel est neutre.',
      compatibleDefects: ['brisure', 'hors_calibre', 'decoloration'],
    },
    {
      id: 'puree',
      title: 'Purées & Cuisson Vapeur IQF',
      category: 'Restauration Collective (EGAlim)',
      pricePerTonne: 520,
      description: 'Légumineuses précuites ou réduites en purée pour les cantines et hôpitaux. Calibre libre.',
      compatibleDefects: ['hors_calibre', 'decoloration'],
    },
  ];

  const activeChannel = channels.find((c) => c.compatibleDefects.includes(defectType)) || channels[0];
  const upcycledPricePerTonne = activeChannel.pricePerTonne;

  const totalAnimalIncome = animalFeedPricePerTonne * quantityTonnes;
  const totalUpcycledIncome = upcycledPricePerTonne * quantityTonnes;
  const netGainEur = totalUpcycledIncome - totalAnimalIncome;
  const gainPercent = Math.round((netGainEur / totalAnimalIncome) * 100);

  // Sample french buyers
  const buyers = [
    {
      id: 'buyer_1',
      name: 'Moulin Éco-Protéines Occitanie',
      location: 'Castelnaudary (11)',
      distanceKm: 34,
      targetVolume: 'Lots de 5 à 25 t',
      needs: 'Brisures de lentilles & pois chiches pour farines sans gluten',
    },
    {
      id: 'buyer_2',
      name: 'Atelier Végétal France',
      location: 'Châteauroux (36)',
      distanceKm: 120,
      targetVolume: 'Lots de 10 à 50 t',
      needs: 'Protéines végétales texturées pour steaks de légumineuses',
    },
    {
      id: 'buyer_3',
      name: 'Purées Bio & Terroirs',
      location: 'Agen (47)',
      distanceKm: 145,
      targetVolume: 'Lots de 5 à 20 t',
      needs: 'Pois et féveroles calibres non conformes pour cuisine centrale',
    },
  ];

  const handleCopyEmail = (buyerName: string) => {
    const text = `Bonjour,

Je dispose d'un lot de ${quantityTonnes} tonnes de ${getCropNameFr(cropType)} (${defectType === 'brisure' ? 'brisures propres au battage' : 'hors calibre'}) issu de ma récolte en région.
Le profil protéique et nutritionnel est 100% conforme pour valorisation en meunerie ou transformation végétale.

Disponibilité immédiate. Pouvons-nous convenir d'un échange ?

Bien cordialement,
[Nom de l'exploitation agricole]`;

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setSelectedBuyer(buyerName);
    setTimeout(() => {
      setIsCopied(false);
      setSelectedBuyer(null);
    }, 2500);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-6 pb-28 max-w-2xl mx-auto w-full select-none flex flex-col gap-4">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Bourse des Écarts de Tri</h1>
        <p className="text-xs text-white/50 mt-0.5">
          Revalorisation des lots déclassés pour l'industrie des protéines alternatives
        </p>
      </div>

      {/* Input Batch Card */}
      <div className="apple-card p-4 flex flex-col gap-3.5">
        <p className="text-xs text-white/50 font-semibold uppercase tracking-wider pb-2 border-b border-white/[0.08]">
          Caractériser le lot déclassé
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Crop Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-white/60 font-medium">Légumineuse</label>
            <select
              value={cropType}
              onChange={(e) => setCropType(e.target.value as LegumeCropType)}
              className="px-3 py-2 rounded-xl bg-white/[0.08] border border-white/[0.12] text-xs text-white focus:outline-none"
            >
              <option value="lentille" className="bg-slate-900">Lentille verte</option>
              <option value="pois_chiche" className="bg-slate-900">Pois chiche</option>
              <option value="pois" className="bg-slate-900">Pois protéagineux</option>
              <option value="feverole" className="bg-slate-900">Féverole</option>
              <option value="soja" className="bg-slate-900">Soja français</option>
            </select>
          </div>

          {/* Defect Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-white/60 font-medium">Type d'écart de tri</label>
            <select
              value={defectType}
              onChange={(e) => setDefectType(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white/[0.08] border border-white/[0.12] text-xs text-white focus:outline-none"
            >
              <option value="brisure" className="bg-slate-900">Grains cassés / Brisures</option>
              <option value="hors_calibre" className="bg-slate-900">Calibre hétérogène</option>
              <option value="decoloration" className="bg-slate-900">Légère décoloration</option>
            </select>
          </div>

          {/* Quantity */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-white/60 font-medium">Volume (tonnes)</label>
            <input
              type="number"
              min="1"
              max="200"
              value={quantityTonnes}
              onChange={(e) => setQuantityTonnes(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="px-3 py-2 rounded-xl bg-white/[0.08] border border-white/[0.12] text-xs text-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Value Recovery Simulation Card (Apple HIG Hero) */}
      <div className="apple-card p-5 flex flex-col gap-3 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50 font-semibold uppercase tracking-wider">
            Gain économique net récupéré
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-[#22c55e]/20 text-[#34d399] border border-[#22c55e]/30 text-xs font-semibold">
            +{gainPercent}% de valeur
          </span>
        </div>

        <div className="flex items-baseline gap-2 my-1">
          <span className="text-5xl font-thin tracking-tighter text-white">
            +{netGainEur.toLocaleString('fr-FR')}
          </span>
          <span className="text-2xl font-light text-white/50">€</span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.08] text-xs">
          <div>
            <span className="text-white/40 block">Alimentation animale (décote)</span>
            <span className="font-semibold text-white/70 text-sm mt-0.5 block line-through">
              {totalAnimalIncome.toLocaleString('fr-FR')} € ({animalFeedPricePerTonne} €/t)
            </span>
          </div>

          <div>
            <span className="text-[#34d399] block font-medium">Débouché FoodTech Protéines</span>
            <span className="font-semibold text-white text-sm mt-0.5 block">
              {totalUpcycledIncome.toLocaleString('fr-FR')} € ({upcycledPricePerTonne} €/t)
            </span>
          </div>
        </div>
      </div>

      {/* Recommended Upcycling Channel */}
      <div className="apple-card p-4">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/[0.08]">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span className="text-xs text-white/50 font-semibold uppercase tracking-wider">
            Meilleur débouché industriel recommandé
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">{activeChannel.title}</h3>
            <span className="text-xs font-semibold text-[#34d399]">{activeChannel.pricePerTonne} € / t</span>
          </div>
          <p className="text-[11px] text-white/60 leading-relaxed">{activeChannel.description}</p>
        </div>
      </div>

      {/* Matched French Buyers */}
      <div className="apple-card p-4">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.08]">
          <div className="flex items-center gap-1.5 text-xs text-white/50 font-semibold uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5" />
            <span>Transformateurs régionaux en recherche de matière</span>
          </div>
        </div>

        <div className="flex flex-col divide-y divide-white/[0.06]">
          {buyers.map((buyer) => (
            <div key={buyer.id} className="py-3 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">{buyer.name}</h4>
                  <p className="text-[11px] text-white/50">{buyer.location} • ~{buyer.distanceKm} km</p>
                </div>

                <button
                  onClick={() => handleCopyEmail(buyer.name)}
                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition-all active:scale-95 flex items-center gap-1"
                >
                  {isCopied && selectedBuyer === buyer.name ? (
                    <>
                      <Check className="w-3 h-3 text-[#22c55e]" />
                      <span>Email copié !</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-3 h-3 text-white/70" />
                      <span>Contacter</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-white/70 bg-white/[0.04] p-2 rounded-xl">
                {buyer.needs} ({buyer.targetVolume})
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
