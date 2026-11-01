import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Info, Loader2, X } from 'lucide-react';
import type { WeatherLayerType, RadarFrame, LocationWeatherData } from '../../types/weather';
import {
  OVERLAY_DEFS,
  OVERLAY_ORDER,
  PRIMARY_LAYERS,
  TEMPERATURE_SCALE,
  type LayerStatus,
  type OverlayId,
  type OverlayState,
} from '../../data/mapLayers';

interface MapLayerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  returnFocusRef: React.RefObject<HTMLElement | null>;
  activeLayer: WeatherLayerType;
  onLayerChange: (layer: WeatherLayerType) => void;
  overlays: Record<OverlayId, OverlayState>;
  overlayStatus: Record<OverlayId, LayerStatus>;
  onOverlayChange: (id: OverlayId, patch: Partial<OverlayState>) => void;
  zoom: number;
  radarFrame: RadarFrame | null;
  weather: LocationWeatherData | null;
  fieldHasPolygon: boolean;
  /** Phones keep the map clear: view actions live in this menu instead of floating buttons. */
  onResetFranceView: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

const fmtTime = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function validityText(layer: WeatherLayerType, radarFrame: RadarFrame | null, weather: LocationWeatherData | null): string {
  if (layer === 'radar') {
    if (!radarFrame) return 'Image radar indisponible pour le moment.';
    const t = fmtTime(new Date(radarFrame.time * 1000));
    return radarFrame.type === 'past' ? `Observé à ${t}` : `Extrapolation radar pour ${t} (pas une prévision numérique)`;
  }
  if (!weather) return 'Prévision indisponible.';
  const t = new Date(weather.current.time);
  const when = Number.isNaN(t.getTime())
    ? weather.current.time
    : t.toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return `Valeur pour ${when} (heure locale), prévue au point sélectionné`;
}

const GradientBar: React.FC<{ stops: string; left: string; right: string; label: string }> = ({ stops, left, right, label }) => (
  <div className="flex items-center gap-2 text-[10px] text-white/60" role="img" aria-label={label}>
    <span>{left}</span>
    <span className="h-1.5 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, ${stops})` }} />
    <span>{right}</span>
  </div>
);

function PrimaryLegend({ layer }: { layer: WeatherLayerType }) {
  switch (layer) {
    case 'radar':
      return (
        <GradientBar
          stops="#38bdf8, #22c55e, #eab308, #ef4444"
          left="Faible"
          right="Forte"
          label="Légende radar : intensité des précipitations, de faible à forte"
        />
      );
    case 'temperature':
      return (
        <GradientBar
          stops={TEMPERATURE_SCALE.map((s) => s.color).join(', ')}
          left="−10 °C"
          right="38 °C et +"
          label="Couleur de la pastille de température, de −10 à 38 degrés"
        />
      );
    case 'wind':
      return (
        <GradientBar
          stops="#34d399, #facc15, #f97316, #ef4444"
          left="0 km/h"
          right="50 km/h et +"
          label="Couleur de la pastille de vent, de 0 à 50 kilomètres par heure"
        />
      );
    default:
      return (
        <GradientBar
          stops="rgb(110,118,138), rgb(230,238,255)"
          left="Dégagé"
          right="Couvert"
          label="Couleur de la pastille de nuages, de dégagé à couvert"
        />
      );
  }
}

const STATUS_TEXT: Record<LayerStatus, string> = {
  idle: '',
  loading: 'Chargement…',
  ready: 'Affichée',
  error: 'Service indisponible',
  unavailable: 'Non disponible',
};

export const MapLayerMenu: React.FC<MapLayerMenuProps> = ({
  isOpen,
  onClose,
  returnFocusRef,
  activeLayer,
  onLayerChange,
  overlays,
  overlayStatus,
  onOverlayChange,
  zoom,
  radarFrame,
  weather,
  fieldHasPolygon,
  onResetFranceView,
  isDarkMode,
  onToggleTheme,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => closeRef.current?.focus(), 30);
    const target = returnFocusRef.current;
    return () => {
      window.clearTimeout(t);
      target?.focus();
    };
  }, [isOpen, returnFocusRef]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const primary = PRIMARY_LAYERS.find((l) => l.id === activeLayer) ?? PRIMARY_LAYERS[0];

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Couches de la carte"
      data-testid="layer-menu"
      className="absolute z-[560] top-3 right-3 w-[min(22rem,calc(100%-1.5rem))] max-h-[calc(100%-1.5rem-var(--bottom-stack))] overflow-y-auto apple-glass rounded-[24px] text-white animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 pt-3 pb-2 bg-[#121826]/90 backdrop-blur-xl">
        <h2 className="text-sm font-semibold">Couches</h2>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Fermer le menu des couches"
          data-testid="layers-close"
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Primary weather visualization: exactly one */}
      <section className="px-4 pb-3" aria-labelledby="layers-weather">
        <h3 id="layers-weather" className="text-[10px] font-semibold uppercase tracking-wider text-white/45 mb-1.5">
          Météo (une seule à la fois)
        </h3>
        <div role="radiogroup" aria-label="Visualisation météo" className="flex flex-col gap-1">
          {PRIMARY_LAYERS.map((l) => {
            const selected = l.id === activeLayer;
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onLayerChange(l.id)}
                data-testid={`primary-${l.id}`}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                  selected ? 'bg-white text-black font-semibold' : 'bg-white/[0.05] text-white/80 hover:bg-white/10'
                }`}
              >
                <span>{l.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selected ? 'bg-black/10' : 'bg-white/10 text-white/55'}`}>
                  {l.spatial ? 'carte' : 'au point'}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 rounded-xl bg-black/25 p-2.5 flex flex-col gap-1.5 text-[11px] text-white/65 leading-relaxed" data-testid="primary-details">
          <PrimaryLegend layer={activeLayer} />
          <p>{validityText(activeLayer, radarFrame, weather)}</p>
          <p className="flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0 text-white/40" aria-hidden="true" />
            <span>
              {primary.note} <span className="text-white/40">Source : {primary.source}.</span>
            </span>
          </p>
        </div>
      </section>

      <section className="px-4 pb-3 md:hidden" aria-labelledby="layers-view" data-testid="layers-view-actions">
        <h3 id="layers-view" className="text-[10px] font-semibold uppercase tracking-wider text-white/45 mb-1.5">
          Vue
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onResetFranceView} className="px-3 py-2 rounded-xl bg-white/[0.07] hover:bg-white/10 text-xs font-medium">
            Vue France
          </button>
          <button type="button" onClick={onToggleTheme} className="px-3 py-2 rounded-xl bg-white/[0.07] hover:bg-white/10 text-xs font-medium">
            {isDarkMode ? 'Fond clair' : 'Fond sombre'}
          </button>
        </div>
      </section>

      {/* Independent geographic overlays */}
      <section className="px-4 pb-4" aria-labelledby="layers-geo">
        <h3 id="layers-geo" className="text-[10px] font-semibold uppercase tracking-wider text-white/45 mb-1.5">
          Couches géographiques
        </h3>
        <ul className="flex flex-col gap-1.5">
          {OVERLAY_ORDER.map((id) => {
            const def = OVERLAY_DEFS[id];
            const state = overlays[id];
            const status = overlayStatus[id];
            const outOfZoom = id !== 'field' && zoom < def.minZoom;
            const noPolygon = id === 'field' && !fieldHasPolygon;
            return (
              <li key={id} className="rounded-xl bg-white/[0.05] px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{def.label}</p>
                    <p className="text-[10px] text-white/50 truncate">{def.description}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={state.enabled}
                    aria-label={`Afficher : ${def.label}`}
                    onClick={() => onOverlayChange(id, { enabled: !state.enabled })}
                    data-testid={`overlay-${id}`}
                    className={`w-11 h-6 rounded-full relative p-0.5 flex-shrink-0 transition-colors ${state.enabled ? 'bg-[#34c759]' : 'bg-white/20'}`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${state.enabled ? 'translate-x-5' : ''}`}
                    />
                  </button>
                </div>

                {state.enabled && (
                  <div className="mt-2 flex flex-col gap-1.5 text-[10px] text-white/60" data-testid={`overlay-${id}-details`}>
                    {id !== 'field' && (
                      <label className="flex items-center gap-2">
                        <span className="w-14 flex-shrink-0">Opacité</span>
                        <input
                          type="range"
                          min={0.2}
                          max={1}
                          step={0.05}
                          value={state.opacity}
                          onChange={(e) => onOverlayChange(id, { opacity: Number(e.target.value) })}
                          aria-label={`Opacité : ${def.label}`}
                          className="flex-1 accent-[#0a84ff]"
                        />
                        <span className="w-8 text-right font-mono">{Math.round(state.opacity * 100)}%</span>
                      </label>
                    )}

                    <p
                      role="status"
                      className={`flex items-center gap-1.5 ${status === 'error' || outOfZoom || noPolygon ? 'text-amber-200' : 'text-white/60'}`}
                    >
                      {status === 'loading' && !outOfZoom && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
                      {(status === 'error' || outOfZoom || noPolygon) && <AlertTriangle className="w-3 h-3" aria-hidden="true" />}
                      {outOfZoom
                        ? `Zoomez (niveau ${def.minZoom} ou plus) pour afficher cette couche.`
                        : noPolygon
                          ? "Aucun contour n'est enregistré pour cette parcelle."
                          : status === 'error'
                            ? 'Le service de cartes ne répond pas. Réessayez plus tard.'
                            : STATUS_TEXT[status]}
                    </p>

                    {def.legend?.src && (
                      <img
                        src={def.legend.src}
                        alt={def.legend.alt}
                        loading="lazy"
                        className={`rounded bg-white/90 p-1 ${id === 'soil' ? 'h-24 w-auto' : 'max-w-full h-auto'}`}
                      />
                    )}
                    {id === 'terrain' && (
                      <GradientBar
                        stops="#7ab87a, #d9d28a, #c9a26b, #8c6d4f, #f5f5f5"
                        left="Bas"
                        right="Haut"
                        label="Teintes hypsométriques : du bas au haut relief"
                      />
                    )}

                    <p className="leading-relaxed text-white/45">
                      {def.source} · {def.coverage} · {def.vintage}. {def.caveat}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};
