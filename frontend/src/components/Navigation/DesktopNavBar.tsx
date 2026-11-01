import React, { useState, useEffect } from 'react';
import {
  Home,
  Map as MapIcon,
  Sprout,
  TrendingUp,
  Bell,
  Clock,
  Laptop,
  Check,
  Download,
} from 'lucide-react';
import type { AppTab } from './AppleTabBar';
import type { SelectedField } from '../../types/agricultural';
import { CropGlyph } from '../Common/LegumeGlyphs';
import type { SystemEnvironment } from '../../hooks/useSystemEnvironment';
import {
  isRunningStandalone,
  promptPwaInstall,
  setupInstallPromptListener,
} from '../../services/pwaService';

interface DesktopNavBarProps {
  bellRef?: React.RefObject<HTMLButtonElement | null>;
  isNotificationsOpen?: boolean;
  onToggleNotifications?: () => void;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  unreadCount?: number;
  fields: SelectedField[];
  activeField: SelectedField | null;
  onSelectActiveField: (field: SelectedField) => void;
  env: SystemEnvironment;
  onOpenContractModal: () => void;
}

export const DesktopNavBar: React.FC<DesktopNavBarProps> = ({
  bellRef,
  isNotificationsOpen = false,
  onToggleNotifications,
  activeTab,
  onTabChange,
  unreadCount = 0,
  fields,
  activeField,
  onSelectActiveField,
  env,
  onOpenContractModal,
}) => {
  const tabs = [
    { id: 'home' as AppTab, label: 'Accueil', icon: Home },
    { id: 'weather' as AppTab, label: 'Carte', icon: MapIcon },
    { id: 'fields' as AppTab, label: 'Parcelles', icon: Sprout },
    { id: 'insights' as AppTab, label: 'Analyses', icon: TrendingUp },
    { id: 'notifications' as AppTab, label: 'Alertes', icon: Bell },
  ];

  const [canInstall, setCanInstall] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || isRunningStandalone()) return;
    setupInstallPromptListener(() => {
      setCanInstall(true);
    });
  }, []);

  const handleInstallClick = async () => {
    const success = await promptPwaInstall();
    if (success) {
      setCanInstall(false);
    }
  };

  return (
    <header className="hidden md:flex items-center justify-between gap-3 px-4 lg:px-6 py-3 border-b border-white/[0.08] apple-glass z-[600] w-full select-none">
      {/* Brand & Emblem */}
      <div className="flex items-center gap-3">
        <img
          src="/legumeAmi.png"
          alt="Légume'Ami Logo"
          className="w-9 h-9 object-contain drop-shadow-md flex-shrink-0"
        />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-white">Légume'Ami</span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-full bg-white/[0.08] text-white/60 border border-white/[0.1]">
              Pro
            </span>
          </div>
          <p className="hidden xl:block text-[10px] text-white/45">Intelligence Météo des Légumineuses</p>
        </div>
      </div>

      {/* Segmented Center Navigation Tabs (Apple HIG Style) */}
      <nav aria-label="Navigation Bureau" className="flex items-center p-1 rounded-full bg-black/30 border border-white/[0.1]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'bg-white text-black shadow-md font-semibold'
                  : 'text-white/65 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={isActive ? 2.4 : 1.8} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* System Status & Field Quick Switcher */}
      <div className="flex items-center gap-3">
        {/* Computer Clock & Solar Period Indicator */}
        <div
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs text-white/70"
          title={`Horloge système : ${env.currentTimeString} (${env.periodLabelFr})`}
        >
          <Clock className="w-3.5 h-3.5 text-white/50" />
          <span className="font-mono text-white/90">{env.currentTimeString}</span>
          <span className="text-white/30">•</span>
          <span className="text-[11px] text-white/60">{env.periodLabelFr}</span>
        </div>

        {/* Active Field Dropdown Button */}
        {activeField && (
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-xs font-medium text-white transition-colors">
              <CropGlyph crop={activeField.cropType} size={15} />
              <span className="truncate max-w-[90px] lg:max-w-[150px]">{activeField.name}</span>
            </button>

            {/* Quick dropdown menu on hover / click */}
            <div className="absolute right-0 top-full mt-1.5 w-64 rounded-2xl apple-glass p-2 hidden group-hover:flex group-focus-within:flex flex-col gap-1 shadow-2xl border border-white/20 z-[700]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 px-2 py-1">
                Changer de parcelle active
              </span>
              {fields.map((f) => {
                const isCur = f.id === activeField.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => onSelectActiveField(f)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-left transition-colors ${
                      isCur
                        ? 'bg-white/20 text-white font-medium'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <CropGlyph crop={f.cropType} size={14} />
                      <span className="truncate">{f.name}</span>
                    </div>
                    {isCur && <Check className="w-3.5 h-3.5 text-[#38bdf8]" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Desktop PWA Install Action */}
        {canInstall && (
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-xs text-white transition-all active:scale-95 shadow-sm"
            title="Installer l'application Légume'Ami sur PC"
          >
            <Download className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span className="hidden xl:inline text-[11px] font-medium">Installer l'app</span>
          </button>
        )}

        {/* API / Backend Contract Badge */}
        <button
          onClick={onOpenContractModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-xs text-white/75 transition-colors"
          title="Contrat d'intégration Python FastAPI & AROME"
          aria-label="Contrat API"
        >
          <Laptop className="w-3.5 h-3.5 text-white/60" />
          <span className="hidden xl:inline text-[11px]">API</span>
        </button>

        {/* Notification bell: opens the global notification center (popover) */}
        <button
          ref={bellRef}
          type="button"
          onClick={onToggleNotifications}
          aria-haspopup="dialog"
          aria-expanded={isNotificationsOpen}
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
          data-testid="notification-bell"
          className={`relative w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${
            isNotificationsOpen
              ? 'bg-white text-black border-white'
              : 'bg-white/[0.08] hover:bg-white/[0.14] border-white/[0.12] text-white'
          }`}
        >
          <Bell className="w-4 h-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              data-testid="notification-bell-badge"
              className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#ff453a] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#0b0f19]"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
