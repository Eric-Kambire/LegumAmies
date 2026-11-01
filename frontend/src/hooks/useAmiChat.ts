import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SelectedField } from '../types/agricultural';
import type { AdvisorRequest, AdvisorResponse } from '../types/backend-contract';
import { askAdvisor, isBackendConfigured } from '../services/legumamiesApi';
import { getCurrentGPSPosition, isWithinMetropolitanFrance } from '../services/geoService';

export type AmiContextMode = 'field' | 'position';
export type AmiGeoStatus = 'idle' | 'locating' | 'ready' | 'denied' | 'outside' | 'error';

export interface AmiPosition {
  latitude: number;
  longitude: number;
  /** GPS accuracy radius in metres; undefined when the point was picked on the map. */
  accuracy?: number;
  source: 'gps' | 'map';
}

export interface AmiMessageData {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  /** Human label of the context the question was asked in. */
  contextLabel: string;
  response?: AdvisorResponse;
  error?: string;
  pending?: boolean;
}

const HISTORY_KEY = 'legum_ami_history_v1';
const MAX_HISTORY = 40;

function loadHistory(): AmiMessageData[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // A request interrupted by a reload can never complete: drop it.
    return (parsed as AmiMessageData[]).filter((m) => !m.pending).slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

/** "Parcelle du Moulin (Lauragais)" -> "Parcelle du Moulin" */
export function shortFieldName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim() || name;
}

const makeId = () => `ami_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export interface AmiChat {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** Opens the panel with a prefilled (never auto-sent) question. */
  openWithQuestion: (question: string) => void;
  mode: AmiContextMode;
  setMode: (mode: AmiContextMode) => void;
  position: AmiPosition | null;
  geoStatus: AmiGeoStatus;
  geoMessage: string | null;
  locate: () => Promise<void>;
  mapPickActive: boolean;
  requestMapPick: () => void;
  cancelMapPick: () => void;
  /** Called by the map when the user clicks while a pick is requested. Returns true if consumed. */
  applyMapPick: (lat: number, lng: number) => boolean;
  messages: AmiMessageData[];
  loading: boolean;
  ask: (question: string) => Promise<void>;
  clear: () => void;
  draft: string;
  setDraft: (value: string) => void;
  /** Discreet label, e.g. "Ami · Parcelle du Moulin" or "Ami · Près de moi". */
  contextLabel: string;
  backendAvailable: boolean;
}

/**
 * Global state of the Ami assistant. Lives in App so the conversation survives tab
 * navigation. The backend answers single questions (no server-side memory): history
 * is kept on the device only and is never replayed to the API.
 */
export interface AmiChatOptions {
  /** Called with every successful GPS fix so the map can show it. */
  onGpsFix?: (pos: { latitude: number; longitude: number; accuracy: number }) => void;
  /** Called when the user asks to pick a point on the map (the app should show the map). */
  onMapPickRequested?: () => void;
}

export function useAmiChat(field: SelectedField | null, options: AmiChatOptions = {}): AmiChat {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setModeState] = useState<AmiContextMode>('field');
  const [position, setPosition] = useState<AmiPosition | null>(null);
  const [geoStatus, setGeoStatus] = useState<AmiGeoStatus>('idle');
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [mapPickActive, setMapPickActive] = useState(false);
  const [messages, setMessages] = useState<AmiMessageData[]>(loadHistory);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const inFlight = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(messages.filter((m) => !m.pending).slice(-MAX_HISTORY))
      );
    } catch {
      /* storage full or unavailable: history simply stays in memory */
    }
  }, [messages]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const contextLabel = useMemo(() => {
    if (mode === 'position') {
      return position?.source === 'map' ? 'Ami · Point choisi' : 'Ami · Près de moi';
    }
    return field ? `Ami · ${shortFieldName(field.name)}` : 'Ami';
  }, [mode, position, field]);

  const locate = useCallback(async () => {
    setGeoStatus('locating');
    setGeoMessage(null);
    try {
      const pos = await getCurrentGPSPosition();
      if (!isWithinMetropolitanFrance(pos.latitude, pos.longitude)) {
        setGeoStatus('outside');
        setGeoMessage('Votre position est hors de la France métropolitaine : les prévisions ne la couvrent pas.');
        return;
      }
      setPosition({ latitude: pos.latitude, longitude: pos.longitude, accuracy: pos.accuracy, source: 'gps' });
      setGeoStatus('ready');
      setModeState('position');
      optionsRef.current.onGpsFix?.(pos);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Position indisponible.';
      setGeoStatus(/refus/i.test(message) ? 'denied' : 'error');
      setGeoMessage(message);
    }
  }, []);

  const setMode = useCallback(
    (next: AmiContextMode) => {
      if (next === 'position' && !position) {
        // Never read the GPS without an explicit user gesture: the selector shows a button.
        setModeState('position');
        return;
      }
      setModeState(next);
    },
    [position]
  );

  const requestMapPick = useCallback(() => {
    setMapPickActive(true);
    setIsOpen(false);
    optionsRef.current.onMapPickRequested?.();
  }, []);
  const cancelMapPick = useCallback(() => setMapPickActive(false), []);

  const applyMapPick = useCallback(
    (lat: number, lng: number) => {
      if (!mapPickActive) return false;
      setPosition({ latitude: lat, longitude: lng, source: 'map' });
      setGeoStatus('ready');
      setGeoMessage(null);
      setModeState('position');
      setMapPickActive(false);
      setIsOpen(true);
      return true;
    },
    [mapPickActive]
  );

  const ask = useCallback(
    async (rawQuestion: string) => {
      const question = rawQuestion.trim().slice(0, 1000);
      if (!question || inFlight.current) return;
      // A GPS context without a fix must never silently fall back to the selected field.
      if (mode === 'position' && !position) return;

      const usePosition = mode === 'position' && position;
      const label = usePosition
        ? position.source === 'map'
          ? 'Point choisi sur la carte'
          : `Près de moi${position.accuracy ? ` (±${Math.round(position.accuracy)} m)` : ''}`
        : field
          ? shortFieldName(field.name)
          : 'Aucun contexte';

      const request: AdvisorRequest = { question };
      if (usePosition) {
        // Position context: coordinates only. Crop and stage belong to a field, not to a GPS fix.
        request.field = { latitude: position.latitude, longitude: position.longitude, field_name: label };
      } else if (field) {
        request.field = {
          latitude: field.latitude,
          longitude: field.longitude,
          crop: field.cropType,
          growth_stage: field.growthStage,
          harvest_ready: field.growthStage === 'pret_recolter',
          field_name: field.name,
        };
      }

      const userMsg: AmiMessageData = {
        id: makeId(),
        role: 'user',
        text: question,
        createdAt: new Date().toISOString(),
        contextLabel: label,
      };
      const pendingId = makeId();
      const pendingMsg: AmiMessageData = {
        id: pendingId,
        role: 'assistant',
        text: '',
        createdAt: new Date().toISOString(),
        contextLabel: label,
        pending: true,
      };

      inFlight.current = true;
      setLoading(true);
      setDraft('');
      setMessages((prev) => [...prev, userMsg, pendingMsg].slice(-MAX_HISTORY));

      const finish = (patch: Partial<AmiMessageData>) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === pendingId ? { ...m, pending: false, ...patch } : m))
        );

      if (!isBackendConfigured()) {
        finish({
          text: '',
          error:
            "Le conseiller n'est pas connecté : l'adresse de l'API n'est pas configurée sur cette version de l'application.",
        });
        inFlight.current = false;
        setLoading(false);
        return;
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      try {
        const response = await askAdvisor(request, controller.signal);
        finish({ text: response.answer, response });
      } catch (err) {
        if (controller.signal.aborted) {
          finish({ text: '', error: 'Question interrompue.' });
        } else {
          const detail = err instanceof Error ? err.message : 'Erreur inconnue';
          finish({
            text: '',
            error: `Ami n'a pas pu répondre (${detail}). Aucune réponse non sourcée n'est affichée.`,
          });
        }
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    },
    [mode, position, field]
  );

  const clear = useCallback(() => {
    controllerRef.current?.abort();
    setMessages([]);
  }, []);

  const openWithQuestion = useCallback((question: string) => {
    setDraft(question);
    setIsOpen(true);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((v) => !v),
    openWithQuestion,
    mode,
    setMode,
    position,
    geoStatus,
    geoMessage,
    locate,
    mapPickActive,
    requestMapPick,
    cancelMapPick,
    applyMapPick,
    messages,
    loading,
    ask,
    clear,
    draft,
    setDraft,
    contextLabel,
    backendAvailable: isBackendConfigured(),
  };
}
