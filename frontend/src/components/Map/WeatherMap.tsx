import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { WeatherLayerType, RadarFrame } from '../../types/weather';
import type { SelectedField } from '../../types/agricultural';
import {
  FRANCE_CENTER,
  FRANCE_DEFAULT_ZOOM,
  isWithinMetropolitanFrance,
} from '../../services/geoService';
import { getRadarTileUrl } from '../../services/radarApi';
import { FRENCH_AGRI_BASINS } from '../../data/frenchAgriBasins';
import type { FrenchAgriBasin } from '../../data/frenchAgriBasins';
import {
  OVERLAY_DEFS,
  type LayerStatus,
  type OverlayId,
  type OverlayState,
  type PointValue,
} from '../../data/mapLayers';

interface WeatherMapProps {
  isActive?: boolean;
  selectedField: SelectedField | null;
  /** Inspected point (map click). Drawn only when it is away from the field. */
  selectedPoint: { lat: number; lng: number } | null;
  onSelectCoordinates: (lat: number, lng: number) => void;
  activeLayer: WeatherLayerType;
  radarHost: string;
  currentRadarFrame: RadarFrame | null;
  gpsPosition: { latitude: number; longitude: number; accuracy: number } | null;
  isDarkMode: boolean;
  onSelectBasin: (basin: FrenchAgriBasin) => void;
  overlays: Record<OverlayId, OverlayState>;
  onOverlayStatus: (id: OverlayId, status: LayerStatus) => void;
  onZoomChange?: (zoom: number) => void;
  pointValue: PointValue | null;
  pickMode?: boolean;
}

const DARK_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const LIGHT_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

type TileOverlayId = Exclude<OverlayId, 'field'>;

export const WeatherMap: React.FC<WeatherMapProps> = ({
  isActive = true,
  selectedField,
  selectedPoint,
  onSelectCoordinates,
  activeLayer,
  radarHost,
  currentRadarFrame,
  gpsPosition,
  isDarkMode,
  onSelectBasin,
  overlays,
  onOverlayStatus,
  onZoomChange,
  pointValue,
  pickMode = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const radarTileLayerRef = useRef<L.TileLayer | null>(null);
  const fieldMarkerRef = useRef<L.Marker | null>(null);
  const fieldPolygonRef = useRef<L.Polygon | null>(null);
  const pointMarkerRef = useRef<L.Marker | null>(null);
  const valueMarkerRef = useRef<L.Marker | null>(null);
  const gpsMarkerRef = useRef<L.LayerGroup | null>(null);
  const basinsLayerRef = useRef<L.LayerGroup | null>(null);
  const overlayLayersRef = useRef<Partial<Record<TileOverlayId, L.TileLayer>>>({});

  // Latest callbacks, so the Leaflet map is created once and never torn down by prop changes.
  const onSelectRef = useRef(onSelectCoordinates);
  const onStatusRef = useRef(onOverlayStatus);
  const onZoomRef = useRef(onZoomChange);
  const onBasinRef = useRef(onSelectBasin);
  const isDarkRef = useRef(isDarkMode);
  const isActiveRef = useRef(isActive);
  useEffect(() => {
    onSelectRef.current = onSelectCoordinates;
    onStatusRef.current = onOverlayStatus;
    onZoomRef.current = onZoomChange;
    onBasinRef.current = onSelectBasin;
    isActiveRef.current = isActive;
  });

  // 1. Initialise the map once.
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const bounds = L.latLngBounds(L.latLng(40.5, -6.5), L.latLng(52.2, 10.5));
    const map = L.map(mapContainerRef.current, {
      center: FRANCE_CENTER,
      zoom: FRANCE_DEFAULT_ZOOM,
      minZoom: 5,
      maxZoom: 16,
      maxBounds: bounds,
      maxBoundsViscosity: 0.8,
      zoomControl: false,
      attributionControl: true,
    });

    const dark = isDarkRef.current;
    baseTileLayerRef.current = L.tileLayer(dark ? DARK_TILES : LIGHT_TILES, {
      maxZoom: 19,
      maxNativeZoom: dark ? 16 : 19,
      attribution: dark
        ? '&copy; <a href="https://www.esri.com/">Esri</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributeurs',
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (isWithinMetropolitanFrance(lat, lng)) onSelectRef.current(lat, lng);
    });
    map.on('zoomend', () => onZoomRef.current?.(map.getZoom()));
    onZoomRef.current?.(map.getZoom());

    mapInstanceRef.current = map;

    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(mapContainerRef.current);
    const t = window.setTimeout(() => map.invalidateSize(), 100);

    return () => {
      window.clearTimeout(t);
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      baseTileLayerRef.current = null;
      radarTileLayerRef.current = null;
      overlayLayersRef.current = {};
    };
  }, []);

  // Tab switch / visibility resize.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isActive) return;
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 60);
    const t2 = setTimeout(() => map.invalidateSize(), 250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isActive]);

  // 2. Base layer theme.
  useEffect(() => {
    isDarkRef.current = isDarkMode;
    const layer = baseTileLayerRef.current;
    if (!layer) return;
    layer.setUrl(isDarkMode ? DARK_TILES : LIGHT_TILES);
    layer.options.maxNativeZoom = isDarkMode ? 16 : 19;
  }, [isDarkMode]);

  // 3. Radar (only true spatial weather raster).
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (activeLayer !== 'radar' || !currentRadarFrame || !radarHost) {
      if (radarTileLayerRef.current) {
        map.removeLayer(radarTileLayerRef.current);
        radarTileLayerRef.current = null;
      }
      return;
    }
    const tileUrl = getRadarTileUrl(radarHost, currentRadarFrame.path);
    if (radarTileLayerRef.current) {
      radarTileLayerRef.current.setUrl(tileUrl);
    } else {
      radarTileLayerRef.current = L.tileLayer(tileUrl, {
        opacity: 0.72,
        zIndex: 50,
        tileSize: 256,
        attribution: '&copy; <a href="https://www.rainviewer.com/">RainViewer</a>',
      }).addTo(map);
    }
  }, [activeLayer, currentRadarFrame, radarHost]);

  // 4. Geographic overlays (real services; created on demand, never preloaded).
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    (Object.keys(OVERLAY_DEFS) as OverlayId[])
      .filter((id): id is TileOverlayId => id !== 'field')
      .forEach((id) => {
        const def = OVERLAY_DEFS[id];
        const state = overlays[id];
        const existing = overlayLayersRef.current[id];

        if (!state.enabled) {
          if (existing) {
            map.removeLayer(existing);
            delete overlayLayersRef.current[id];
            onStatusRef.current(id, 'idle');
          }
          return;
        }
        if (existing) {
          existing.setOpacity(state.opacity);
          return;
        }

        const common = {
          opacity: state.opacity,
          zIndex: def.zIndex,
          minZoom: def.minZoom,
          maxZoom: 16,
          maxNativeZoom: def.maxNativeZoom,
          attribution: def.attribution,
          crossOrigin: true as const,
        };
        const layer =
          def.kind === 'wms'
            ? L.tileLayer.wms(def.urlTemplate as string, {
                ...common,
                layers: def.wmsLayers,
                format: 'image/png',
                transparent: true,
                version: '1.3.0',
              })
            : L.tileLayer(def.urlTemplate as string, common);

        let loaded = 0;
        let errors = 0;
        layer.on('loading', () => {
          loaded = 0;
          errors = 0;
          onStatusRef.current(id, 'loading');
        });
        layer.on('tileload', () => {
          loaded += 1;
        });
        layer.on('tileerror', () => {
          errors += 1;
        });
        layer.on('load', () => {
          onStatusRef.current(id, loaded === 0 && errors > 0 ? 'error' : 'ready');
        });
        layer.addTo(map);
        overlayLayersRef.current[id] = layer;
        onStatusRef.current(id, 'loading');
      });
  }, [overlays]);

  // 5. GPS marker.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (gpsMarkerRef.current) {
      map.removeLayer(gpsMarkerRef.current);
      gpsMarkerRef.current = null;
    }
    if (!gpsPosition) return;
    const group = L.layerGroup();
    group.addLayer(
      L.circle([gpsPosition.latitude, gpsPosition.longitude], {
        radius: Math.max(gpsPosition.accuracy, 25),
        color: '#007aff',
        fillColor: '#007aff',
        fillOpacity: 0.15,
        weight: 1,
      })
    );
    group.addLayer(
      L.marker([gpsPosition.latitude, gpsPosition.longitude], {
        icon: L.divIcon({
          className: 'custom-gps-marker',
          html: '<div class="custom-gps-pulse"></div><div class="custom-gps-dot"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      })
    );
    group.addTo(map);
    gpsMarkerRef.current = group;
  }, [gpsPosition]);

  // 6. Field pin + polygon, and fly to the field when another one is selected.
  const flownFieldId = useRef<string | null>(null);
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (fieldMarkerRef.current) {
      map.removeLayer(fieldMarkerRef.current);
      fieldMarkerRef.current = null;
    }
    if (fieldPolygonRef.current) {
      map.removeLayer(fieldPolygonRef.current);
      fieldPolygonRef.current = null;
    }
    if (!selectedField) return;

    fieldMarkerRef.current = L.marker([selectedField.latitude, selectedField.longitude], {
      icon: L.divIcon({
        className: 'custom-apple-pin',
        html: `
          <div class="flex flex-col items-center select-none -translate-x-1/2 -translate-y-full cursor-pointer">
            <div class="px-3 py-1 rounded-full bg-white text-black text-xs font-semibold tracking-tight shadow-xl flex items-center gap-1.5 border border-black/10">
              <span class="w-2 h-2 rounded-full bg-[#10b981]"></span>
              <span class="truncate max-w-[120px]">${escapeHtml(selectedField.name || 'Parcelle')}</span>
            </div>
            <div class="w-2.5 h-2.5 bg-white rotate-45 -mt-1 shadow-md"></div>
          </div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
      zIndexOffset: 1000,
    }).addTo(map);

    if (overlays.field.enabled && selectedField.polygonCoordinates && selectedField.polygonCoordinates.length >= 3) {
      fieldPolygonRef.current = L.polygon(selectedField.polygonCoordinates, {
        color: '#34d399',
        weight: 2,
        fillColor: '#34d399',
        fillOpacity: overlays.field.opacity,
      }).addTo(map);
      onStatusRef.current('field', 'ready');
    } else {
      onStatusRef.current('field', overlays.field.enabled ? 'unavailable' : 'idle');
    }

    if (flownFieldId.current !== selectedField.id) {
      flownFieldId.current = selectedField.id;
      const zoom = Math.max(map.getZoom(), 9);
      const size = map.getSize();
      // A hidden map has a 0x0 container: animating would compute NaN coordinates.
      if (isActiveRef.current && size.x > 0 && size.y > 0) {
        map.flyTo([selectedField.latitude, selectedField.longitude], zoom, { duration: 1 });
      } else {
        map.setView([selectedField.latitude, selectedField.longitude], zoom, { animate: false });
      }
    }
  }, [selectedField, overlays.field.enabled, overlays.field.opacity]);

  // 7. Inspected point (only when away from the field).
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (pointMarkerRef.current) {
      map.removeLayer(pointMarkerRef.current);
      pointMarkerRef.current = null;
    }
    if (!selectedPoint) return;
    pointMarkerRef.current = L.marker([selectedPoint.lat, selectedPoint.lng], {
      icon: L.divIcon({
        className: 'custom-inspect-pin',
        html: '<div class="-translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#0a84ff] border-2 border-white shadow-lg"></div>',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
      interactive: false,
      zIndexOffset: 900,
    }).addTo(map);
  }, [selectedPoint]);

  // 8. Point value of the active (non-raster) weather layer.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (valueMarkerRef.current) {
      map.removeLayer(valueMarkerRef.current);
      valueMarkerRef.current = null;
    }
    if (!pointValue) return;
    const arrow =
      pointValue.rotation !== undefined
        ? `<svg width="14" height="14" viewBox="0 0 24 24" style="transform:rotate(${Math.round(pointValue.rotation)}deg)" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M6 9l6-6 6 6"/></svg>`
        : '';
    valueMarkerRef.current = L.marker([pointValue.lat, pointValue.lng], {
      icon: L.divIcon({
        className: 'custom-point-value',
        html: `
          <div data-testid="map-point-value" class="-translate-x-1/2 translate-y-3 select-none flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-xl border border-white/30"
               style="background:${pointValue.color};color:#0b0f19">
            ${arrow}<span>${escapeHtml(pointValue.primary)}</span>
            ${pointValue.secondary ? `<span class="font-medium opacity-75">${escapeHtml(pointValue.secondary)}</span>` : ''}
          </div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
      interactive: false,
      zIndexOffset: 1100,
    }).addTo(map);
  }, [pointValue]);

  // 9. Basin chips.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (basinsLayerRef.current) {
      map.removeLayer(basinsLayerRef.current);
      basinsLayerRef.current = null;
    }
    const group = L.layerGroup();
    FRENCH_AGRI_BASINS.forEach((basin) => {
      const marker = L.marker([basin.latitude, basin.longitude], {
        icon: L.divIcon({
          className: 'custom-basin-chip',
          html: `
            <button class="apple-glass text-white/90 hover:text-white px-2.5 py-1 rounded-full text-[11px] font-medium shadow-lg transition-all active:scale-95 whitespace-nowrap flex items-center gap-1.5 -translate-x-1/2 -translate-y-1/2">
              <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
              <span>${escapeHtml(basin.name.split(' ')[0])}</span>
            </button>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
      });
      marker.on('click', () => {
        onBasinRef.current(basin);
        map.flyTo([basin.latitude, basin.longitude], basin.zoomLevel, { duration: 1.2 });
      });
      group.addLayer(marker);
    });
    group.addTo(map);
    basinsLayerRef.current = group;
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <div
        ref={mapContainerRef}
        data-testid="weather-map"
        className={`w-full h-full ${pickMode ? 'cursor-crosshair' : ''}`}
        style={{ width: '100%', height: '100%', minHeight: '100%' }}
      />
    </div>
  );
};
