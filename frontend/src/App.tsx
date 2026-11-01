import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HomeView } from './components/Home/HomeView';
import { WeatherMap } from './components/Map/WeatherMap';
import { MapControls } from './components/Map/MapControls';
import { MapLayerMenu } from './components/Map/MapLayerMenu';
import { RadarTimeline } from './components/RadarTimeline/RadarTimeline';
import { IntensityLegend } from './components/RadarTimeline/IntensityLegend';
import { WeatherSheet } from './components/WeatherSheet/WeatherSheet';
import { MyFieldsView } from './components/Fields/MyFieldsView';
import { ForecastInsightsView } from './components/Insights/ForecastInsightsView';
import { NotificationsView } from './components/Notifications/NotificationsView';
import { NotificationCenter } from './components/Notifications/NotificationCenter';
import { DuoNotificationBanner } from './components/Notifications/DuoNotificationBanner';
import { AppleTabBar } from './components/Navigation/AppleTabBar';
import type { AppTab } from './components/Navigation/AppleTabBar';
import { DesktopNavBar } from './components/Navigation/DesktopNavBar';
import { useSystemEnvironment } from './hooks/useSystemEnvironment';
import { FieldConfigModal } from './components/WeatherSheet/FieldConfigModal';
import { BackendContractModal } from './components/Navigation/BackendContractModal';
import { PwaInstallBanner } from './components/Navigation/PwaInstallBanner';
import { QuickBasins } from './components/Navigation/QuickBasins';
import { AmiLauncher } from './components/Ami/AmiLauncher';
import { AmiChatPanel } from './components/Ami/AmiChatPanel';

import type { WeatherLayerType, LocationWeatherData, RadarData, RadarFrame } from './types/weather';
import type { SelectedField, AgriculturalRiskAlert, AgriculturalNotification } from './types/agricultural';
import type { FrenchAgriBasin } from './data/frenchAgriBasins';
import {
  DEFAULT_OVERLAYS,
  PRIMARY_LAYERS,
  cloudColor,
  temperatureColor,
  windColor,
  type LayerStatus,
  type OverlayId,
  type OverlayState,
  type PointValue,
} from './data/mapLayers';
import { fetchLocationWeather } from './services/weatherApi';
import { fetchRainViewerRadar } from './services/radarApi';
import {
  isWithinMetropolitanFrance,
  getCurrentGPSPosition,
  reverseGeocodeFrance,
  distanceKm,
  FRANCE_CENTER,
} from './services/geoService';
import { evaluateAgronomicRisks } from './services/agriRiskService';
import { useBackendAssess } from './hooks/useBackendAssess';
import { useAmiChat } from './hooks/useAmiChat';
import { useIsPhone } from './hooks/useMediaQuery';
import { generateDuolingoNotificationsForFields } from './services/duoNotificationService';
import { registerServiceWorker } from './services/pwaService';
import { dispatchNativePushNotification } from './services/pushNotificationService';

// Default initial farm parcels (representative French legume terroirs). Marked as examples in the UI.
const INITIAL_FIELDS: SelectedField[] = [
  {
    id: 'field_lauragais_1',
    name: 'Parcelle du Moulin (Lauragais)',
    latitude: 43.3183,
    longitude: 1.9538,
    commune: 'Castelnaudary',
    departmentCode: '11',
    cropType: 'pois_chiche',
    growthStage: 'floraison',
    areaHectares: 18,
    soilType: 'argilo_calcaire',
    sowingDate: '2026-03-12',
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-10-31T12:00:00Z',
  },
  {
    id: 'field_beauce_2',
    name: 'Champ des Vignes (Beauce)',
    latitude: 48.4561,
    longitude: 1.484,
    commune: 'Chartres',
    departmentCode: '28',
    cropType: 'feverole',
    growthStage: 'formation_gousses',
    areaHectares: 24,
    soilType: 'calcaire',
    sowingDate: '2026-02-20',
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-10-31T12:00:00Z',
  },
  {
    id: 'field_berry_3',
    name: 'Les Terres Rouges (Berry)',
    latitude: 46.8115,
    longitude: 1.6989,
    commune: 'Châteauroux',
    departmentCode: '36',
    cropType: 'lentille',
    growthStage: 'pret_recolter',
    areaHectares: 12,
    soilType: 'limon',
    sowingDate: '2026-03-05',
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-10-31T12:00:00Z',
  },
];

// Illustrative seeded notifications: always labelled "Exemple" by the provenance badge.
const INITIAL_NOTIFICATIONS: AgriculturalNotification[] = generateDuolingoNotificationsForFields(
  INITIAL_FIELDS
).map((n) => ({ ...n, provenance: 'example' as const }));

const OVERLAYS_KEY = 'legum_map_overlays_v1';
const READ_FORECAST_KEY = 'legum_read_forecast_ids';
/** A map point closer than this to the field counts as "the field itself". */
const FIELD_RADIUS_KM = 0.3;

function loadOverlays(): Record<OverlayId, OverlayState> {
  try {
    const raw = localStorage.getItem(OVERLAYS_KEY);
    if (raw) return { ...DEFAULT_OVERLAYS, ...JSON.parse(raw) };
  } catch {
    /* ignore corrupted value */
  }
  return DEFAULT_OVERLAYS;
}

const IDLE_STATUS: Record<OverlayId, LayerStatus> = {
  soil: 'idle',
  terrain: 'idle',
  rpg: 'idle',
  admin: 'idle',
  field: 'idle',
};

export const App: React.FC = () => {
  // 1. Navigation
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const isPhone = useIsPhone();

  // 2. Farm parcels
  const [fields, setFields] = useState<SelectedField[]>(() => {
    const saved = localStorage.getItem('legum_registered_fields');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // ignore
      }
    }
    return INITIAL_FIELDS;
  });

  const [activeField, setActiveField] = useState<SelectedField>(() => {
    const savedActiveId = localStorage.getItem('legum_active_field_id');
    const match = fields.find((f) => f.id === savedActiveId);
    return match || fields[0] || INITIAL_FIELDS[0];
  });

  // 3. Notifications
  const [notifications, setNotifications] = useState<AgriculturalNotification[]>(() => {
    const saved = localStorage.getItem('legum_notifications');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore
      }
    }
    return INITIAL_NOTIFICATIONS;
  });
  const [readForecastIds, setReadForecastIds] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(READ_FORECAST_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [isNotifCenterOpen, setNotifCenterOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

  // 4. Inspected point (map click / GPS / basin) and its weather. The field is never moved by these.
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>({
    lat: activeField.latitude,
    lng: activeField.longitude,
  });
  const [pointGeo, setPointGeo] = useState<{ commune?: string; department?: string } | null>(null);
  const [activeLayer, setActiveLayer] = useState<WeatherLayerType>('radar');
  const [weatherData, setWeatherData] = useState<LocationWeatherData | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [fieldWeather, setFieldWeather] = useState<LocationWeatherData | null>(null);

  // 5. Radar
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [radarFrames, setRadarFrames] = useState<RadarFrame[]>([]);
  const [radarFrameIndex, setRadarFrameIndex] = useState<number>(0);
  const [isRadarPlaying, setIsRadarPlaying] = useState<boolean>(false);

  // 6. Map layers
  const [overlays, setOverlays] = useState<Record<OverlayId, OverlayState>>(loadOverlays);
  const [overlayStatus, setOverlayStatus] = useState<Record<OverlayId, LayerStatus>>(IDLE_STATUS);
  const [isLayerMenuOpen, setLayerMenuOpen] = useState(false);
  const [mapZoom, setMapZoom] = useState(6);
  const layerButtonRef = useRef<HTMLButtonElement>(null);

  // 7. UI & modals
  const [isFieldConfigOpen, setIsFieldConfigOpen] = useState(false);
  const [isBackendContractOpen, setIsBackendContractOpen] = useState(false);
  const [createFieldRequested, setCreateFieldRequested] = useState(false);
  const [gpsPosition, setGpsPosition] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeDuoBannerNotification, setActiveDuoBannerNotification] = useState<AgriculturalNotification | null>(null);
  const amiLauncherRef = useRef<HTMLButtonElement>(null);

  const ami = useAmiChat(activeField, {
    onGpsFix: (pos) => setGpsPosition(pos),
    onMapPickRequested: () => setActiveTab('weather'),
  });

  const persistFields = (updatedFields: SelectedField[]) => {
    setFields(updatedFields);
    localStorage.setItem('legum_registered_fields', JSON.stringify(updatedFields));
  };

  // PWA service worker + native notification click routing
  useEffect(() => {
    registerServiceWorker();
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === 'NAVIGATE_TAB' && event.data.tab) {
          setActiveTab(event.data.tab);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    }
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Radar frames
  useEffect(() => {
    fetchRainViewerRadar()
      .then((data) => {
        setRadarData(data);
        setRadarFrames([...data.past, ...data.nowcast]);
        setRadarFrameIndex(Math.max(0, data.past.length - 1));
      })
      .catch((err) => console.warn('Radar RainViewer indisponible:', err));
  }, []);

  // Weather of the inspected point (drives the map sheet and point layers)
  useEffect(() => {
    let isCancelled = false;
    async function loadCoordsWeather() {
      setIsWeatherLoading(true);
      setWeatherError(null);
      try {
        const [data, geo] = await Promise.all([
          fetchLocationWeather(selectedCoords.lat, selectedCoords.lng),
          reverseGeocodeFrance(selectedCoords.lat, selectedCoords.lng),
        ]);
        if (!isCancelled) {
          setWeatherData(data);
          setPointGeo({ commune: geo.commune, department: geo.department });
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setWeatherError(err instanceof Error ? err.message : 'Erreur chargement météo');
        }
      } finally {
        if (!isCancelled) setIsWeatherLoading(false);
      }
    }
    loadCoordsWeather();
    return () => {
      isCancelled = true;
    };
  }, [selectedCoords.lat, selectedCoords.lng]);

  // Weather of the selected FIELD (Home, Analyses, risk screening). Independent from the inspected point.
  useEffect(() => {
    let isCancelled = false;
    fetchLocationWeather(activeField.latitude, activeField.longitude)
      .then((data) => {
        if (!isCancelled) setFieldWeather(data);
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn('Météo de la parcelle indisponible:', err);
          setFieldWeather(null);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [activeField.id, activeField.latitude, activeField.longitude]);

  const pointOnField =
    distanceKm(selectedCoords.lat, selectedCoords.lng, activeField.latitude, activeField.longitude) < FIELD_RADIUS_KM;

  // Field selection
  const handleSelectActiveField = (field: SelectedField) => {
    setActiveField(field);
    setSelectedCoords({ lat: field.latitude, lng: field.longitude });
    localStorage.setItem('legum_active_field_id', field.id);
    showToast(`Parcelle active : "${field.name}"`);
  };

  const handleSaveField = (field: SelectedField) => {
    const existingIndex = fields.findIndex((f) => f.id === field.id);
    const updatedList =
      existingIndex >= 0 ? fields.map((f, i) => (i === existingIndex ? field : f)) : [field, ...fields];
    persistFields(updatedList);
    setActiveField(field);
    setSelectedCoords({ lat: field.latitude, lng: field.longitude });
    localStorage.setItem('legum_active_field_id', field.id);
    showToast(`Parcelle "${field.name}" enregistrée`);
  };

  const handleDeleteField = (fieldId: string) => {
    if (fields.length <= 1) {
      showToast('Impossible de supprimer la dernière parcelle.');
      return;
    }
    const filtered = fields.filter((f) => f.id !== fieldId);
    persistFields(filtered);
    if (activeField.id === fieldId) handleSelectActiveField(filtered[0]);
    showToast('Parcelle supprimée');
  };

  // Map click: inspects a point and, if Ami asked for it, gives Ami a position. Never moves the field.
  const applyMapPickRef = useRef(ami.applyMapPick);
  useEffect(() => {
    applyMapPickRef.current = ami.applyMapPick;
  });
  const handleSelectCoordinates = useCallback((lat: number, lng: number) => {
    applyMapPickRef.current(lat, lng);
    setSelectedCoords({ lat, lng });
  }, []);

  const handleSelectBasin = useCallback(
    (basin: FrenchAgriBasin) => {
      setSelectedCoords({ lat: basin.latitude, lng: basin.longitude });
      showToast(`Bassin ${basin.name} : prévision du point exploré`);
    },
    [showToast]
  );

  const handleLocateMe = async () => {
    setIsLocating(true);
    try {
      const pos = await getCurrentGPSPosition();
      if (!isWithinMetropolitanFrance(pos.latitude, pos.longitude)) {
        showToast('Votre position GPS est en dehors de la France métropolitaine.');
        return;
      }
      setGpsPosition(pos);
      setSelectedCoords({ lat: pos.latitude, lng: pos.longitude });
      showToast('Position GPS détectée. Ce point ne remplace pas votre parcelle.');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur géolocalisation');
    } finally {
      setIsLocating(false);
    }
  };

  const handleResetFranceView = () => {
    setSelectedCoords({ lat: FRANCE_CENTER[0], lng: FRANCE_CENTER[1] });
    showToast('Vue nationale France réinitialisée');
  };

  const handleBackToField = () => setSelectedCoords({ lat: activeField.latitude, lng: activeField.longitude });

  // Layers
  const handleOverlayChange = (id: OverlayId, patch: Partial<OverlayState>) => {
    setOverlays((prev) => {
      const next = { ...prev, [id]: { ...prev[id], ...patch } };
      localStorage.setItem(OVERLAYS_KEY, JSON.stringify(next));
      return next;
    });
  };
  const handleOverlayStatus = useCallback((id: OverlayId, status: LayerStatus) => {
    setOverlayStatus((prev) => (prev[id] === status ? prev : { ...prev, [id]: status }));
  }, []);

  // Notifications: forecast-backed alerts are derived from the current assessment of the selected field.
  const clientAlerts: AgriculturalRiskAlert[] =
    fieldWeather && activeField
      ? evaluateAgronomicRisks(activeField.cropType, activeField.growthStage, fieldWeather)
      : [];
  const { status: backendStatus, alerts: backendAlerts, response: backendResponse } = useBackendAssess(activeField);
  const agriAlerts: AgriculturalRiskAlert[] = backendStatus === 'ok' ? backendAlerts : clientAlerts;

  const forecastNotifications = useMemo<AgriculturalNotification[]>(
    () =>
      agriAlerts
        .filter((a) => a.severity !== 'favorable')
        .map((a) => {
          const id = `fc_${activeField.id}_${a.id}`;
          return {
            id,
            title: a.title,
            message: a.description,
            category: 'weather_risk' as const,
            severity: a.severity === 'critique' ? ('critical' as const) : ('warning' as const),
            fieldId: activeField.id,
            fieldName: activeField.name,
            cropType: activeField.cropType,
            growthStage: activeField.growthStage,
            timestamp: 'Prévision actuelle',
            isRead: readForecastIds.includes(id),
            actionLabel: "Voir l'analyse",
            actionDestination: 'insights' as const,
            provenance: 'forecast' as const,
          };
        }),
    [agriAlerts, activeField, readForecastIds]
  );
  const allNotifications = useMemo(
    () => [...forecastNotifications, ...notifications],
    [forecastNotifications, notifications]
  );
  const unreadNotifCount = allNotifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = (id: string) => {
    if (id.startsWith('fc_')) {
      setReadForecastIds((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id].slice(-100);
        localStorage.setItem(READ_FORECAST_KEY, JSON.stringify(next));
        return next;
      });
      return;
    }
    const updated = notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    setNotifications(updated);
    localStorage.setItem('legum_notifications', JSON.stringify(updated));
  };

  const handleMarkAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, isRead: true }));
    setNotifications(updated);
    localStorage.setItem('legum_notifications', JSON.stringify(updated));
    const ids = forecastNotifications.map((n) => n.id);
    setReadForecastIds((prev) => {
      const next = Array.from(new Set([...prev, ...ids])).slice(-100);
      localStorage.setItem(READ_FORECAST_KEY, JSON.stringify(next));
      return next;
    });
    showToast('Toutes les alertes sont marquées comme lues');
  };

  const handleTriggerSimulation = (notif: AgriculturalNotification) => {
    const simulated = { ...notif, provenance: 'simulated' as const };
    setNotifications((prev) => {
      const updated = [simulated, ...prev];
      localStorage.setItem('legum_notifications', JSON.stringify(updated));
      return updated;
    });
    setActiveDuoBannerNotification(simulated);
  };

  const handleOpenNotification = (n: AgriculturalNotification) => {
    if (!n.isRead) handleMarkAsRead(n.id);
    setNotifCenterOpen(false);
    setActiveTab(n.actionDestination ?? 'notifications');
  };

  const handleTabChange = (tab: AppTab) => {
    // Phones: the Alertes tab opens the notification sheet; its footer leads to the full history.
    if (tab === 'notifications' && isPhone && activeTab !== 'notifications') {
      setNotifCenterOpen((open) => !open);
      return;
    }
    setNotifCenterOpen(false);
    setLayerMenuOpen(false);
    setActiveTab(tab);
  };

  // Native OS notification for newly detected critical risks (local, while the app runs)
  useEffect(() => {
    if (!agriAlerts || agriAlerts.length === 0 || !activeField) return;
    const critical = agriAlerts.find((a) => a.severity === 'critique' || a.severity === 'alerte');
    if (!critical) return;
    const notifKey = `os_notif_${activeField.id}_${critical.id}_${new Date().toDateString()}`;
    if (sessionStorage.getItem(notifKey)) return;
    sessionStorage.setItem(notifKey, 'sent');
    dispatchNativePushNotification(`Légume'Ami : ${critical.title}`, {
      body: `Parcelle ${activeField.name} : ${critical.description}`,
      tag: `risk-${activeField.id}-${critical.id}`,
      data: { destination: 'insights', fieldId: activeField.id },
      promptIfDefault: false,
    });
  }, [agriAlerts, activeField]);

  const env = useSystemEnvironment();
  const currentRadarFrame = radarFrames[radarFrameIndex] || null;
  const activeOverlayCount = (Object.keys(overlays) as OverlayId[]).filter(
    (id) => id !== 'field' && overlays[id].enabled
  ).length;

  // Point value drawn on the map for temperature / wind / cloud layers (point forecast, not a raster).
  const pointValue = useMemo<PointValue | null>(() => {
    if (activeLayer === 'radar' || !weatherData || isWeatherLoading) return null;
    const c = weatherData.current;
    const base = { lat: selectedCoords.lat, lng: selectedCoords.lng };
    if (activeLayer === 'temperature') {
      return { ...base, primary: `${Math.round(c.temperature)}°C`, color: temperatureColor(c.temperature) };
    }
    if (activeLayer === 'wind') {
      return {
        ...base,
        primary: `${Math.round(c.windSpeed)} km/h`,
        color: windColor(c.windSpeed),
        rotation: (c.windDirection + 180) % 360,
      };
    }
    return { ...base, primary: `${Math.round(c.cloudCover)} %`, color: cloudColor(c.cloudCover) };
  }, [activeLayer, weatherData, isWeatherLoading, selectedCoords]);

  const layerChip = useMemo(() => {
    const def = PRIMARY_LAYERS.find((l) => l.id === activeLayer) ?? PRIMARY_LAYERS[0];
    if (activeLayer === 'radar') {
      const detail = currentRadarFrame
        ? `${currentRadarFrame.type === 'past' ? 'observé' : 'extrapolé'} ${new Date(
            currentRadarFrame.time * 1000
          ).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
        : 'indisponible';
      return { label: 'Radar de pluie', detail };
    }
    return { label: def.label, detail: 'prévision au point' };
  }, [activeLayer, currentRadarFrame]);

  return (
    <div
      data-tab={activeTab}
      className={`app-root relative w-screen h-screen overflow-hidden bg-gradient-to-b ${env.ambientBackgroundClass} text-white transition-colors duration-1000 ${
        isDarkMode ? 'dark' : ''
      } flex flex-col`}
    >
      <DesktopNavBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadCount={unreadNotifCount}
        fields={fields}
        activeField={activeField}
        onSelectActiveField={handleSelectActiveField}
        env={env}
        onOpenContractModal={() => setIsBackendContractOpen(true)}
        bellRef={bellRef}
        isNotificationsOpen={isNotifCenterOpen}
        onToggleNotifications={() => setNotifCenterOpen((open) => !open)}
      />

      <DuoNotificationBanner
        key={activeDuoBannerNotification?.id}
        notification={activeDuoBannerNotification}
        onDismiss={() => setActiveDuoBannerNotification(null)}
        onActionClick={(dest) => {
          setActiveTab(dest);
          setActiveDuoBannerNotification(null);
        }}
      />

      <main className="flex-1 min-h-0 w-full relative overflow-hidden flex flex-col">
        {/* 1. ACCUEIL */}
        {activeTab === 'home' && (
          <HomeView
            fields={fields}
            activeField={activeField}
            onSelectActiveField={handleSelectActiveField}
            weather={fieldWeather}
            alerts={agriAlerts}
            backendStatus={backendStatus}
            onNavigateToTab={setActiveTab}
            onOpenCreateField={() => {
              setCreateFieldRequested(true);
              setActiveTab('fields');
            }}
            onAskAmi={ami.openWithQuestion}
            currentHour={env.currentHour}
          />
        )}

        {/* 2. CARTE */}
        <div className={`w-full h-full absolute inset-0 ${activeTab === 'weather' ? 'block' : 'hidden'}`}>
          <WeatherMap
            isActive={activeTab === 'weather'}
            selectedField={activeField}
            selectedPoint={pointOnField ? null : selectedCoords}
            onSelectCoordinates={handleSelectCoordinates}
            activeLayer={activeLayer}
            radarHost={radarData?.host || 'https://tilecache.rainviewer.com'}
            currentRadarFrame={currentRadarFrame}
            gpsPosition={gpsPosition}
            isDarkMode={isDarkMode}
            onSelectBasin={handleSelectBasin}
            overlays={overlays}
            onOverlayStatus={handleOverlayStatus}
            onZoomChange={setMapZoom}
            pointValue={pointValue}
            pickMode={ami.mapPickActive}
          />

          <MapControls
            layerChip={layerChip}
            isLayerMenuOpen={isLayerMenuOpen}
            onToggleLayerMenu={() => setLayerMenuOpen((open) => !open)}
            layerButtonRef={layerButtonRef}
            activeOverlayCount={activeOverlayCount}
            onLocateMe={handleLocateMe}
            isLocating={isLocating}
            onResetFranceView={handleResetFranceView}
            isDarkMode={isDarkMode}
            onToggleTheme={() => setIsDarkMode(!isDarkMode)}
            onRefreshWeather={() => setSelectedCoords((prev) => ({ ...prev }))}
            isRefreshing={isWeatherLoading}
            isCached={weatherData?.isCached || false}
            dataSource={weatherData?.dataSource || 'Météo-France'}
          />

          <MapLayerMenu
            isOpen={isLayerMenuOpen && activeTab === 'weather'}
            onClose={() => setLayerMenuOpen(false)}
            returnFocusRef={layerButtonRef}
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
            overlays={overlays}
            overlayStatus={overlayStatus}
            onOverlayChange={handleOverlayChange}
            zoom={mapZoom}
            radarFrame={currentRadarFrame}
            weather={weatherData}
            fieldHasPolygon={Boolean(activeField.polygonCoordinates && activeField.polygonCoordinates.length >= 3)}
            onResetFranceView={handleResetFranceView}
            isDarkMode={isDarkMode}
            onToggleTheme={() => setIsDarkMode(!isDarkMode)}
          />

          {ami.mapPickActive && (
            <div
              role="status"
              data-testid="ami-pick-banner"
              className="absolute top-16 left-1/2 -translate-x-1/2 z-[570] apple-glass rounded-full pl-4 pr-2 py-2 flex items-center gap-3 text-xs shadow-2xl"
            >
              <span>Touchez la carte pour choisir le point d'Ami</span>
              <button
                type="button"
                onClick={ami.cancelMapPick}
                className="px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 font-semibold"
              >
                Annuler
              </button>
            </div>
          )}

          <div className="absolute top-16 left-4 z-[390] hidden lg:block max-w-xl">
            <QuickBasins onSelectBasin={handleSelectBasin} selectedBasinId={activeField?.id} />
          </div>

          {activeLayer === 'radar' && radarFrames.length > 0 && (
            <div className="map-radar-timeline flex flex-col items-center gap-2 pointer-events-auto" data-testid="radar-timeline">
              <div className="max-md:hidden">
                <IntensityLegend />
              </div>
              <RadarTimeline
                frames={radarFrames}
                currentIndex={radarFrameIndex}
                isPlaying={isRadarPlaying}
                onIndexChange={setRadarFrameIndex}
                onTogglePlay={() => setIsRadarPlaying(!isRadarPlaying)}
              />
            </div>
          )}

          <WeatherSheet
            weather={weatherData}
            isLoading={isWeatherLoading}
            error={weatherError}
            selectedField={activeField}
            agriAlerts={agriAlerts}
            onOpenFieldConfig={() => setIsFieldConfigOpen(true)}
            onOpenBackendContract={() => setIsBackendContractOpen(true)}
            pointMode={!pointOnField}
            pointLabel={pointGeo?.commune}
            onBackToField={handleBackToField}
          />
        </div>

        {/* 3. PARCELLES */}
        {activeTab === 'fields' && (
          <MyFieldsView
            fields={fields}
            activeField={activeField}
            onSelectActiveField={handleSelectActiveField}
            onSaveField={handleSaveField}
            onDeleteField={handleDeleteField}
            autoOpenCreate={createFieldRequested}
            onAutoOpenHandled={() => setCreateFieldRequested(false)}
          />
        )}

        {/* 4. ANALYSES */}
        {activeTab === 'insights' && (
          <ForecastInsightsView
            weather={fieldWeather}
            field={activeField}
            alerts={agriAlerts}
            backendStatus={backendStatus}
            backendResponse={backendResponse}
            onOpenFieldConfig={() => setIsFieldConfigOpen(true)}
            onAskAmi={ami.openWithQuestion}
          />
        )}

        {/* 5. ALERTES */}
        {activeTab === 'notifications' && (
          <NotificationsView
            notifications={allNotifications}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onNavigateToTab={setActiveTab}
            onTriggerSimulation={handleTriggerSimulation}
          />
        )}
      </main>

      {/* Phones: persistent iOS tab bar */}
      <div className="md:hidden">
        <AppleTabBar activeTab={activeTab} onTabChange={handleTabChange} unreadCount={unreadNotifCount} />
      </div>

      <AmiLauncher
        ref={amiLauncherRef}
        isOpen={ami.isOpen}
        onToggle={ami.toggle}
        contextLabel={ami.contextLabel}
        hasMessages={ami.messages.length > 0}
      />
      <AmiChatPanel
        ami={ami}
        fields={fields}
        activeField={activeField}
        onSelectField={handleSelectActiveField}
        returnFocusRef={amiLauncherRef}
      />

      <NotificationCenter
        isOpen={isNotifCenterOpen}
        onClose={() => setNotifCenterOpen(false)}
        notifications={allNotifications}
        onOpenItem={handleOpenNotification}
        onMarkAllAsRead={handleMarkAllAsRead}
        onOpenAll={() => {
          setNotifCenterOpen(false);
          setActiveTab('notifications');
        }}
        anchorRef={bellRef}
      />

      {/* The modal edits the SELECTED FIELD, never the inspected map point. */}
      <FieldConfigModal
        isOpen={isFieldConfigOpen}
        onClose={() => setIsFieldConfigOpen(false)}
        currentField={activeField}
        latitude={activeField.latitude}
        longitude={activeField.longitude}
        commune={activeField.commune}
        onSaveField={handleSaveField}
      />

      <BackendContractModal isOpen={isBackendContractOpen} onClose={() => setIsBackendContractOpen(false)} />

      <PwaInstallBanner />

      {toastMessage && (
        <div
          role="status"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[800] apple-glass px-4 py-2 rounded-full shadow-2xl text-xs text-white font-medium animate-in fade-in duration-200"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default App;
