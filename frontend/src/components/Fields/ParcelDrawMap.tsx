import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Check, CornerDownLeft, Pencil, RotateCcw, Undo2 } from 'lucide-react';

export type ParcelPoint = [number, number]; // [latitude, longitude], per SelectedField

/** Spherical polygon area using WGS84-compatible mean earth radius; suitable for field-sized polygons in France. */
export function computeParcelAreaHa(points: ParcelPoint[]): number {
  if (points.length < 3) return 0;
  const radius = 6371008.8;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [lat1, lon1] = points[i];
    const [lat2, lon2] = points[(i + 1) % points.length];
    const deltaLongitude = (lon2 - lon1) * Math.PI / 180;
    sum += deltaLongitude * (2 + Math.sin(lat1 * Math.PI / 180) + Math.sin(lat2 * Math.PI / 180));
  }
  return Math.abs((sum * radius * radius) / 2) / 10000;
}

const orientation = (a: ParcelPoint, b: ParcelPoint, c: ParcelPoint) =>
  (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);

/** Reject self-crossing rings before saving, to avoid invalid areas/centroids. */
export function hasSelfIntersection(vertices: ParcelPoint[]): boolean {
  if (vertices.length < 4) return false;
  const onSegment = (a: ParcelPoint, b: ParcelPoint, c: ParcelPoint) =>
    Math.min(a[1], b[1]) <= c[1] && c[1] <= Math.max(a[1], b[1]) &&
    Math.min(a[0], b[0]) <= c[0] && c[0] <= Math.max(a[0], b[0]);
  const intersects = (a: ParcelPoint, b: ParcelPoint, c: ParcelPoint, d: ParcelPoint) => {
    const p = orientation(a, b, c), q = orientation(a, b, d);
    const r = orientation(c, d, a), s = orientation(c, d, b);
    if (((p > 0 && q < 0) || (p < 0 && q > 0)) && ((r > 0 && s < 0) || (r < 0 && s > 0))) return true;
    return (p === 0 && onSegment(a, b, c)) || (q === 0 && onSegment(a, b, d)) ||
      (r === 0 && onSegment(c, d, a)) || (s === 0 && onSegment(c, d, b));
  };
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (intersects(vertices[i], vertices[(i + 1) % n], vertices[j], vertices[(j + 1) % n])) return true;
    }
  }
  return false;
}

interface ParcelDrawMapProps {
  latitude: number;
  longitude: number;
  vertices: ParcelPoint[];
  onVerticesChange: (points: ParcelPoint[]) => void;
  onPointChange: (lat: number, lng: number) => void;
}

export const ParcelDrawMap: React.FC<ParcelDrawMapProps> = ({
  latitude, longitude, vertices, onVerticesChange, onPointChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const shapesRef = useRef<L.LayerGroup | null>(null);
  const onVerticesRef = useRef(onVerticesChange);
  const onPointRef = useRef(onPointChange);
  const verticesRef = useRef(vertices);
  const drawingRef = useRef(false);
  const [drawing, setDrawing] = useState(false);
  const [notice, setNotice] = useState('');
  const area = computeParcelAreaHa(vertices);
  const isInvalid = vertices.length >= 3 && hasSelfIntersection(vertices);

  onVerticesRef.current = onVerticesChange;
  onPointRef.current = onPointChange;
  verticesRef.current = vertices;
  drawingRef.current = drawing;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [latitude, longitude], zoom: 15, minZoom: 5, maxZoom: 20, zoomControl: true,
      scrollWheelZoom: false, attributionControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
    const shapeLayer = L.layerGroup().addTo(map);
    mapRef.current = map;
    shapesRef.current = shapeLayer;
    map.on('click', (event: L.LeafletMouseEvent) => {
      if (drawingRef.current) {
        const next = [...verticesRef.current, [event.latlng.lat, event.latlng.lng] as ParcelPoint];
        onVerticesRef.current(next);
      } else {
        onPointRef.current(event.latlng.lat, event.latlng.lng);
      }
    });
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    const timer = window.setTimeout(() => map.invalidateSize(), 110);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      shapesRef.current = null;
    };
    // We intentionally initialize once. Callback refs avoid map reinitialization during drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = shapesRef.current;
    if (!map || !group) return;
    group.clearLayers();
    if (vertices.length >= 3) {
      L.polygon(vertices, {
        color: isInvalid ? '#ef4444' : '#34d399',
        fillColor: '#10b981', fillOpacity: 0.21, weight: 2.5,
      }).addTo(group);
    } else if (vertices.length >= 2) {
      L.polyline(vertices, { color: '#34d399', weight: 2.5, dashArray: '5 4' }).addTo(group);
    }
    vertices.forEach((v, i) => L.circleMarker(v, {
      radius: 5, color: '#ffffff', weight: 2, fillColor: '#059669', fillOpacity: 1,
    }).bindTooltip('Point ' + (i + 1), { direction: 'top' }).addTo(group));
    if (!vertices.length) {
      L.circleMarker([latitude, longitude], {
        radius: 6, color: '#ffffff', weight: 2, fillColor: '#38bdf8', fillOpacity: 1,
      }).addTo(group).bindTooltip('Position sélectionnée', { direction: 'top' });
    }
  }, [vertices, latitude, longitude, isInvalid]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || vertices.length > 0 || drawing) return;
    map.panTo([latitude, longitude], { animate: false });
    // Only pan on explicit location changes; drawing uses its own independent vertices.
  }, [latitude, longitude, vertices.length, drawing]);

  const undo = () => {
    if (vertices.length > 0) onVerticesChange(vertices.slice(0, -1));
    setNotice('');
  };
  const clear = () => { onVerticesChange([]); setNotice('Contour effacé. Cliquez sur la carte pour placer les coins.'); };
  const finish = () => {
    if (vertices.length < 3) { setNotice('Ajoutez au moins trois sommets.'); return; }
    if (isInvalid || area < 0.005) { setNotice('Contour invalide : évitez les croisements et les parcelles de surface nulle.'); return; }
    const centroidLat = vertices.reduce((s, [lat]) => s + lat, 0) / vertices.length;
    const centroidLon = vertices.reduce((s, [, lon]) => s + lon, 0) / vertices.length;
    setDrawing(false);
    onPointChange(centroidLat, centroidLon);
    setNotice('Contour enregistré : ' + area.toFixed(2) + ' hectares.');
  };

  return (
    <section className="space-y-2" aria-label="Dessiner les contours de la parcelle">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-xs text-white/80">Délimiter ma parcelle</strong>
        <span className="text-[11px] text-emerald-200 tabular-nums">
          {vertices.length >= 3 ? `${area.toFixed(2)} ha calculés` : `${vertices.length} point(s)`}
        </span>
      </div>
      <div className="relative h-[245px] sm:h-[280px] w-full overflow-hidden rounded-2xl border border-white/15">
        <div ref={containerRef} className="absolute inset-0 w-full h-full" aria-label="Carte interactive pour dessiner la parcelle" />
        <span className="pointer-events-none absolute left-2 bottom-2 z-[430] bg-[#111827]/85 text-[10px] text-white/70 px-2 py-1 rounded-full">
          {drawing ? 'Cliquez sur chaque coin · glissez pour déplacer la carte' : 'Cliquez pour choisir un point GPS'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setDrawing(true); setNotice('Cliquez sur les angles de votre terrain.'); }} aria-pressed={drawing} className={`rounded-xl px-3 py-2 text-xs font-semibold flex gap-1.5 items-center ${drawing ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white/75'}`}>
          <Pencil className="w-3.5 h-3.5" />{vertices.length ? 'Modifier le tracé' : 'Dessiner le contour'}
        </button>
        <button type="button" onClick={undo} disabled={vertices.length === 0} className="rounded-xl px-3 py-2 text-xs bg-white/10 disabled:opacity-40 flex gap-1 items-center"><Undo2 className="w-3.5 h-3.5" />Annuler un point</button>
        <button type="button" onClick={clear} disabled={vertices.length === 0} className="rounded-xl px-3 py-2 text-xs bg-white/10 disabled:opacity-40 flex gap-1 items-center"><RotateCcw className="w-3.5 h-3.5" />Effacer</button>
        {drawing && <button type="button" onClick={finish} className="rounded-xl px-3 py-2 text-xs bg-emerald-600 text-white font-semibold flex gap-1 items-center"><Check className="w-3.5 h-3.5" />Terminer</button>}
      </div>
      {isInvalid && <p role="alert" className="text-xs text-rose-300">Les côtés du polygone se croisent : corrigez les sommets.</p>}
      {notice && <p role="status" className="text-[11px] text-emerald-100/80 flex items-start gap-1"><CornerDownLeft className="w-3.5 h-3.5 shrink-0 mt-0.5"/>{notice}</p>}
      <p className="text-[10px] text-white/45">Surface calculée sur la sphère terrestre. Les coordonnées sont enregistrées avec la parcelle.</p>
    </section>
  );
};
