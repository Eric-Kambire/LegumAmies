import React from 'react';
import { Navigation, Sun, Moon, RefreshCw, Layers2 } from 'lucide-react';

interface MapControlsProps {
  layerChip: { label: string; detail: string };
  isLayerMenuOpen: boolean;
  onToggleLayerMenu: () => void;
  layerButtonRef?: React.RefObject<HTMLButtonElement | null>;
  activeOverlayCount: number;
  onLocateMe: () => void;
  isLocating: boolean;
  onResetFranceView: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onRefreshWeather: () => void;
  isRefreshing: boolean;
  isCached: boolean;
  dataSource: string;
}

const roundBtn =
  'w-11 h-11 rounded-full apple-glass flex items-center justify-center text-white/90 shadow-xl transition-all active:scale-90 disabled:opacity-50';

export const MapControls: React.FC<MapControlsProps> = ({
  layerChip,
  isLayerMenuOpen,
  onToggleLayerMenu,
  layerButtonRef,
  activeOverlayCount,
  onLocateMe,
  isLocating,
  onResetFranceView,
  isDarkMode,
  onToggleTheme,
  onRefreshWeather,
  isRefreshing,
  isCached,
  dataSource,
}) => (
  <>
    {/* Top-left: what the map is currently showing (one discreet chip instead of a segmented bar) */}
    <div
      className="absolute top-3 left-3 z-[400] max-w-[calc(100%-5rem)] apple-glass rounded-full px-3.5 py-1.5 text-xs text-white shadow-lg flex items-center gap-2 pointer-events-none"
      data-testid="map-layer-chip"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] flex-shrink-0" aria-hidden="true" />
      <span className="font-semibold truncate">{layerChip.label}</span>
      <span className="text-white/55 truncate hidden min-[420px]:inline">{layerChip.detail}</span>
    </div>

    {/* Top-right: Apple-Maps style round actions. The first one opens the layer menu. */}
    <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2.5">
      <button
        ref={layerButtonRef}
        type="button"
        onClick={onToggleLayerMenu}
        aria-haspopup="dialog"
        aria-expanded={isLayerMenuOpen}
        aria-label="Couches de la carte"
        title="Couches de la carte"
        data-testid="layers-button"
        className={`${roundBtn} relative ${isLayerMenuOpen ? '!bg-white !text-black' : ''}`}
      >
        <Layers2 className="w-5 h-5" aria-hidden="true" />
        {activeOverlayCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#0a84ff] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#0b0f19]">
            {activeOverlayCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onLocateMe}
        disabled={isLocating}
        className={roundBtn}
        title="Me localiser (GPS)"
        aria-label="Me localiser"
      >
        {isLocating ? (
          <RefreshCw className="w-4 h-4 animate-spin text-[#007aff]" aria-hidden="true" />
        ) : (
          <Navigation className="w-4 h-4 fill-current text-[#007aff]" aria-hidden="true" />
        )}
      </button>

      <button
        type="button"
        onClick={onResetFranceView}
        className={`${roundBtn} text-xs font-semibold max-md:hidden`}
        title="Vue France métropolitaine"
        aria-label="Vue France"
      >
        <span>FR</span>
      </button>

      <button
        type="button"
        onClick={onToggleTheme}
        className={`${roundBtn} max-md:hidden`}
        title={isDarkMode ? 'Fond de carte clair' : 'Fond de carte sombre'}
        aria-label="Changer le fond de carte"
      >
        {isDarkMode ? (
          <Sun className="w-4 h-4 text-amber-300" aria-hidden="true" />
        ) : (
          <Moon className="w-4 h-4 text-sky-200" aria-hidden="true" />
        )}
      </button>
    </div>

    {/* Bottom-left: data freshness (wide screens) */}
    <div className="absolute bottom-4 left-4 z-[400] hidden lg:flex items-center gap-2 apple-glass px-3 py-1.5 rounded-full text-[11px] text-white/70 shadow-md">
      <span className={`w-2 h-2 rounded-full ${isCached ? 'bg-amber-400' : 'bg-[#22c55e] animate-pulse'}`} />
      <span>{isCached ? 'Données en cache' : dataSource.split(' ')[0]}</span>
      <button
        type="button"
        onClick={onRefreshWeather}
        disabled={isRefreshing}
        className="hover:text-white transition-colors ml-1 p-0.5"
        title="Actualiser les données"
        aria-label="Actualiser les données météo"
      >
        <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
      </button>
    </div>
  </>
);
