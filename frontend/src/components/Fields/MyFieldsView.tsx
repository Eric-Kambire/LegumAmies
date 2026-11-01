import React, { useRef, useState } from 'react';
import { Plus, MapPin, Trash2, Edit3, Check, Navigation, ChevronRight } from 'lucide-react';
import type { SelectedField, LegumeCropType, CropGrowthStage } from '../../types/agricultural';
import { BotanicalCard } from './BotanicalCard';
import { LEGUME_CROPS_CATALOG, GROWTH_STAGES_CATALOG } from '../../data/legumeCatalog';
import { FRENCH_AGRI_BASINS } from '../../data/frenchAgriBasins';
import { getCurrentGPSPosition, reverseGeocodeFrance, isWithinMetropolitanFrance } from '../../services/geoService';
import { CropGlyph } from '../Common/LegumeGlyphs';
import { ParcelDrawMap, computeParcelAreaHa, hasSelfIntersection } from './ParcelDrawMap';
import type { ParcelPoint } from './ParcelDrawMap';

const DEMO_FIELD_IDS = new Set(['field_lauragais_1', 'field_beauce_2', 'field_berry_3']);
const isDemoField = (field: SelectedField) => Boolean(field.isDemo) || DEMO_FIELD_IDS.has(field.id);

interface MyFieldsViewProps {
  fields: SelectedField[];
  activeField: SelectedField | null;
  onSelectActiveField: (field: SelectedField) => void;
  onSaveField: (field: SelectedField) => void;
  onDeleteField: (fieldId: string) => void;
}

export const MyFieldsView: React.FC<MyFieldsViewProps> = ({
  fields,
  activeField,
  onSelectActiveField,
  onSaveField,
  onDeleteField,
}) => {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Wizard state
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState(43.3183);
  const [longitude, setLongitude] = useState(1.9538);
  const [commune, setCommune] = useState('Castelnaudary');
  const [departmentCode, setDepartmentCode] = useState('11');
  const [cropType, setCropType] = useState<LegumeCropType>('pois_chiche');
  const [growthStage, setGrowthStage] = useState<CropGrowthStage>('floraison');
  const [areaHectares, setAreaHectares] = useState<number>(14);
  const [soilType, setSoilType] = useState<'calcaire' | 'argilo_calcaire' | 'limon' | 'sableux'>('argilo_calcaire');
  const [isLocating, setIsLocating] = useState(false);
  const [polygonCoordinates, setPolygonCoordinates] = useState<ParcelPoint[]>([]);

  const closeWizard = () => {
    setIsWizardOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const openNewFieldWizard = () => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingFieldId(null);
    setPolygonCoordinates([]);
    setName('Nouvelle Parcelle');
    setLatitude(FRENCH_AGRI_BASINS[0].latitude);
    setLongitude(FRENCH_AGRI_BASINS[0].longitude);
    setCommune(FRENCH_AGRI_BASINS[0].name.split(' ')[0]);
    setDepartmentCode('11');
    setCropType('pois_chiche');
    setGrowthStage('floraison');
    setAreaHectares(15);
    setWizardStep(1);
    setIsWizardOpen(true);
  };

  const openEditField = (field: SelectedField) => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingFieldId(field.id);
    setPolygonCoordinates(field.polygonCoordinates || []);
    setName(field.name);
    setLatitude(field.latitude);
    setLongitude(field.longitude);
    setCommune(field.commune || '');
    setDepartmentCode(field.departmentCode || 'FR');
    setCropType(field.cropType);
    setGrowthStage(field.growthStage);
    setAreaHectares(field.areaHectares || 10);
    setSoilType(field.soilType || 'argilo_calcaire');
    setWizardStep(1);
    setIsWizardOpen(true);
  };

  const handleGpsLocate = async () => {
    setIsLocating(true);
    try {
      const pos = await getCurrentGPSPosition();
      if (isWithinMetropolitanFrance(pos.latitude, pos.longitude)) {
        setLatitude(pos.latitude);
        setLongitude(pos.longitude);
        setPolygonCoordinates([]);
        const geo = await reverseGeocodeFrance(pos.latitude, pos.longitude);
        setCommune(geo.commune);
        if (geo.department) setDepartmentCode(geo.department);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setIsLocating(false);
    }
  };

  const handleSelectBasin = (basinId: string) => {
    const basin = FRENCH_AGRI_BASINS.find((b) => b.id === basinId);
    if (!basin) return;
    setLatitude(basin.latitude);
    setLongitude(basin.longitude);
    setPolygonCoordinates([]);
    setCommune(basin.name.split(' ')[0]);
    setDepartmentCode(basin.department.match(/\(([^)]+)\)/)?.[1] || 'FR');
    setCropType(basin.typicalCrops[0] || 'pois_chiche');
  };

  const handleSave = () => {
    if (polygonCoordinates.length > 0 && (polygonCoordinates.length < 3 || hasSelfIntersection(polygonCoordinates) || computeParcelAreaHa(polygonCoordinates) < 0.005)) return;
    const existingField = fields.find((item) => item.id === editingFieldId);
    const updated: SelectedField = {
      id: editingFieldId || `field_${Date.now()}`,
      name: name.trim() || 'Parcelle Légumineuse',
      latitude,
      longitude,
      commune,
      departmentCode,
      cropType,
      growthStage,
      areaHectares,
      soilType,
      polygonCoordinates: polygonCoordinates.length >= 3 ? polygonCoordinates : undefined,
      ...(existingField?.isDemo ? { isDemo: existingField.isDemo } : {}),
      ...(existingField?.sowingDate ? { sowingDate: existingField.sowingDate } : {}),
      createdAt: existingField?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveField(updated);
    closeWizard();
  };

  const cropKeys = Object.keys(LEGUME_CROPS_CATALOG) as LegumeCropType[];
  const stageKeys = Object.keys(GROWTH_STAGES_CATALOG) as CropGrowthStage[];
  const polygonInvalid = polygonCoordinates.length > 0 && (polygonCoordinates.length < 3 || hasSelfIntersection(polygonCoordinates) || computeParcelAreaHa(polygonCoordinates) < 0.005);

  return (
    <div className="app-page-scroll flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pt-6 max-w-6xl mx-auto w-full flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/legumeAmi.png"
            alt="Légume'Ami Logo"
            className="w-10 h-10 object-contain drop-shadow-md flex-shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">Mes parcelles</h1>
            <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
              Gérez vos assolements et suivez chaque stade phénologique
            </p>
          </div>
        </div>

        <button
          onClick={openNewFieldWizard}
          className="apple-glass px-4 py-2 rounded-full text-xs font-semibold text-white flex items-center gap-1.5 shadow-md active:scale-95 transition-transform flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouvelle parcelle</span>
        </button>
      </div>

      {fields.some(isDemoField) && (
        <section className="apple-card p-3.5 flex items-center justify-between gap-3 border-amber-500/25">
          <div><p className="text-xs font-semibold text-amber-200">Parcelles d’exemple</p><p className="text-[11px] text-white/60 mt-0.5">Les cartes marquées « Démo » ne sont pas vos parcelles.</p></div>
          <button onClick={openNewFieldWizard} className="text-xs text-[#38bdf8] font-semibold hover:underline whitespace-nowrap">Créer la mienne</button>
        </section>
      )}

      {/* Field List Responsive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {fields.map((f) => {
          const isSelected = activeField?.id === f.id;
          const crop = LEGUME_CROPS_CATALOG[f.cropType];
          const stage = GROWTH_STAGES_CATALOG[f.growthStage];

          return (
            <div
              key={f.id}
              className={`apple-card p-4 flex flex-col justify-between gap-3 transition-all ${
                isSelected ? 'border-white/30 bg-white/[0.12] shadow-xl' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 border shadow-xs"
                    style={{
                      backgroundColor: crop?.accent.bg || 'rgba(255,255,255,0.08)',
                      color: crop?.accent.text || '#fff',
                      borderColor: crop?.accent.border || 'rgba(255,255,255,0.15)',
                    }}
                  >
                    <CropGlyph crop={f.cropType} size={22} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">{f.name}</h3>
                      {isDemoField(f) && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 text-[10px] font-semibold border border-amber-500/30">
                          Démo
                        </span>
                      )}
                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full bg-[#007aff]/20 text-[#38bdf8] text-[10px] font-semibold border border-[#007aff]/30">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/50 mt-0.5">
                      {f.commune || 'France'} {f.departmentCode ? `(${f.departmentCode})` : ''} • {f.areaHectares ? `${f.areaHectares} ha` : 'Surface non renseignée'} {f.polygonCoordinates?.length ? ' • Contour enregistré' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditField(f)}
                    className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                    title="Modifier la parcelle"
                    aria-label={`Modifier ${f.name}`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {fields.length > 1 && (
                    <button
                      onClick={() => onDeleteField(f.id)}
                      className="p-2 rounded-full hover:bg-rose-500/20 text-white/40 hover:text-rose-300 transition-colors"
                      title="Supprimer la parcelle"
                      aria-label={`Supprimer ${f.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Crop & Stage info pill */}
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-between text-xs">
                <span className="text-white/80 font-medium">
                  {crop?.labelFr} • <span className="text-white/50">{stage?.labelFr}</span>
                </span>

                {!isSelected && (
                  <button
                    onClick={() => onSelectActiveField(f)}
                    className="text-[11px] text-[#38bdf8] hover:underline font-medium"
                  >
                    Sélectionner
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progressive Creation Wizard Modal */}
      {isWizardOpen && (
        <div
          className="fixed inset-0 z-[900] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="field-wizard-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              closeWizard();
            }
            if (event.key === 'Tab') {
              const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])'));
              const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
              const nextIndex = event.shiftKey ? currentIndex - 1 : currentIndex + 1;
              if (nextIndex < 0 || nextIndex >= focusable.length) {
                event.preventDefault();
                focusable[event.shiftKey ? focusable.length - 1 : 0]?.focus();
              }
            }
          }}
        >
          <div className="apple-glass rounded-[28px] max-w-lg w-full px-6 pt-6 pb-0 shadow-2xl flex flex-col gap-4 text-white max-h-[90dvh] overflow-y-auto scrollbar-none">
            {/* Wizard Step Indicator */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Étape {wizardStep} sur 4
                </span>
                <h3 id="field-wizard-title" className="text-base font-semibold text-white">
                  {wizardStep === 1 && "1. Nom & Localisation"}
                  {wizardStep === 2 && "2. Choix de la Légumineuse"}
                  {wizardStep === 3 && "3. Stade Phénologique"}
                  {wizardStep === 4 && "4. Données Culturales"}
                </h3>
              </div>

              <div className="flex items-center gap-1">
                {[1, 2, 3, 4].map((step) => (
                  <span
                    key={step}
                    className={`w-2 h-2 rounded-full transition-all ${
                      wizardStep === step ? 'bg-white w-5' : wizardStep > step ? 'bg-white/60' : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* STEP 1: Name & Location */}
            {wizardStep === 1 && (
              <div className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-white/70">Nom de la parcelle</label>
                  <input
                    type="text"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex : Champ du Moulin, Parcelle Sud"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.08] border border-white/[0.12] text-sm text-white placeholder-white/30 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="text-xs font-medium text-white/70">Localisation géographique</label>
                  <button
                    onClick={handleGpsLocate}
                    disabled={isLocating}
                    className="apple-glass px-3 py-1 rounded-full text-xs text-[#38bdf8] flex items-center gap-1 active:scale-95"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>{isLocating ? 'Détection...' : 'Position GPS actuelle'}</span>
                  </button>
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-white/50" />
                    <span className="font-medium text-white">{commune} ({departmentCode})</span>
                  </div>
                  <span className="font-mono text-[10px] text-white/40">
                    {latitude.toFixed(2)}°N, {longitude.toFixed(2)}°E
                  </span>
                </div>

                <ParcelDrawMap
                  latitude={latitude}
                  longitude={longitude}
                  vertices={polygonCoordinates}
                  onVerticesChange={(points) => {
                    setPolygonCoordinates(points);
                    if (points.length >= 3 && !hasSelfIntersection(points)) {
                      const measuredArea = computeParcelAreaHa(points);
                      if (measuredArea >= 0.005) setAreaHectares(Number(measuredArea.toFixed(2)));
                    }
                  }}
                  onPointChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }}
                />
                {polygonInvalid && <p className="text-[11px] text-amber-300">Terminez un contour valide (au moins 3 points) ou effacez-le pour utiliser un point GPS.</p>}

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] text-white/50">Ou choisir parmi les bassins de référence :</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {FRENCH_AGRI_BASINS.slice(0, 4).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleSelectBasin(b.id)}
                        className="p-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-[11px] text-left hover:bg-white/[0.1] transition-colors"
                      >
                        <p className="font-semibold text-white truncate">{b.name.split(' ')[0]}</p>
                        <p className="text-[10px] text-white/40">{b.department}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Crop Selection */}
            {wizardStep === 2 && (
              <div className="flex flex-col gap-2.5">
                <p className="text-xs text-white/60">
                  Sélectionnez l'espèce cultivée sur cette parcelle :
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto scrollbar-none pr-1">
                  {cropKeys.map((k) => (
                    <BotanicalCard
                      key={k}
                      cropType={k}
                      isSelected={cropType === k}
                      onClick={() => setCropType(k)}
                      variant="crop"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3: Growth Stage */}
            {wizardStep === 3 && (
              <div className="flex flex-col gap-2.5">
                <p className="text-xs text-white/60">
                  À quel stade phénologique se trouve la culture actuellement ?
                </p>
                <div className="grid grid-cols-1 gap-2 max-h-[50vh] overflow-y-auto scrollbar-none pr-1">
                  {stageKeys.map((s) => (
                    <BotanicalCard
                      key={s}
                      growthStage={s}
                      isSelected={growthStage === s}
                      onClick={() => setGrowthStage(s)}
                      variant="stage"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4: Agronomic Constraints */}
            {wizardStep === 4 && (
              <div className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-white/70">Surface de la parcelle (hectares)</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={areaHectares}
                    onChange={(e) => setAreaHectares(parseInt(e.target.value, 10) || 10)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.08] border border-white/[0.12] text-sm text-white focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-white/70">Type de sol dominant</label>
                  <select
                    value={soilType}
                    onChange={(e) => setSoilType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.08] border border-white/[0.12] text-xs text-white focus:outline-none"
                  >
                    <option value="argilo_calcaire" className="bg-slate-900">Argilo-calcaire (typique Sud-Ouest / Lauragais)</option>
                    <option value="calcaire" className="bg-slate-900">Calcaire crayeux (Beauce, Champagne)</option>
                    <option value="limon" className="bg-slate-900">Limon profond (Plaine de l'Ouest)</option>
                    <option value="sableux" className="bg-slate-900">Sableux / Terres légères</option>
                  </select>
                </div>

                {/* Recap card */}
                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-xs flex flex-col gap-1 mt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Récapitulatif</span>
                  <p className="font-semibold text-white">{name || 'Parcelle'} • {LEGUME_CROPS_CATALOG[cropType]?.labelFr}</p>
                  <p className="text-white/60">{commune} ({departmentCode}) • {areaHectares} ha • {GROWTH_STAGES_CATALOG[growthStage]?.labelFr}</p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            {/* Sticky footer: stays pinned to the bottom of the (scrollable) card so
                the Enregistrer / Continuer button is always visible and tappable on
                mobile, above the safe-area / browser chrome. */}
            <div className="sticky bottom-0 -mx-6 px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] mt-1 flex items-center justify-between border-t border-white/[0.08] bg-[#0f1623]/85 backdrop-blur-md">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((prev) => (prev - 1) as any)}
                  className="px-4 py-2 rounded-full text-xs font-medium text-white/60 hover:text-white"
                >
                  Précédent
                </button>
              ) : (
                <button
                  type="button"
                  onClick={closeWizard}
                  className="px-4 py-2 rounded-full text-xs font-medium text-white/40 hover:text-white"
                >
                  Annuler
                </button>
              )}

              {wizardStep < 4 ? (
                <button
                  type="button"
                  disabled={wizardStep === 1 && polygonInvalid}
                  onClick={() => setWizardStep((prev) => (prev + 1) as any)}
                  className="px-5 py-2.5 rounded-full bg-white text-black font-semibold text-xs transition-all active:scale-95 shadow-md flex items-center gap-1"
                >
                  <span>Continuer</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={polygonInvalid}
                  className="px-6 py-2.5 rounded-full bg-white text-black font-semibold text-xs transition-all active:scale-95 shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Enregistrer la parcelle</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
