/**
 * Client for the LegumAmies ClimateShield backend (FastAPI over AROME/AIFS +
 * sourced agronomic rules). Base URL comes from VITE_API_BASE_URL.
 *
 * If the base URL is not configured, the app runs in "backend unavailable"
 * mode and falls back to the sourced client-side screening — it never shows
 * fabricated values.
 */
import type { AssessRequest, AssessResponse } from '../types/backend-contract';

export const API_BASE_URL: string | undefined = import.meta.env?.VITE_API_BASE_URL;

export function isBackendConfigured(): boolean {
  return typeof API_BASE_URL === 'string' && API_BASE_URL.length > 0;
}

export class BackendUnavailableError extends Error {}

export async function assess(req: AssessRequest, signal?: AbortSignal): Promise<AssessResponse> {
  if (!isBackendConfigured()) {
    throw new BackendUnavailableError('VITE_API_BASE_URL is not configured');
  }
  const res = await fetch(`${API_BASE_URL!.replace(/\/$/, '')}/assess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body?.detail ?? detail;
    } catch {
      /* ignore parse error */
    }
    throw new Error(`Backend /assess failed: ${detail}`);
  }
  return (await res.json()) as AssessResponse;
}

export async function health(signal?: AbortSignal): Promise<boolean> {
  if (!isBackendConfigured()) return false;
  try {
    const res = await fetch(`${API_BASE_URL!.replace(/\/$/, '')}/health`, { signal });
    return res.ok;
  } catch {
    return false;
  }
}
