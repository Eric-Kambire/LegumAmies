/**
 * Map layer catalogue.
 *
 * Honesty rules encoded here:
 *  - Only `radar` is a true spatial weather raster (RainViewer observation).
 *  - Temperature, wind and cloud cover are POINT forecasts for the selected location
 *    (Open-Meteo / Météo-France AROME). They are never interpolated into a national heat map.
 *  - Geographic overlays are real services (IGN Géoplateforme, ISRIC SoilGrids). Their
 *    coverage and vintage are stated next to each layer.
 */
import type { WeatherLayerType } from '../types/weather';

export type OverlayId = 'soil' | 'rpg' | 'admin' | 'terrain' | 'field';
export type LayerStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';

export interface OverlayState {
  enabled: boolean;
  opacity: number;
}

export interface OverlayDef {
  id: OverlayId;
  label: string;
  description: string;
  kind: 'wmts' | 'wms' | 'vector';
  urlTemplate?: string;
  wmsLayers?: string;
  minZoom: number;
  maxNativeZoom: number;
  zIndex: number;
  defaultOpacity: number;
  source: string;
  attribution: string;
  coverage: string;
  vintage: string;
  /** Plain-language limit that must stay visible to the user. */
  caveat: string;
  legend?: { src: string; alt: string };
}

const IGN_WMTS = (layer: string, format: 'image/png' | 'image/jpeg') =>
  `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=normal&FORMAT=${format}&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`;

export const OVERLAY_DEFS: Record<OverlayId, OverlayDef> = {
  soil: {
    id: 'soil',
    label: 'Texture du sol',
    description: 'Teneur en argile 0–5 cm',
    kind: 'wms',
    urlTemplate: 'https://maps.isric.org/mapserv?map=/map/clay.map',
    wmsLayers: 'clay_0-5cm_mean',
    minZoom: 5,
    maxNativeZoom: 16,
    zIndex: 30,
    defaultOpacity: 0.6,
    source: 'ISRIC SoilGrids 2.0 (WMS)',
    attribution: '&copy; <a href="https://www.isric.org/">ISRIC</a> SoilGrids 2.0, CC-BY 4.0',
    coverage: 'France entière, résolution 250 m',
    vintage: '2020',
    caveat: 'Valeur modélisée, pas mesurée sur votre parcelle. Confirmer par une analyse de sol.',
    legend: {
      src: 'https://maps.isric.org/mapserv?map=/map/clay.map&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=clay_0-5cm_mean',
      alt: 'Légende : argile 0–5 cm en g/kg',
    },
  },
  terrain: {
    id: 'terrain',
    label: 'Relief du terrain',
    description: 'Altitude (teintes hypsométriques)',
    kind: 'wmts',
    urlTemplate: IGN_WMTS('ELEVATION.SLOPES', 'image/jpeg'),
    minZoom: 6,
    maxNativeZoom: 14,
    zIndex: 28,
    defaultOpacity: 0.5,
    source: 'IGN Géoplateforme, MNT BD ALTI®',
    attribution: '&copy; <a href="https://geoservices.ign.fr/">IGN</a> BD ALTI',
    coverage: 'France métropolitaine',
    vintage: 'édition courante',
    caveat: "Montre l'altitude, pas la pente. Une carte des pentes calculée n'est pas encore intégrée.",
    legend: { src: '', alt: '' },
  },
  rpg: {
    id: 'rpg',
    label: 'Parcelles déclarées (RPG)',
    description: 'Cultures déclarées à la PAC',
    kind: 'wmts',
    urlTemplate: IGN_WMTS('LANDUSE.AGRICULTURE2024', 'image/png'),
    minZoom: 6,
    maxNativeZoom: 16,
    zIndex: 40,
    defaultOpacity: 0.65,
    source: 'IGN Géoplateforme, RPG 2024',
    attribution: '&copy; <a href="https://geoservices.ign.fr/">IGN</a> / ASP RPG 2024',
    coverage: 'France métropolitaine',
    vintage: '2024',
    caveat: 'Îlots déclarés pour la PAC, pas des limites de propriété.',
    legend: {
      src: 'https://data.geopf.fr/annexes/ressources/legendes/LANDUSE-AGRICULTURE-legend.png',
      alt: 'Légende du registre parcellaire graphique',
    },
  },
  admin: {
    id: 'admin',
    label: 'Limites administratives',
    description: 'Communes, départements, régions',
    kind: 'wmts',
    urlTemplate: IGN_WMTS('ADMINEXPRESS-COG-CARTO.LATEST', 'image/png'),
    minZoom: 6,
    maxNativeZoom: 16,
    zIndex: 45,
    defaultOpacity: 0.85,
    source: 'IGN Géoplateforme, ADMIN EXPRESS',
    attribution: '&copy; <a href="https://geoservices.ign.fr/">IGN</a> ADMIN EXPRESS',
    coverage: 'France métropolitaine',
    vintage: 'édition 2026-01-01',
    caveat: 'Limites cartographiques simplifiées.',
  },
  field: {
    id: 'field',
    label: 'Contour de la parcelle',
    description: 'Polygone de la parcelle sélectionnée',
    kind: 'vector',
    minZoom: 5,
    maxNativeZoom: 19,
    zIndex: 60,
    defaultOpacity: 0.35,
    source: 'Saisie utilisateur',
    attribution: '',
    coverage: 'Parcelle sélectionnée',
    vintage: 'selon saisie',
    caveat: "Affiché seulement si un contour a été enregistré pour cette parcelle.",
  },
};

export const OVERLAY_ORDER: OverlayId[] = ['soil', 'rpg', 'admin', 'terrain', 'field'];

export const DEFAULT_OVERLAYS: Record<OverlayId, OverlayState> = {
  soil: { enabled: false, opacity: OVERLAY_DEFS.soil.defaultOpacity },
  terrain: { enabled: false, opacity: OVERLAY_DEFS.terrain.defaultOpacity },
  rpg: { enabled: false, opacity: OVERLAY_DEFS.rpg.defaultOpacity },
  admin: { enabled: false, opacity: OVERLAY_DEFS.admin.defaultOpacity },
  field: { enabled: true, opacity: OVERLAY_DEFS.field.defaultOpacity },
};

export interface PrimaryLayerDef {
  id: WeatherLayerType;
  label: string;
  /** true only when a real spatial raster exists */
  spatial: boolean;
  source: string;
  note: string;
}

export const PRIMARY_LAYERS: PrimaryLayerDef[] = [
  {
    id: 'radar',
    label: 'Radar de précipitations',
    spatial: true,
    source: 'RainViewer (radar observé)',
    note: "Observation radar, pas une prévision. L'extrapolation à court terme est signalée sur la frise.",
  },
  {
    id: 'temperature',
    label: 'Température',
    spatial: false,
    source: 'Open-Meteo, modèle Météo-France (point)',
    note: 'Prévision ponctuelle au point sélectionné. Aucune carte nationale de température.',
  },
  {
    id: 'wind',
    label: 'Vent',
    spatial: false,
    source: 'Open-Meteo, modèle Météo-France (point)',
    note: 'Prévision ponctuelle au point sélectionné. Aucune carte nationale du vent.',
  },
  {
    id: 'clouds',
    label: 'Couverture nuageuse',
    spatial: false,
    source: 'Open-Meteo, modèle Météo-France (point)',
    note: 'Prévision ponctuelle au point sélectionné. Aucune carte nationale des nuages.',
  },
];

/** Value drawn on the map for point-based primary layers. */
export interface PointValue {
  lat: number;
  lng: number;
  primary: string;
  secondary?: string;
  color: string;
  /** Wind direction arrow rotation in degrees (direction the wind blows toward). */
  rotation?: number;
}

export const TEMPERATURE_SCALE = [
  { from: -10, color: '#6366f1' },
  { from: 0, color: '#38bdf8' },
  { from: 10, color: '#34d399' },
  { from: 20, color: '#facc15' },
  { from: 30, color: '#f97316' },
  { from: 38, color: '#ef4444' },
];

export function temperatureColor(t: number): string {
  let color = TEMPERATURE_SCALE[0].color;
  for (const step of TEMPERATURE_SCALE) {
    if (t >= step.from) color = step.color;
  }
  return color;
}

export function windColor(kmh: number): string {
  if (kmh >= 50) return '#ef4444';
  if (kmh >= 19) return '#f97316';
  if (kmh >= 10) return '#facc15';
  return '#34d399';
}

export function cloudColor(pct: number): string {
  const g = Math.round(110 + (pct / 100) * 120);
  return `rgb(${g}, ${g + 8}, ${Math.min(255, g + 28)})`;
}
