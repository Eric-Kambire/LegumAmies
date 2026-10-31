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

interface WeatherMapProps {
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

  // 1. Initialize Map
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

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [onSelectCoordinates]);

  // 2. Base Tile Layer (Apple Maps look using CartoDB styled OpenStreetMap)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
    }

    const tileUrl = isDarkMode
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    const baseLayer = L.tileLayer(tileUrl, {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    baseTileLayerRef.current = baseLayer;
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

    const pinIcon = L.divIcon({
      className: 'custom-apple-pin',
      html: `
        <div class="flex flex-col items-center select-none -translate-x-1/2 -translate-y-full cursor-pointer transition-transform hover:scale-105 active:scale-95">
          <div class="px-3 py-1 rounded-full bg-white text-black text-xs font-semibold tracking-tight shadow-xl flex items-center gap-1.5 border border-black/10">
            <span>🌱</span>
            <span class="truncate max-w-[120px]">${selectedField.name || 'Parcelle'}</span>
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

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};
