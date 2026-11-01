import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { WeatherLayerType, RadarFrame, LocationWeatherData } from '../../types/weather';
import type { MapOverlayState } from './MapControls';
import type { SelectedField } from '../../types/agricultural';
import {
  FRANCE_CENTER,
  FRANCE_DEFAULT_ZOOM,
  isWithinMetropolitanFrance,
} from '../../services/geoService';
import { getRadarTileUrl } from '../../services/radarApi';
import { FRENCH_AGRI_BASINS } from '../../data/frenchAgriBasins';
import type { FrenchAgriBasin } from '../../data/frenchAgriBasins';

interface WeatherMapProps {
  overlays: MapOverlayState;
  weather: LocationWeatherData | null;
  isActive?: boolean;
  selectedField: SelectedField | null;
  onSelectCoordinates: (lat: number, lng: number) => void;
  activeLayer: WeatherLayerType;
  radarHost: string;
  currentRadarFrame: RadarFrame | null;
  gpsPosition: { latitude: number; longitude: number; accuracy: number } | null;
  isDarkMode: boolean;
  onSelectBasin: (basin: FrenchAgriBasin) => void;
}

export const WeatherMap: React.FC<WeatherMapProps> = ({
  isActive = true,
  overlays,
  weather,
  selectedField,
  onSelectCoordinates,
  activeLayer,
  radarHost,
  currentRadarFrame,
  gpsPosition,
  isDarkMode,
  onSelectBasin,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const radarTileLayerRef = useRef<L.TileLayer | null>(null);
  const fieldMarkerRef = useRef<L.Marker | null>(null);
  const gpsMarkerRef = useRef<L.LayerGroup | null>(null);
  const basinsLayerRef = useRef<L.LayerGroup | null>(null);
  const soilLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const rpgLayerRef = useRef<L.GeoJSON | null>(null);
  const adminLayerRef = useRef<L.GeoJSON | null>(null);
  const weatherPointRef = useRef<L.CircleMarker | null>(null);
  const fieldPolygonRef = useRef<L.Polygon | null>(null);

  // 1. Initialize Map and immediately attach base tile layer
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Metropolitan France bounds
    const southWest = L.latLng(40.5, -6.5);
    const northEast = L.latLng(52.2, 10.5);
    const bounds = L.latLngBounds(southWest, northEast);

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

    // Base Tile Layer (100% Free & Open - Zero API Key & Zero Watermark)
    const tileUrl = isDarkMode
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
      : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    const baseLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      maxNativeZoom: isDarkMode ? 16 : 19,
      attribution: isDarkMode
        ? '&copy; <a href="https://www.esri.com/">Esri</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributeurs',
    }).addTo(map);

    baseTileLayerRef.current = baseLayer;

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (isWithinMetropolitanFrance(lat, lng)) {
        onSelectCoordinates(lat, lng);
      }
    });

    mapInstanceRef.current = map;

    // Invalidate map size on container resize / unhide
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    // Force initial render calculation
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      baseTileLayerRef.current = null;
    };
  }, [onSelectCoordinates, isDarkMode]);

  // Handle Tab Switch / Visibility Resize
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (isActive) {
      map.invalidateSize();
      const t1 = setTimeout(() => map.invalidateSize(), 60);
      const t2 = setTimeout(() => map.invalidateSize(), 250);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isActive]);

  // 2. Base Tile Layer Theme Change (Switch between OpenStreetMap & ESRI Dark)
  useEffect(() => {
    if (!baseTileLayerRef.current) return;
    const tileUrl = isDarkMode
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
      : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    baseTileLayerRef.current.setUrl(tileUrl);
  }, [isDarkMode]);

  // 3. Radar Precipitation Layer
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
      const radarLayer = L.tileLayer(tileUrl, {
        opacity: 0.72,
        zIndex: 50,
        tileSize: 256,
        attribution: '&copy; <a href="https://www.rainviewer.com/">RainViewer</a>',
      }).addTo(map);
      radarTileLayerRef.current = radarLayer;
    }
  }, [activeLayer, currentRadarFrame, radarHost]);

  // 4. GPS Position Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (gpsMarkerRef.current) {
      map.removeLayer(gpsMarkerRef.current);
      gpsMarkerRef.current = null;
    }

    if (!gpsPosition) return;

    const group = L.layerGroup();

    const circle = L.circle([gpsPosition.latitude, gpsPosition.longitude], {
      radius: Math.max(gpsPosition.accuracy, 25),
      color: '#007aff',
      fillColor: '#007aff',
      fillOpacity: 0.15,
      weight: 1,
    });
    group.addLayer(circle);

    const icon = L.divIcon({
      className: 'custom-gps-marker',
      html: `
        <div class="custom-gps-pulse"></div>
        <div class="custom-gps-dot"></div>
      `,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const marker = L.marker([gpsPosition.latitude, gpsPosition.longitude], { icon });
    group.addLayer(marker);

    group.addTo(map);
    gpsMarkerRef.current = group;
  }, [gpsPosition]);

  // 5. Selected Field Marker (Apple Maps Style Pin)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (fieldMarkerRef.current) {
      map.removeLayer(fieldMarkerRef.current);
      fieldMarkerRef.current = null;
    }

    if (!selectedField) return;

    // Leaflet divIcon interpolates HTML: escape user-supplied field names.
    const escapedChars: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    const safeFieldName = String(selectedField.name || 'Parcelle').replace(/[&<>"']/g, (c) => escapedChars[c] || c);
    const pinIcon = L.divIcon({
      className: 'custom-apple-pin',
      html: `
        <div class="flex flex-col items-center select-none -translate-x-1/2 -translate-y-full cursor-pointer transition-transform hover:scale-105 active:scale-95">
          <div class="px-3 py-1 rounded-full bg-white text-black text-xs font-semibold tracking-tight shadow-xl flex items-center gap-1.5 border border-black/10">
            <span class="w-2 h-2 rounded-full bg-[#10b981]"></span>
            <span class="truncate max-w-[120px]">${safeFieldName}</span>
          </div>
          <div class="w-2.5 h-2.5 bg-white rotate-45 -mt-1 shadow-md"></div>
          <div class="w-1.5 h-1.5 rounded-full bg-white/70 ring-2 ring-black/40 mt-0.5"></div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    const marker = L.marker([selectedField.latitude, selectedField.longitude], {
      icon: pinIcon,
      zIndexOffset: 1000,
    }).addTo(map);

    fieldMarkerRef.current = marker;
  }, [selectedField]);

  // 6. Pulse Basins Markers (Apple style capsules)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (basinsLayerRef.current) {
      map.removeLayer(basinsLayerRef.current);
      basinsLayerRef.current = null;
    }

    const group = L.layerGroup();

    FRENCH_AGRI_BASINS.forEach((basin) => {
      const basinIcon = L.divIcon({
        className: 'custom-basin-chip',
        html: `
          <button class="apple-glass text-white/90 hover:text-white px-2.5 py-1 rounded-full text-[11px] font-medium shadow-lg transition-all active:scale-95 whitespace-nowrap flex items-center gap-1.5 -translate-x-1/2 -translate-y-1/2">
            <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
            <span>${basin.name.split(' ')[0]}</span>
          </button>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([basin.latitude, basin.longitude], { icon: basinIcon });
      marker.on('click', () => {
        onSelectBasin(basin);
        map.flyTo([basin.latitude, basin.longitude], basin.zoomLevel, { duration: 1.2 });
      });
      group.addLayer(marker);
    });

    group.addTo(map);
    basinsLayerRef.current = group;
  }, [onSelectBasin]);

  // The farmer's own drawn polygon is always visible separately from the official RPG.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (fieldPolygonRef.current) {
      map.removeLayer(fieldPolygonRef.current);
      fieldPolygonRef.current = null;
    }
    const ring = selectedField?.polygonCoordinates;
    if (!ring || ring.length < 3) return;
    const valid = ring.every(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (!valid) return;
    const outline = L.polygon(ring, {
      color: '#34d399', fillColor: '#10b981', fillOpacity: 0.14,
      weight: 3, opacity: 0.96, dashArray: '8 4',
    }).addTo(map);
    const popup = document.createElement('span');
    popup.textContent = 'Mon terrain · ' + (selectedField.name || 'Parcelle');
    outline.bindTooltip(popup, { sticky: true });
    fieldPolygonRef.current = outline;
    return () => {
      map.removeLayer(outline);
      if (fieldPolygonRef.current === outline) fieldPolygonRef.current = null;
    };
  }, [selectedField?.id, selectedField?.polygonCoordinates]);

  // When entering the map, show the actual selected field (including its drawn
  // boundary). A user-triggered France reset remains respected until next field change.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isActive || !selectedField) return;
    const ring = selectedField.polygonCoordinates;
    if (ring && ring.length >= 3 && ring.every(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))) {
      map.fitBounds(L.latLngBounds(ring), { padding: [36, 36], maxZoom: 16, animate: false });
    } else {
      map.setView([selectedField.latitude, selectedField.longitude], Math.max(map.getZoom(), 10), { animate: false });
    }
  }, [isActive, selectedField?.id, selectedField?.updatedAt]);

  // Without a real national weather tile service, anchor local weather values to
  // their true forecast point and move the map to it when the user changes layer.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isActive || activeLayer === 'radar' || !weather) return;
    const center: L.LatLngExpression = [weather.latitude, weather.longitude];
    if (!map.getBounds().contains(center) || map.getZoom() < 10) {
      map.flyTo(center, Math.max(map.getZoom(), 11), { duration: 0.65 });
    }
  }, [activeLayer, isActive, weather?.latitude, weather?.longitude]);

  // SoilGrids 0-5 cm clay: actual 250 m WMS raster, independently toggleable.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (!overlays.soil) {
      if (soilLayerRef.current) map.removeLayer(soilLayerRef.current);
      soilLayerRef.current = null;
      return;
    }
    const layer = L.tileLayer.wms('https://maps.isric.org/mapserv?map=/map/clay.map', {
      layers: 'clay_0-5cm_mean',
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      opacity: overlays.opacity,
      zIndex: 65,
      attribution: 'ISRIC SoilGrids 2.0 · CC BY 4.0 · clay 0-5 cm',
    }).addTo(map);
    soilLayerRef.current = layer;
    return () => { map.removeLayer(layer); if (soilLayerRef.current === layer) soilLayerRef.current = null; };
  }, [overlays.soil, overlays.opacity]);

  // Local, documented GeoJSON excerpts; do not suggest the layer covers all France.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !overlays.rpg) return;
    const controller = new AbortController();
    fetch('/geo/rpg2024_castelnaudary.geojson', { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error('RPG indisponible'); return r.json(); })
      .then((data) => {
        if (controller.signal.aborted) return;
        const layer = L.geoJSON(data, {
          style: { color: '#f6cb73', weight: 1.4, opacity: overlays.opacity, fillOpacity: 0.06 },
          onEachFeature: (feature, l) => {
            const label = feature?.properties?.code_cultu || 'RPG 2024';
            l.bindTooltip('Culture déclarée : ' + String(label).replace(/[<>]/g, ''), { sticky: true });
          },
        }).addTo(map);
        rpgLayerRef.current = layer;
      }).catch((e) => { if (!controller.signal.aborted) console.warn('RPG overlay:', e); });
    return () => { controller.abort(); if (rpgLayerRef.current) { map.removeLayer(rpgLayerRef.current); rpgLayerRef.current = null; } };
  }, [overlays.rpg, overlays.opacity]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !overlays.admin) return;
    const controller = new AbortController();
    fetch('/geo/adminexpress_commune_castelnaudary.geojson', { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error('Limites indisponibles'); return r.json(); })
      .then((data) => {
        if (controller.signal.aborted) return;
        const layer = L.geoJSON(data, {
          style: { color: '#6ee7b7', weight: 2, dashArray: '7 5', opacity: overlays.opacity, fillOpacity: 0 },
        }).addTo(map);
        adminLayerRef.current = layer;
      }).catch((e) => { if (!controller.signal.aborted) console.warn('ADMIN overlay:', e); });
    return () => { controller.abort(); if (adminLayerRef.current) { map.removeLayer(adminLayerRef.current); adminLayerRef.current = null; } };
  }, [overlays.admin, overlays.opacity]);

  // Temperature, wind and cloud selectors show real point forecast values rather
  // than a falsely interpolated nationwide raster.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (weatherPointRef.current) { map.removeLayer(weatherPointRef.current); weatherPointRef.current = null; }
    if (activeLayer === 'radar' || !weather) return;
    const value = activeLayer === 'temperature'
      ? Math.round(weather.current.temperature) + ' °C'
      : activeLayer === 'wind'
        ? Math.round(weather.current.windSpeed) + ' km/h'
        : Math.round(weather.current.cloudCover) + ' % nuages';
    const circle = L.circleMarker([weather.latitude, weather.longitude], {
      radius: 9, color: '#ffffff', fillColor: '#38bdf8', fillOpacity: 0.95, weight: 2,
    }).addTo(map).bindTooltip(value + ' · prévision au point', { permanent: true, direction: 'top', offset: [0, -9] });
    weatherPointRef.current = circle;
    return () => { map.removeLayer(circle); if (weatherPointRef.current === circle) weatherPointRef.current = null; };
  }, [activeLayer, weather]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%', minHeight: '100%' }}
      />
    </div>
  );
};
