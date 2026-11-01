import React, { useState, useEffect, useCallback } from 'react';
import { HomeView } from './components/Home/HomeView';
import { WeatherMap } from './components/Map/WeatherMap';
import { MapControls } from './components/Map/MapControls';
import type { MapOverlayState } from './components/Map/MapControls';
import { RadarTimeline } from './components/RadarTimeline/RadarTimeline';
import { IntensityLegend } from './components/RadarTimeline/IntensityLegend';
import { WeatherSheet } from './components/WeatherSheet/WeatherSheet';
import { MyFieldsView } from './components/Fields/MyFieldsView';
import { ForecastInsightsView } from './components/Insights/ForecastInsightsView';
import { NotificationsView } from './components/Notifications/NotificationsView';
import { NotificationCenterPopover } from './components/Notifications/NotificationCenterPopover';
import { AmiFloatingChat } from './components/Chat/AmiFloatingChat';
import { DuoNotificationBanner } from './components/Notifications/DuoNotificationBanner';
import { AppleTabBar } from './components/Navigation/AppleTabBar';
import type { AppTab } from './components/Navigation/AppleTabBar';
import { DesktopNavBar } from './components/Navigation/DesktopNavBar';
import { useSystemEnvironment } from './hooks/useSystemEnvironment';
import { FieldConfigModal } from './components/WeatherSheet/FieldConfigModal';
import { BackendContractModal } from './components/Navigation/BackendContractModal';
import { PwaInstallBanner } from './components/Navigation/PwaInstallBanner';
import { QuickBasins } from './components/Navigation/QuickBasins';

import type { WeatherLayerType, LocationWeatherData, RadarData, RadarFrame } from './types/weather';
import type { SelectedField, AgriculturalRiskAlert, AgriculturalNotification } from './types/agricultural';
import type { FrenchAgriBasin } from './data/frenchAgriBasins';
import { fetchLocationWeather } from './services/weatherApi';
import { fetchRainViewerRadar } from './services/radarApi';
import {
  isWithinMetropolitanFrance,
  getCurrentGPSPosition,
  reverseGeocodeFrance,
  FRANCE_CENTER,
} from './services/geoService';
import { evaluateAgronomicRisks } from './services/agriRiskService';
import { useBackendAssess } from './hooks/useBackendAssess';
import { generateDuolingoNotificationsForFields } from './services/duoNotificationService';
import { registerServiceWorker } from './services/pwaService';
import { dispatchNativePushNotification } from './services/pushNotificationService';

// Default initial farm parcels (representative French legume terroirs)
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

// Initial realistic agricultural notifications generated with Duolingo engagement mechanics
// directly tailored to the crops currently present on the farm
const INITIAL_NOTIFICATIONS: AgriculturalNotification[] =
  generateDuolingoNotificationsForFields(INITIAL_FIELDS);

export const App: React.FC = () => {
  // 1. Navigation Tab State
  const [activeTab, setActiveTab] = useState<AppTab>('weather');

  // 2. Farm Parcels State
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

  // 3. Notifications State
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

  // 4. Coordinates & Weather State (tied to activeField)
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>({
    lat: activeField.latitude,
    lng: activeField.longitude,
  });

  const [activeLayer, setActiveLayer] = useState<WeatherLayerType>('radar');
  const [mapOverlays, setMapOverlays] = useState<MapOverlayState>({ soil: false, rpg: false, admin: false, opacity: 0.65 });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [weatherData, setWeatherData] = useState<LocationWeatherData | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // 5. Radar State
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [radarFrames, setRadarFrames] = useState<RadarFrame[]>([]);
  const [radarFrameIndex, setRadarFrameIndex] = useState<number>(0);
  const [isRadarPlaying, setIsRadarPlaying] = useState<boolean>(false);

  // 6. UI & Modals State
  const [isFieldConfigOpen, setIsFieldConfigOpen] = useState(false);
  const [isBackendContractOpen, setIsBackendContractOpen] = useState(false);
  const [gpsPosition, setGpsPosition] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeDuoBannerNotification, setActiveDuoBannerNotification] = useState<AgriculturalNotification | null>(null);

  // Save fields when updated
  const persistFields = (updatedFields: SelectedField[]) => {
    setFields(updatedFields);
    localStorage.setItem('legum_registered_fields', JSON.stringify(updatedFields));
  };

  // Register PWA service worker on boot & handle native push clicks
  useEffect(() => {
    registerServiceWorker();

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === 'NAVIGATE_TAB' && event.data.tab) {
          setActiveTab(event.data.tab);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }
  }, []);

  // Show auto-dismissing toast
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Fetch Radar Frames
  useEffect(() => {
    fetchRainViewerRadar()
      .then((data) => {
        setRadarData(data);
        const combined = [...data.past, ...data.nowcast];
        setRadarFrames(combined);
        const latestPastIdx = Math.max(0, data.past.length - 1);
        setRadarFrameIndex(latestPastIdx);
      })
      .catch((err) => {
        console.warn('Radar RainViewer indisponible:', err);
      });
  }, []);

  // Fetch Weather whenever coordinates change
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

          // Update active field commune if empty or changed
          setActiveField((prev) => {
            if (!prev) return prev;
            const updated = {
              ...prev,
              commune: geo.commune || prev.commune,
              departmentCode: geo.department || prev.departmentCode,
            };
            return updated;
          });
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const errorMsg = err instanceof Error ? err.message : 'Erreur chargement météo';
          setWeatherError(errorMsg);
        }
      } finally {
        if (!isCancelled) {
          setIsWeatherLoading(false);
        }
      }
    }

    loadCoordsWeather();

    return () => {
      isCancelled = true;
    };
  }, [selectedCoords.lat, selectedCoords.lng]);

  // Handle active field selection
  const handleSelectActiveField = (field: SelectedField) => {
    setActiveField(field);
    setSelectedCoords({ lat: field.latitude, lng: field.longitude });
    localStorage.setItem('legum_active_field_id', field.id);
    showToast(`Parcelle active : "${field.name}"`);
  };

  // Handle saving (creating or editing) a field
  const handleSaveField = (field: SelectedField) => {
    const existingIndex = fields.findIndex((f) => f.id === field.id);
    let updatedList: SelectedField[];
    if (existingIndex >= 0) {
      updatedList = [...fields];
      updatedList[existingIndex] = field;
    } else {
      updatedList = [field, ...fields];
    }

    persistFields(updatedList);
    setActiveField(field);
    setSelectedCoords({ lat: field.latitude, lng: field.longitude });
    localStorage.setItem('legum_active_field_id', field.id);
    showToast(`Parcelle "${field.name}" enregistrée`);
  };

  // Handle deleting a field
  const handleDeleteField = (fieldId: string) => {
    if (fields.length <= 1) {
      showToast('Impossible de supprimer la dernière parcelle.');
      return;
    }
    const filtered = fields.filter((f) => f.id !== fieldId);
    persistFields(filtered);
    if (activeField.id === fieldId) {
      handleSelectActiveField(filtered[0]);
    }
    showToast('Parcelle supprimée');
  };

  // Handle Map Click
  const handleSelectCoordinates = useCallback((lat: number, lng: number) => {
    setSelectedCoords({ lat, lng });

    setActiveField((prev) => {
      const updated = {
        ...prev,
        latitude: lat,
        longitude: lng,
      };
      return updated;
    });
  }, []);

  // Handle Basin Selection
  const handleSelectBasin = useCallback(
    (basin: FrenchAgriBasin) => {
      setSelectedCoords({ lat: basin.latitude, lng: basin.longitude });

      setActiveField((prev) => ({
        ...prev,
        latitude: basin.latitude,
        longitude: basin.longitude,
        commune: basin.name.split(' ')[0],
        departmentCode: basin.department.match(/\(([^)]+)\)/)?.[1] || 'FR',
      }));

      showToast(`Bassin ${basin.name} sélectionné`);
    },
    [showToast]
  );

  // Handle GPS Locate Me
  const handleLocateMe = async () => {
    setIsLocating(true);
    try {
      const pos = await getCurrentGPSPosition();
      if (!isWithinMetropolitanFrance(pos.latitude, pos.longitude)) {
        showToast('Votre position GPS est en dehors de la France métropolitaine.');
        return;
      }
      setGpsPosition(pos);
      handleSelectCoordinates(pos.latitude, pos.longitude);
      showToast('Position GPS détectée avec succès.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur géolocalisation';
      showToast(msg);
    } finally {
      setIsLocating(false);
    }
  };

  // Handle Reset to France National View
  const handleResetFranceView = () => {
    setSelectedCoords({ lat: FRANCE_CENTER[0], lng: FRANCE_CENTER[1] });
    showToast('Vue nationale France réinitialisée');
  };

  // Handle notification read
  const handleMarkAsRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    setNotifications(updated);
    localStorage.setItem('legum_notifications', JSON.stringify(updated));
  };

  const handleMarkAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, isRead: true }));
    setNotifications(updated);
    localStorage.setItem('legum_notifications', JSON.stringify(updated));
    showToast('Toutes les alertes sont marquées comme lues');
  };

  // Handle Duolingo simulation trigger
  const handleTriggerSimulation = (notif: AgriculturalNotification) => {
    setNotifications((prev) => {
      const updated = [notif, ...prev];
      localStorage.setItem('legum_notifications', JSON.stringify(updated));
      return updated;
    });
    setActiveDuoBannerNotification(notif);
  };

  // Evaluate Agronomic Risks for active field.
  // Prefer the live backend /assess (sourced rules + provenance) when
  // VITE_API_BASE_URL is configured and reachable; otherwise fall back to the
  // sourced client-side screening. Both paths avoid fabricated values.
  const clientAlerts: AgriculturalRiskAlert[] =
    weatherData && activeField
      ? evaluateAgronomicRisks(activeField.cropType, activeField.growthStage, weatherData)
      : [];
  const { status: backendStatus, alerts: backendAlerts, response: backendResponse } = useBackendAssess(activeField);
  const agriAlerts: AgriculturalRiskAlert[] =
    backendStatus === 'ok' ? backendAlerts : clientAlerts;

  // Dispatch real native OS notification for newly detected critical agronomic risks
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

  const handlePrimaryTabChange = (tab: AppTab) => {
    if (tab === 'notifications') { setNotificationsOpen((v) => !v); return; }
    setNotificationsOpen(false);
    setActiveTab(tab);
  };

  const env = useSystemEnvironment();
  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;
  const currentRadarFrame = radarFrames[radarFrameIndex] || null;

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden bg-gradient-to-b ${env.ambientBackgroundClass} text-white transition-colors duration-1000 ${
        isDarkMode ? 'dark' : ''
      } flex flex-col`}
    >
      {/* Desktop Top Navigation Bar (Visible on tablet & desktop) */}
      <DesktopNavBar
        activeTab={activeTab}
        onTabChange={handlePrimaryTabChange}
        unreadCount={unreadNotifCount}
        fields={fields}
        activeField={activeField}
        onSelectActiveField={handleSelectActiveField}
        env={env}
        onOpenContractModal={() => setIsBackendContractOpen(true)}
      />

      {notificationsOpen && (
        <NotificationCenterPopover
          notifications={notifications}
          onClose={() => setNotificationsOpen(false)}
          onMarkRead={handleMarkAsRead}
          onMarkAllRead={handleMarkAllAsRead}
          onOpenHistory={() => { setNotificationsOpen(false); setActiveTab('notifications'); }}
          onNavigate={(tab) => { setNotificationsOpen(false); setActiveTab(tab); }}
        />
      )}

      {/* Duolingo-style iOS Dynamic Island Push Banner */}
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
        {/* 1. DESTINATION: HOME DASHBOARD */}
        {activeTab === 'home' && (
          <HomeView
            fields={fields}
            activeField={activeField}
            onSelectActiveField={handleSelectActiveField}
            weather={weatherData}
            backendResponse={backendResponse}
            backendStatus={backendStatus}
            alerts={agriAlerts}
            onNavigateToTab={setActiveTab}
            onOpenCreateField={() => {
              setActiveTab('fields');
            }}
            currentHour={env.currentHour}
          />
        )}

      {/* 2. DESTINATION: WEATHER MAP MODULE */}
      <div className={`w-full h-full absolute inset-0 ${activeTab === 'weather' ? 'block' : 'hidden'}`}>
        <WeatherMap
          isActive={activeTab === 'weather'}
          overlays={mapOverlays}
          weather={weatherData}
          selectedField={activeField}
          onSelectCoordinates={handleSelectCoordinates}
          activeLayer={activeLayer}
          radarHost={radarData?.host || 'https://tilecache.rainviewer.com'}
          currentRadarFrame={currentRadarFrame}
          gpsPosition={gpsPosition}
          isDarkMode={isDarkMode}
          onSelectBasin={handleSelectBasin}
        />

        <MapControls
          weather={weatherData}
          activeLayer={activeLayer}
          overlays={mapOverlays}
          onOverlaysChange={setMapOverlays}
          onLayerChange={setActiveLayer}
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

        {/* Pulse Basins Horizontal Bar (Desktop) */}
        <div className="absolute top-16 left-4 z-[390] hidden lg:block max-w-xl">
          <QuickBasins
            onSelectBasin={handleSelectBasin}
            selectedBasinId={activeField?.id}
          />
        </div>

        {/* Radar Animation Scrubber (When radar layer is active) */}
        {activeLayer === 'radar' && radarFrames.length > 0 && (
          <div className="map-radar-timeline absolute bottom-36 sm:bottom-6 left-1/2 -translate-x-1/2 z-[420] flex flex-col items-center gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-auto">
            <IntensityLegend />
            <RadarTimeline
              frames={radarFrames}
              currentIndex={radarFrameIndex}
              isPlaying={isRadarPlaying}
              onIndexChange={setRadarFrameIndex}
              onTogglePlay={() => setIsRadarPlaying(!isRadarPlaying)}
            />
          </div>
        )}

        {/* Apple Weather Bottom Sheet / Contextual Floating Panel */}
        <WeatherSheet
          weather={weatherData}
          isLoading={isWeatherLoading}
          error={weatherError}
          selectedField={activeField}
          agriAlerts={agriAlerts}
          onOpenFieldConfig={() => setIsFieldConfigOpen(true)}
          onOpenBackendContract={() => setIsBackendContractOpen(true)}
        />
      </div>

      {/* 3. DESTINATION: MY FIELDS & ONBOARDING */}
      {activeTab === 'fields' && (
        <MyFieldsView
          fields={fields}
          activeField={activeField}
          onSelectActiveField={handleSelectActiveField}
          onSaveField={handleSaveField}
          onDeleteField={handleDeleteField}
        />
      )}

      {/* 4. DESTINATION: FORECAST & SCIENTIFIC INSIGHTS */}
      {activeTab === 'insights' && (
        <ForecastInsightsView
          weather={weatherData}
          field={activeField}
          alerts={agriAlerts}
          backendStatus={backendStatus}
          backendResponse={backendResponse}
          onOpenFieldConfig={() => setIsFieldConfigOpen(true)}
        />
      )}

      {/* 5. DESTINATION: NOTIFICATIONS & ALERTS */}
      {activeTab === 'notifications' && (
        <NotificationsView
          notifications={notifications}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
          onNavigateToTab={setActiveTab}
          onTriggerSimulation={handleTriggerSimulation}
        />
      )}
      </main>

      {/* Persistent Native Apple iOS Tab Bar (Mobile only) */}
      <div className="md:hidden">
        <AppleTabBar
          activeTab={activeTab}
          onTabChange={handlePrimaryTabChange}
          unreadCount={unreadNotifCount}
        />
      </div>

      {/* Field Configuration Modal (Accessible from anywhere) */}
      <FieldConfigModal
        isOpen={isFieldConfigOpen}
        onClose={() => setIsFieldConfigOpen(false)}
        currentField={activeField}
        latitude={selectedCoords.lat}
        longitude={selectedCoords.lng}
        commune={activeField?.commune}
        onSaveField={handleSaveField}
      />

      {/* Backend Contract Modal (FastAPI / Kiro) */}
      <BackendContractModal
        isOpen={isBackendContractOpen}
        onClose={() => setIsBackendContractOpen(false)}
      />

      {/* Global context-aware Bedrock adviser persists across all five tabs. */}
      <AmiFloatingChat field={activeField} />

      {/* PWA Install Prompt Banner */}
      <PwaInstallBanner />

      {/* Floating Feedback Toast */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[800] apple-glass px-4 py-2 rounded-full shadow-2xl text-xs text-white font-medium animate-in fade-in duration-200">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default App;
