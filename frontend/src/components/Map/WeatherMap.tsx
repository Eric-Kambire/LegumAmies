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

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (isWithinMetropolitanFrance(lat, lng)) {
        onSelectCoordinates(lat, lng);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [onSelectCoordinates]);

  // 2. Base Tile Layer (Dark Matter / Positron)
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
        '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
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
        opacity: 0.75,
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
      radius: Math.max(gpsPosition.accuracy, 30),
      color: '#0ea5e9',
      fillColor: '#0ea5e9',
      fillOpacity: 0.12,
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

  // 5. Selected Field Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (fieldMarkerRef.current) {
      map.removeLayer(fieldMarkerRef.current);
      fieldMarkerRef.current = null;
    }

    if (!selectedField) return;

    const pinIcon = L.divIcon({
      className: 'custom-field-pin',
      html: `
        <div class="flex flex-col items-center select-none -translate-x-1/2 -translate-y-full cursor-pointer transition-transform hover:scale-110 active:scale-95">
          <div class="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-semibold tracking-wide shadow-lg flex items-center gap-1.5 border border-emerald-400/40">
            <span>🌱</span>
            <span>${selectedField.name || 'Parcelle'}</span>
          </div>
          <div class="w-3 h-3 bg-emerald-600 rotate-45 -mt-1.5 shadow-md"></div>
          <div class="w-2 h-2 rounded-full bg-white ring-2 ring-emerald-500 mt-0.5"></div>
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

  // 6. Pulse Basins Markers
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
          <button class="bg-slate-900/80 hover:bg-emerald-900/90 text-slate-200 hover:text-white backdrop-blur-md border border-slate-700/60 hover:border-emerald-500/60 px-2 py-0.5 rounded-full text-[10px] font-medium shadow-md transition-all active:scale-95 whitespace-nowrap flex items-center gap-1 -translate-x-1/2 -translate-y-1/2">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
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
