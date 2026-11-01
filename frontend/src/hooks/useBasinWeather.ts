import { useEffect, useState } from 'react';
import type { LocationWeatherData } from '../types/weather';
import { FRENCH_AGRI_BASINS } from '../data/frenchAgriBasins';
import { fetchLocationWeather } from '../services/weatherApi';

export interface BasinWeather {
  byBasin: Record<string, LocationWeatherData>;
  /** true once at least one request ended without any usable basin */
  failed: boolean;
  /** number of reference sectors currently available */
  count: number;
}

const REFRESH_MS = 10 * 60 * 1000;

/**
 * Real point forecasts for each reference sector (agricultural basin). One request per basin,
 * only while a point-based weather layer is shown; refreshed every 10 minutes. Nothing is
 * interpolated between the sectors.
 */
export function useBasinWeather(enabled: boolean): BasinWeather {
  const [state, setState] = useState<{ byBasin: Record<string, LocationWeatherData>; failed: boolean }>({
    byBasin: {},
    failed: false,
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const fetchAll = async (basins: typeof FRENCH_AGRI_BASINS) => {
      const settled = await Promise.allSettled(basins.map((b) => fetchLocationWeather(b.latitude, b.longitude)));
      const ok: Record<string, LocationWeatherData> = {};
      const missing: typeof FRENCH_AGRI_BASINS = [];
      settled.forEach((r, i) => {
        if (r.status === 'fulfilled') ok[basins[i].id] = r.value;
        else missing.push(basins[i]);
      });
      return { ok, missing };
    };

    const load = async () => {
      const first = await fetchAll(FRENCH_AGRI_BASINS);
      let byBasin = first.ok;
      // The provider can throttle a burst of requests: retry the missing sectors once, a little later.
      if (first.missing.length > 0 && !cancelled) {
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
        if (cancelled) return;
        byBasin = { ...byBasin, ...(await fetchAll(first.missing)).ok };
      }
      if (cancelled) return;
      setState((prev) => ({
        byBasin: Object.keys(byBasin).length > 0 ? { ...prev.byBasin, ...byBasin } : prev.byBasin,
        failed: Object.keys(byBasin).length === 0,
      }));
    };

    void load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  return { ...state, count: Object.keys(state.byBasin).length };
}
