import type { RadarData, RadarFrame } from '../types/weather';

const RAINVIEWER_MAPS_ENDPOINT = 'https://api.rainviewer.com/public/weather-maps.json';

/**
 * Fetches available radar frames from RainViewer API
 */
export async function fetchRainViewerRadar(): Promise<RadarData> {
  const response = await fetch(RAINVIEWER_MAPS_ENDPOINT);
  if (!response.ok) {
    throw new Error(`Erreur radar RainViewer: HTTP ${response.status}`);
  }

  const data = await response.json();
  const host = data.host || 'https://tilecache.rainviewer.com';

  const past: RadarFrame[] = (data.radar?.past || []).map((item: { time: number; path: string }) => ({
    time: item.time,
    path: item.path,
    type: 'past' as const,
  }));

  const nowcast: RadarFrame[] = (data.radar?.nowcast || []).map((item: { time: number; path: string }) => ({
    time: item.time,
    path: item.path,
    type: 'nowcast' as const,
  }));

  return {
    host,
    past,
    nowcast,
    generatedAt: data.generated || Math.floor(Date.now() / 1000),
  };
}

/**
 * Builds tile URL for a given radar frame, zoom, x, and y
 */
export function getRadarTileUrl(host: string, framePath: string): string {
  return `${host}${framePath}`;
}
