import React, { useState, useCallback } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Sliders,
  ShieldAlert,
  Sparkles,
  Calendar,
  Sprout,
  Moon,
  Flame,
  Zap,
  Play,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  AgriculturalNotification,
  NotificationPreferences,
} from '../../types/agricultural';
import {
  DEFAULT_STREAK,
  DUO_SIMULATION_PRESETS,
} from '../../services/duoNotificationService';
import {
  requestWebPushPermission,
  dispatchNativePushNotification,
} from '../../services/pushNotificationService';
import { LEGUME_CROPS_CATALOG } from '../../data/legumeCatalog';
import { CropGlyph } from '../Common/LegumeGlyphs';

interface NotificationsViewProps {
  notifications: AgriculturalNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onNavigateToTab: (tab: 'weather' | 'fields' | 'insights') => void;
  onTriggerSimulation?: (notif: AgriculturalNotification) => void;
}

// Authentic Apple iOS Toggle Switch
const AppleToggle: React.FC<{
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}> = ({ checked, onChange, ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={onChange}
    className={`w-11 h-6 rounded-full transition-colors duration-200 relative p-0.5 focus:outline-none flex-shrink-0 ${
      checked ? 'bg-[#34c759]' : 'bg-white/20'
    }`}
  >
    <div
      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateToTab,
  onTriggerSimulation,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'risk' | 'reminder'>('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSimulatorExpanded, setIsSimulatorExpanded] = useState(false);

  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    const saved = localStorage.getItem('legum_notif_prefs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {
      pushEnabled: false,
      quietHoursEnabled: true,
      quietHoursStart: '21:00',
      quietHoursEnd: '06:30',
      criticalRisksImmediate: true,
      dailyBriefingMorning: true,
      dailyBriefingTime: '07:00',
      stageUpdateReminders: true,
    };
  });

  const [permissionState, setPermissionState] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const handleRequestPush = async () => {
    const perm = await requestWebPushPermission();
    setPermissionState(perm);
    if (perm === 'granted') {
      const updated = { ...preferences, pushEnabled: true };
      setPreferences(updated);
      localStorage.setItem('legum_notif_prefs', JSON.stringify(updated));

      // Dispatch real welcome push notification
      await dispatchNativePushNotification("Légume'Ami Notifications Actives", {
        body: 'Alertes canicule sur floraison, créneaux de traitement et fenêtre de moisson configurés.',
        tag: 'welcome-push',
      });
    }
  };

  const handleTogglePref = (key: keyof NotificationPreferences) => {
    const updated = { ...preferences, [key]: !preferences[key] };
    setPreferences(updated as NotificationPreferences);
    localStorage.setItem('legum_notif_prefs', JSON.stringify(updated));
  };

  const handleTriggerPreset = useCallback(
    async (preset: (typeof DUO_SIMULATION_PRESETS)[number]) => {
      const timestampId = Date.now();
      const newNotif: AgriculturalNotification = {
        ...preset.notification,
        id: `sim_${timestampId}`,
        timestamp: "À l'instant",
        isRead: false,
      };

      // 1. Dispatch real native Web Push notification if permission is granted
      await dispatchNativePushNotification(newNotif.title, {
        body: newNotif.message,
        tag: newNotif.id,
        data: { destination: newNotif.actionDestination },
      });

      // 2. Trigger in-app Dynamic Island banner & list update
      if (onTriggerSimulation) {
        onTriggerSimulation(newNotif);
      }
    },
    [onTriggerSimulation]
  );

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'risk') return n.category === 'weather_risk';
    if (filter === 'reminder') return n.category === 'stage_update' || n.category === 'harvest_window';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pt-5 pb-32 max-w-2xl mx-auto w-full select-none flex flex-col gap-4 sm:gap-5 scrollbar-none">
      {/* 1. Authentic iOS Header */}
      <header className="flex items-center justify-between min-w-0 gap-3 pt-1">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/legumeAmi.png"
            alt="Légume'Ami Logo"
            className="w-9 h-9 object-contain drop-shadow-md flex-shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
              Notifications
            </h1>
            <p className="text-xs text-white/50 mt-0.5">
              {unreadCount > 0
                ? `${unreadCount} alerte${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
                : 'Toutes vos alertes sont à jour'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="apple-glass px-3 py-1.5 rounded-full text-xs text-white/80 hover:text-white flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
              title="Tout marquer comme lu"
            >
              <CheckCheck className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span className="hidden sm:inline">Tout lire</span>
            </button>
          )}

          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
              isSettingsOpen ? 'bg-white text-black shadow-md' : 'apple-glass text-white/80 hover:text-white'
            }`}
            title="Réglages des alertes"
            aria-label="Réglages des alertes"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. Apple iOS Inset Grouped Settings Panel (Clean Table style) */}
      {isSettingsOpen && (
        <section
          aria-label="Réglages des alertes"
          className="apple-card p-4 sm:p-5 flex flex-col gap-3.5 animate-in fade-in duration-200 border-white/20 shadow-xl"
        >
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
              RÉGLAGES & NOTIFICATIONS SYSTÈME
            </span>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="text-xs text-[#38bdf8] hover:underline font-medium"
            >
              Terminé
            </button>
          </div>

          <div className="flex flex-col divide-y divide-white/[0.06] text-xs">
            {/* System Push Activation */}
            <div className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#007aff]/20 text-[#38bdf8] flex items-center justify-center flex-shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-white">Notifications Push Web</p>
                  <p className="text-[10px] text-white/50">
                    {permissionState === 'granted'
                      ? 'Autorisées sur cet appareil'
                      : 'Nécessite la permission du navigateur'}
                  </p>
                </div>
              </div>

              {permissionState === 'granted' ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Actif</span>
                </span>
              ) : (
                <button
                  onClick={handleRequestPush}
                  className="px-3 py-1 rounded-full bg-white text-black text-xs font-semibold active:scale-95 transition-all shadow-sm"
                >
                  Activer
                </button>
              )}
            </div>

            {/* Quiet Hours */}
            <div className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center flex-shrink-0">
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-white">Heures silencieuses de nuit</p>
                  <p className="text-[10px] text-white/50">21h00 - 06h30 (silence automatique)</p>
                </div>
              </div>
              <AppleToggle
                checked={preferences.quietHoursEnabled}
                onChange={() => handleTogglePref('quietHoursEnabled')}
                ariaLabel="Basculer heures silencieuses"
              />
            </div>

            {/* Critical Risks Immediate */}
            <div className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-white">Risques météo immédiats</p>
                  <p className="text-[10px] text-white/50">Canicule sur floraison, gel tardif</p>
                </div>
              </div>
              <AppleToggle
                checked={preferences.criticalRisksImmediate}
                onChange={() => handleTogglePref('criticalRisksImmediate')}
                ariaLabel="Basculer risques météo immédiats"
              />
            </div>

            {/* Daily Briefing Morning */}
            <div className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-white">Synthèse quotidienne (07h00)</p>
                  <p className="text-[10px] text-white/50">Résumé météo & opportunités de traitement</p>
                </div>
              </div>
              <AppleToggle
                checked={preferences.dailyBriefingMorning}
                onChange={() => handleTogglePref('dailyBriefingMorning')}
                ariaLabel="Basculer synthèse quotidienne"
              />
            </div>

            {/* Growth stage check-ins */}
            <div className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center flex-shrink-0">
                  <Sprout className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-white">Rappels de phénologie</p>
                  <p className="text-[10px] text-white/50">Suivi des transitions floraison / récolte</p>
                </div>
              </div>
              <AppleToggle
                checked={preferences.stageUpdateReminders}
                onChange={() => handleTogglePref('stageUpdateReminders')}
                ariaLabel="Basculer rappels de phénologie"
              />
            </div>
          </div>
        </section>
      )}

      {/* 3. Compact Apple Activity Streak Capsule */}
      <div className="apple-card px-4 py-2.5 rounded-2xl flex items-center justify-between gap-3 border-amber-500/20 bg-gradient-to-r from-amber-500/[0.08] via-white/[0.02] to-transparent">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
            <Flame className="w-4 h-4 fill-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white tracking-tight">
                Série de {DEFAULT_STREAK.currentStreakDays} jours
              </span>
              <span className="text-[10px] text-amber-300 font-medium">
                • Surveillance continue
              </span>
            </div>
          </div>
        </div>

        {/* 7-Day Compact Dots */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {DEFAULT_STREAK.weeklyHistory.map((item, idx) => (
            <div
              key={idx}
              title={`${item.day} : ${item.active ? 'Actif' : 'Inactif'}`}
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                item.active
                  ? 'bg-amber-400 text-black shadow-xs'
                  : 'bg-white/10 text-white/30'
              }`}
            >
              {item.day[0]}
            </div>
          ))}
        </div>
      </div>

      {/* 4. Apple Segmented Control Pills */}
      <nav
        aria-label="Filtres des notifications"
        className="flex items-center gap-1 p-1 rounded-2xl apple-glass shadow-xs overflow-x-auto scrollbar-none"
      >
        {[
          { id: 'all', label: 'Toutes' },
          { id: 'unread', label: `Non lues (${unreadCount})` },
          { id: 'risk', label: 'Risques météo' },
          { id: 'reminder', label: 'Stades & Récolte' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 text-center ${
              filter === f.id
                ? 'bg-white text-black shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </nav>

      {/* 5. Clean Apple Notification Center Feed */}
      <section aria-label="Liste des alertes" className="flex flex-col gap-2.5">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((n) => {
            const crop = n.cropType ? LEGUME_CROPS_CATALOG[n.cropType] : null;

            return (
              <article
                key={n.id}
                onClick={() => {
                  if (!n.isRead) onMarkAsRead(n.id);
                  if (n.actionDestination) onNavigateToTab(n.actionDestination);
                }}
                className={`apple-card p-4 rounded-2xl flex flex-col gap-2 cursor-pointer transition-all active:scale-[0.99] hover:bg-white/[0.08] ${
                  !n.isRead ? 'border-white/20 bg-white/[0.09] shadow-md' : 'opacity-80'
                }`}
              >
                {/* Header: App Brand + Category + Crop Tag + Timestamp */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <span className="text-[11px] font-bold text-white/90 tracking-tight">
                      Légume'Ami
                    </span>
                    <span className="text-white/30 text-[10px]">•</span>

                    {/* Category Icon */}
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] flex-shrink-0 ${
                        n.severity === 'critical'
                          ? 'bg-rose-500/20 text-rose-300'
                          : n.severity === 'warning'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-[#007aff]/20 text-[#38bdf8]'
                      }`}
                    >
                      {n.category === 'weather_risk' && <ShieldAlert className="w-3 h-3" />}
                      {n.category === 'stage_update' && <Sprout className="w-3 h-3" />}
                      {n.category === 'harvest_window' && <Calendar className="w-3 h-3" />}
                      {n.category === 'briefing' && <Sparkles className="w-3 h-3" />}
                    </div>

                    {/* Crop Tag */}
                    {crop && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 flex-shrink-0"
                        style={{
                          backgroundColor: crop.accent.bg,
                          color: crop.accent.text,
                          borderColor: crop.accent.border,
                        }}
                      >
                        <CropGlyph crop={crop.id} size={11} />
                        <span>{crop.labelFr}</span>
                      </span>
                    )}

                    {n.fieldName && (
                      <span className="text-[10px] text-white/50 truncate max-w-[120px]">
                        {n.fieldName}
                      </span>
                    )}
                  </div>

                  {/* Timestamp & Unread Dot */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] text-white/45 font-mono">{n.timestamp}</span>
                    {!n.isRead && (
                      <span
                        className="w-2 h-2 rounded-full bg-[#007aff] ring-2 ring-[#007aff]/30"
                        title="Non lu"
                      />
                    )}
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-sm font-bold text-white tracking-tight leading-snug">
                  {n.title}
                </h3>

                {/* Message Body */}
                <p className="text-xs text-white/80 leading-relaxed font-normal">
                  {n.message}
                </p>

                {/* Footer Action */}
                {n.actionLabel && (
                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-[10px] text-white/40 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-[#34d399]" />
                      <span>Vérifié avec Terres Inovia</span>
                    </span>

                    <span className="text-xs text-[#38bdf8] font-semibold flex items-center gap-1 hover:underline">
                      <span>{n.actionLabel}</span>
                      <span>→</span>
                    </span>
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <div className="apple-card p-8 flex flex-col items-center justify-center text-center gap-2 text-xs text-white/50">
            <Check className="w-6 h-6 text-white/30" />
            <p>Aucune notification dans cette vue.</p>
          </div>
        )}
      </section>

      {/* 6. Discreet Demo Simulator (Collapsed by default, bottom of page) */}
      <div className="pt-2 pb-6 border-t border-white/[0.08] flex flex-col gap-2">
        <button
          onClick={() => setIsSimulatorExpanded(!isSimulatorExpanded)}
          className="flex items-center justify-between py-2 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Outils de démonstration (Simuler des alertes push)</span>
          </span>
          {isSimulatorExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {isSimulatorExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 animate-in fade-in duration-200">
            {DUO_SIMULATION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleTriggerPreset(preset)}
                className="apple-glass p-2.5 rounded-xl flex items-center justify-between text-left text-xs text-white/80 hover:text-white hover:bg-white/10 transition-all active:scale-95 border border-white/10"
              >
                <span className="truncate">{preset.name}</span>
                <Play className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0 ml-2" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
