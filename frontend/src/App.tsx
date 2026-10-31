import React, { useState, useEffect, useCallback } from 'react';
import { WeatherMap } from './components/Map/WeatherMap';
import { MapControls } from './components/Map/MapControls';
import { RadarTimeline } from './components/RadarTimeline/RadarTimeline';
import { IntensityLegend } from './components/RadarTimeline/IntensityLegend';
import { WeatherSheet } from './components/WeatherSheet/WeatherSheet';
import { FieldConfigModal } from './components/WeatherSheet/FieldConfigModal';
import { BackendContractModal } from './components/Navigation/BackendContractModal';
import { PwaInstallBanner } from './components/Navigation/PwaInstallBanner';
import { QuickBasins } from './components/Navigation/QuickBasins';
import { AppleTabBar } from './components/Navigation/AppleTabBar';
import type { AppTab } from './components/Navigation/AppleTabBar';
import { HarvestIntelligenceView } from './components/Harvest/HarvestIntelligenceView';
import { CircularValorizationView } from './components/Circular/CircularValorizationView';
import { BedrockCopilotView } from './components/Copilot/BedrockCopilotView';

import type { WeatherLayerType, LocationWeatherData, RadarData, RadarFrame } from './types/weather';
import type { SelectedField, AgriculturalRiskAlert } from './types/agricultural';
import { FRENCH_AGRI_BASINS } from './data/frenchAgriBasins';
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

export const App: React.FC = () => {
  // 1. Navigation Tab State
  const [activeTab, setActiveTab] = useState<AppTab>('weather');

  // 2. Core Coordinates & Weather State
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>({
    lat: FRENCH_AGRI_BASINS[0].latitude,
    lng: FRENCH_AGRI_BASINS[0].longitude,
  });

  const [activeLayer, setActiveLayer] = useState<WeatherLayerType>('radar');
  const [weatherData, setWeatherData] = useState<LocationWeatherData | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // 3. Field & Crop State
  const [selectedField, setSelectedField] = useState<SelectedField | null>(() => {
    const saved = localStorage.getItem('legum_active_field');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {
      id: 'default_field',
      name: 'Parcelle Lauragais (Castelnaudary)',
      latitude: FRENCH_AGRI_BASINS[0].latitude,
      longitude: FRENCH_AGRI_BASINS[0].longitude,
      commune: 'Castelnaudary',
      departmentCode: '11',
      cropType: 'pois_chiche',
      growthStage: 'floraison',
      areaHectares: 14,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  const [isFieldConfigOpen, setIsFieldConfigOpen] = useState(false);
  const [isBackendContractOpen, setIsBackendContractOpen] = useState(false);

  // 4. Radar State
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [radarFrames, setRadarFrames] = useState<RadarFrame[]>([]);
  const [radarFrameIndex, setRadarFrameIndex] = useState<number>(0);
  const [isRadarPlaying, setIsRadarPlaying] = useState<boolean>(false);

  // 5. GPS & UI State
  const [gpsPosition, setGpsPosition] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  // Fetch Weather for selected coordinates
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
          setSelectedField((prev) => {
            if (!prev) return null;
            const updated = {
              ...prev,
              commune: geo.commune,
              departmentCode: geo.department,
            };
            localStorage.setItem('legum_active_field', JSON.stringify(updated));
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

  // Handle map click
  const handleSelectCoordinates = useCallback((lat: number, lng: number) => {
    setSelectedCoords({ lat, lng });

    setSelectedField((prev) => {
      if (!prev) return null;
      const updated = {
        ...prev,
        latitude: lat,
        longitude: lng,
      };
      localStorage.setItem('legum_active_field', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Handle Basin selection
  const handleSelectBasin = useCallback(
    (basin: FrenchAgriBasin) => {
      setSelectedCoords({ lat: basin.latitude, lng: basin.longitude });

      const updated: SelectedField = {
        id: `basin_${basin.id}`,
        name: `Bassin ${basin.name}`,
        latitude: basin.latitude,
        longitude: basin.longitude,
        commune: basin.name,
        departmentCode: basin.department.match(/\(([^)]+)\)/)?.[1] || 'FR',
        cropType: basin.typicalCrops[0] || 'pois_chiche',
        growthStage: 'floraison',
        areaHectares: 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSelectedField(updated);
      localStorage.setItem('legum_active_field', JSON.stringify(updated));
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

  // Handle Save Field
  const handleSaveField = (field: SelectedField) => {
    setSelectedField(field);
    localStorage.setItem('legum_active_field', JSON.stringify(field));
    showToast(`Parcelle "${field.name}" enregistrée`);
  };

  // Evaluate Agronomic Risks
  const agriAlerts: AgriculturalRiskAlert[] =
    weatherData && selectedField
      ? evaluateAgronomicRisks(selectedField.cropType, selectedField.growthStage, weatherData)
      : [];

  const currentRadarFrame = radarFrames[radarFrameIndex] || null;

  return (
    <div className={`relative w-screen h-screen overflow-hidden bg-[#0b0f19] ${isDarkMode ? 'dark' : ''}`}>
      {/* Tab 1: Interactive France Weather Map */}
      <div className={`w-full h-full relative ${activeTab === 'weather' ? 'block' : 'hidden'}`}>
        <WeatherMap
          selectedField={selectedField}
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
            selectedBasinId={selectedField?.id.replace('basin_', '')}
          />
        </div>

        {/* Radar Animation Scrubber (When radar is active) */}
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

        {/* Apple Weather Bottom Sheet / Floating Panel */}
        <WeatherSheet
          weather={weatherData}
          isLoading={isWeatherLoading}
          error={weatherError}
          selectedField={selectedField}
          agriAlerts={agriAlerts}
          onOpenFieldConfig={() => setIsFieldConfigOpen(true)}
          onOpenBackendContract={() => setIsBackendContractOpen(true)}
        />
      </div>

      {/* Tab 2: Harvest Window ML Intelligence */}
      {activeTab === 'harvest' && (
        <HarvestIntelligenceView
          weather={weatherData}
          field={selectedField}
          onOpenFieldConfig={() => setIsFieldConfigOpen(true)}
        />
      )}

      {/* Tab 3: Circular Economy & Downgraded Crops */}
      {activeTab === 'circular' && (
        <CircularValorizationView />
      )}

      {/* Tab 4: Bedrock Agronomic Copilot */}
      {activeTab === 'copilot' && (
        <BedrockCopilotView field={selectedField} />
      )}

      {/* Persistent Native Apple iOS Tab Bar */}
      <AppleTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Field Configuration Modal */}
      <FieldConfigModal
        isOpen={isFieldConfigOpen}
        onClose={() => setIsFieldConfigOpen(false)}
        currentField={selectedField}
        latitude={selectedCoords.lat}
        longitude={selectedCoords.lng}
        commune={selectedField?.commune}
        onSaveField={handleSaveField}
      />

      {/* Backend Contract Modal */}
      <BackendContractModal
        isOpen={isBackendContractOpen}
        onClose={() => setIsBackendContractOpen(false)}
      />

      {/* PWA Install Banner */}
      <PwaInstallBanner />

      {/* Feedback Toast */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[800] apple-glass px-4 py-2 rounded-full shadow-2xl text-xs text-white font-medium animate-in fade-in duration-200">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default App;
