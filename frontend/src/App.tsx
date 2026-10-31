import React, { useState, useEffect, useCallback } from 'react';
import { HomeView } from './components/Home/HomeView';
import { WeatherMap } from './components/Map/WeatherMap';
import { MapControls } from './components/Map/MapControls';
import { RadarTimeline } from './components/RadarTimeline/RadarTimeline';
import { IntensityLegend } from './components/RadarTimeline/IntensityLegend';
import { WeatherSheet } from './components/WeatherSheet/WeatherSheet';
import { MyFieldsView } from './components/Fields/MyFieldsView';
import { ForecastInsightsView } from './components/Insights/ForecastInsightsView';
import { NotificationsView } from './components/Notifications/NotificationsView';
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
import { registerServiceWorker } from './services/pwaService';

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

// Initial realistic agricultural notifications
const INITIAL_NOTIFICATIONS: AgriculturalNotification[] = [
  {
    id: 'notif_1',
    title: 'Alerte Thermique sur Floraison',
    message: 'Température prévue à 29°C cet après-midi sur votre parcelle de pois chiches à Castelnaudary. Risque d\'avortement floral. Évitez toute intervention foliaire.',
    category: 'weather_risk',
    severity: 'warning',
    fieldName: 'Parcelle du Moulin (Lauragais)',
    timestamp: 'Il y a 2h',
    isRead: false,
    actionLabel: 'Analyser le risque',
    actionDestination: 'insights',
  },
  {
    id: 'notif_2',
    title: 'Créneau de Pulvérisation Favorable',
    message: 'Vent inférieur à 12 km/h et hygrométrie optimale (65%) jusqu\'à 11h30. Fenêtre idéale pour tout traitement autorisé.',
    category: 'weather_risk',
    severity: 'info',
    fieldName: 'Champ des Vignes (Beauce)',
    timestamp: 'Il y a 4h',
    isRead: false,
    actionLabel: 'Voir la météo',
    actionDestination: 'weather',
  },
  {
    id: 'notif_3',
    title: 'Suivi Phénologique Recommandé',
    message: 'Vos féveroles en Beauce approchent-elles du stade remplissage du grain ? Mettez à jour le stade pour affiner les alertes d\'échaudage.',
    category: 'stage_update',
    severity: 'info',
    fieldName: 'Champ des Vignes (Beauce)',
    timestamp: 'Hier',
    isRead: true,
    actionLabel: 'Mettre à jour le stade',
    actionDestination: 'fields',
  },
  {
    id: 'notif_4',
    title: 'Fenêtre de Moisson en Vue',
    message: 'Dessiccation favorable prévue jeudi et vendredi (humidité grain projetée à 14.1%). Préparez votre chantier de battage.',
    category: 'harvest_window',
    severity: 'info',
    fieldName: 'Les Terres Rouges (Berry)',
    timestamp: 'Il y a 2 jours',
    isRead: true,
    actionLabel: 'Consulter l\'échéancier',
    actionDestination: 'insights',
  },
];

export const App: React.FC = () => {
  // 1. Navigation Tab State
  const [activeTab, setActiveTab] = useState<AppTab>('home');

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

  // Save fields when updated
  const persistFields = (updatedFields: SelectedField[]) => {
    setFields(updatedFields);
    localStorage.setItem('legum_registered_fields', JSON.stringify(updatedFields));
  };

  // Register PWA service worker on boot
  useEffect(() => {
    registerServiceWorker();
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

  // Evaluate Agronomic Risks for active field
  const agriAlerts: AgriculturalRiskAlert[] =
    weatherData && activeField
      ? evaluateAgronomicRisks(activeField.cropType, activeField.growthStage, weatherData)
      : [];

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
        onTabChange={setActiveTab}
        unreadCount={unreadNotifCount}
        fields={fields}
        activeField={activeField}
        onSelectActiveField={handleSelectActiveField}
        env={env}
        onOpenContractModal={() => setIsBackendContractOpen(true)}
      />

      <main className="flex-1 w-full h-full relative overflow-hidden flex flex-col">
        {/* 1. DESTINATION: HOME DASHBOARD */}
        {activeTab === 'home' && (
          <HomeView
            fields={fields}
            activeField={activeField}
            onSelectActiveField={handleSelectActiveField}
            weather={weatherData}
            alerts={agriAlerts}
            onNavigateToTab={setActiveTab}
            onOpenCreateField={() => {
              setActiveTab('fields');
            }}
          />
        )}

      {/* 2. DESTINATION: WEATHER MAP MODULE */}
      <div className={`w-full h-full relative ${activeTab === 'weather' ? 'block' : 'hidden'}`}>
        <WeatherMap
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
          activeLayer={activeLayer}
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
          <div className="absolute bottom-36 sm:bottom-6 left-1/2 -translate-x-1/2 z-[420] flex flex-col items-center gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-auto">
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
        />
      )}
      </main>

      {/* Persistent Native Apple iOS Tab Bar (Mobile only) */}
      <div className="md:hidden">
        <AppleTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
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
