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

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateToTab,
  onTriggerSimulation,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'risk' | 'reminder'>('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSimulatorExpanded, setIsSimulatorExpanded] = useState(true);

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
      await dispatchNativePushNotification('LegumAmies Notifications Actives', {
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
    <div className="flex-1 overflow-y-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-28 max-w-3xl mx-auto w-full select-none flex flex-col gap-4 sm:gap-5">
      {/* 1. Header (iOS style) */}
      <header className="flex items-center justify-between min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
            Alertes & Vigilance
          </h1>
          <p className="text-xs text-white/50 mt-0.5">
            {unreadCount > 0
              ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
              : 'Toutes les alertes sont à jour'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="apple-glass px-3 py-1.5 rounded-full text-xs text-white/80 hover:text-white flex items-center gap-1.5 active:scale-95 transition-transform"
              title="Tout marquer comme lu"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tout marquer lu</span>
            </button>
          )}

          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
              isSettingsOpen ? 'bg-white text-black shadow-md' : 'apple-glass text-white/80 hover:text-white'
            }`}
            title="Préférences de notification"
            aria-label="Préférences de notification"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. Duolingo Daily Streak Dashboard Card (iOS Activity style, zero emojis) */}
      <section
        aria-label="Série de surveillance active"
        className="apple-card p-4 sm:p-5 bg-gradient-to-br from-amber-500/[0.10] via-white/[0.04] to-transparent border-amber-500/20 relative overflow-hidden flex flex-col gap-3.5"
      >
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-amber-500/25 to-orange-500/30 border border-amber-500/35 flex items-center justify-center text-amber-400 flex-shrink-0 shadow-sm">
              <Flame className="w-5 h-5 fill-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Série de {DEFAULT_STREAK.currentStreakDays} jours
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Vigilance active
                </span>
              </div>
              <p className="text-[11px] text-white/60 truncate mt-0.5">
                Suivi quotidien de vos parcelles • Record : {DEFAULT_STREAK.bestStreakDays} jours
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full apple-glass border-white/15 text-xs text-white/85 flex-shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>1 Gel disponible</span>
          </div>
        </div>

        {/* 7-Day Weekly History Tracker */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 pt-1 border-t border-white/[0.06]">
          {DEFAULT_STREAK.weeklyHistory.map((item, idx) => (
            <div
              key={idx}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all ${
                item.isToday
                  ? 'bg-amber-500/20 border border-amber-400/40 ring-1 ring-amber-400/25 shadow-xs'
                  : item.active
                  ? 'bg-white/[0.05] border border-amber-500/20'
                  : 'bg-white/[0.02] border border-white/[0.05] opacity-50'
              }`}
            >
              <span className="text-[9px] sm:text-[10px] font-medium text-white/60 mb-1">{item.day}</span>
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  item.active
                    ? 'bg-gradient-to-tr from-amber-500 to-orange-400 text-white shadow-xs'
                    : 'bg-white/10 text-white/30'
                }`}
              >
                <Flame className={`w-3 h-3 ${item.active ? 'fill-white text-white' : 'text-white/30'}`} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-[11px] text-white/55 pt-0.5">
          <span className="flex items-center gap-1.5 truncate">
            <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
            <span className="truncate">Consultez quotidiennement pour maintenir votre flamme.</span>
          </span>
          <span className="flex items-center gap-1 text-sky-300 font-medium text-[10px] flex-shrink-0 ml-2">
            <ShieldCheck className="w-3 h-3" />
            <span>Gel protégé</span>
          </span>
        </div>
      </section>

      {/* 3. Interactive Web Push & Behavioral Simulator (Compact Apple design) */}
      <section
        aria-label="Simulateur de notifications"
        className="apple-card p-4 bg-gradient-to-br from-[#121826]/95 to-[#0b0f19]/95 border-white/15 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider truncate">
                Simulateur d'Alerte Push (Cultures en Place)
              </h2>
              <p className="text-[10px] text-white/50 truncate">
                Déclenche la notification push système du navigateur et la bannière iOS
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsSimulatorExpanded(!isSimulatorExpanded)}
            className="w-7 h-7 rounded-full apple-glass flex items-center justify-center text-white/60 hover:text-white flex-shrink-0"
            title={isSimulatorExpanded ? 'Masquer le simulateur' : 'Afficher le simulateur'}
          >
            {isSimulatorExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {isSimulatorExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 animate-in fade-in duration-200">
            {DUO_SIMULATION_PRESETS.map((preset) => {
              const crop = LEGUME_CROPS_CATALOG[preset.cropType];
              return (
                <button
                  key={preset.id}
                  onClick={() => handleTriggerPreset(preset)}
                  className="apple-glass p-2.5 rounded-2xl flex flex-col gap-1.5 text-left transition-all hover:bg-white/[0.12] active:scale-98 border border-white/10 hover:border-white/20 group min-w-0"
                >
                  <div className="flex items-center justify-between min-w-0 gap-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1 flex-shrink-0"
                      style={{
                        backgroundColor: crop?.accent.bg,
                        color: crop?.accent.text,
                        borderColor: crop?.accent.border,
                      }}
                    >
                      <CropGlyph crop={preset.cropType} size={11} />
                      <span>{crop?.labelFr || preset.name}</span>
                    </span>

                    <div className="flex items-center gap-1 text-[10px] text-white/40 group-hover:text-amber-300 transition-colors flex-shrink-0">
                      <span>Tester Push</span>
                      <Play className="w-3 h-3 fill-current" />
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-white group-hover:text-amber-200 transition-colors truncate">
                    {preset.name}
                  </span>

                  <div className="flex items-center justify-between text-[10px] text-white/50 min-w-0">
                    <span className="truncate">{preset.notification.duoTag || preset.tone}</span>
                    <span className="text-white/40 font-mono text-[9px] flex-shrink-0">
                      {preset.notification.economicImpact}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. PWA Push Permission Banner (If not yet authorized) */}
      {permissionState !== 'granted' && (
        <div className="apple-card p-3.5 sm:p-4 bg-gradient-to-br from-[#007aff]/15 via-white/[0.04] to-transparent border-[#007aff]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-[#007aff]/25 text-[#38bdf8] flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-white truncate">
                Activer les notifications push sur votre appareil
              </h3>
              <p className="text-[11px] text-white/65 mt-0.5 leading-relaxed">
                Recevez les alertes canicule et fenêtres de traitement même quand l'application est fermée.
              </p>
            </div>
          </div>

          <button
            onClick={handleRequestPush}
            className="w-full sm:w-auto px-4 py-2 rounded-full bg-white text-black font-semibold text-xs shadow-md active:scale-95 transition-transform whitespace-nowrap flex-shrink-0"
          >
            Activer le Push
          </button>
        </div>
      )}

      {/* 5. Settings Panel (Toggleable modal-like drawer) */}
      {isSettingsOpen && (
        <div className="apple-card p-4 flex flex-col gap-3.5 animate-in fade-in duration-200 border-white/20">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Paramètres d'Alertes & Fréquence
            </span>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="text-xs text-white/50 hover:text-white"
            >
              Fermer
            </button>
          </div>

          <div className="flex flex-col gap-3 text-xs">
            {/* Quiet Hours */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-300" />
                <div>
                  <p className="font-medium text-white">Heures silencieuses de nuit</p>
                  <p className="text-[10px] text-white/50">Aucune notification sonore entre 21h00 et 06h30</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.quietHoursEnabled}
                onChange={() => handleTogglePref('quietHoursEnabled')}
                className="w-4 h-4 rounded accent-[#007aff] cursor-pointer"
              />
            </div>

            {/* Critical Risks Immediate */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-300" />
                <div>
                  <p className="font-medium text-white">Risques critiques immédiats</p>
                  <p className="text-[10px] text-white/50">Alerte push instantanée en cas de canicule floraison</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.criticalRisksImmediate}
                onChange={() => handleTogglePref('criticalRisksImmediate')}
                className="w-4 h-4 rounded accent-[#007aff] cursor-pointer"
              />
            </div>

            {/* Daily Briefing Morning */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <div>
                  <p className="font-medium text-white">Bulletin matinal de 07h00</p>
                  <p className="text-[10px] text-white/50">Synthèse météo et phénologique quotidienne</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.dailyBriefingMorning}
                onChange={() => handleTogglePref('dailyBriefingMorning')}
                className="w-4 h-4 rounded accent-[#007aff] cursor-pointer"
              />
            </div>

            {/* Growth stage check-ins */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sprout className="w-4 h-4 text-[#22c55e]" />
                <div>
                  <p className="font-medium text-white">Rappels de phénologie</p>
                  <p className="text-[10px] text-white/50">Check-in pour actualiser floraison et gousses</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.stageUpdateReminders}
                onChange={() => handleTogglePref('stageUpdateReminders')}
                className="w-4 h-4 rounded accent-[#007aff] cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. Filter Chips (iOS Segmented Pills) */}
      <nav aria-label="Filtres de notifications" className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
        {[
          { id: 'all', label: 'Toutes' },
          { id: 'unread', label: `Non lues (${unreadCount})` },
          { id: 'risk', label: 'Risques météo' },
          { id: 'reminder', label: 'Rappels & Stades' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95 ${
              filter === f.id
                ? 'bg-white text-black font-semibold shadow-md'
                : 'apple-glass text-white/70 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </nav>

      {/* 7. Notifications Feed (Structured iOS Notification Center Cells, NO Overlap) */}
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
                className={`apple-card p-3.5 sm:p-4 flex flex-col gap-2 cursor-pointer transition-all active:scale-[0.99] hover:bg-white/[0.09] ${
                  !n.isRead ? 'border-white/25 bg-white/[0.12] shadow-md' : 'opacity-85'
                }`}
              >
                {/* Row 1: Header with Category, Crop, Tags and Timestamp */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    {/* Severity category icon badge */}
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${
                        n.severity === 'critical'
                          ? 'bg-rose-500/20 text-rose-300'
                          : n.severity === 'warning'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-[#007aff]/20 text-[#38bdf8]'
                      }`}
                    >
                      {n.category === 'weather_risk' && <ShieldAlert className="w-3.5 h-3.5" />}
                      {n.category === 'stage_update' && <Sprout className="w-3.5 h-3.5" />}
                      {n.category === 'harvest_window' && <Calendar className="w-3.5 h-3.5" />}
                      {n.category === 'briefing' && <Sparkles className="w-3.5 h-3.5" />}
                    </div>

                    {/* Streak Flame Badge */}
                    {n.streakDays && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex-shrink-0">
                        <Flame className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        <span>{n.streakDays}j</span>
                      </span>
                    )}

                    {/* Crop Tag with vector SVG glyph */}
                    {crop && (
                      <span
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0"
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

                    {/* Behavioral Tag */}
                    {n.duoTag && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/75 border border-white/10 flex-shrink-0 truncate max-w-[130px]">
                        {n.duoTag}
                      </span>
                    )}
                  </div>

                  {/* Timestamp & Unread Dot */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] text-white/45 font-mono">{n.timestamp}</span>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-[#007aff] ring-2 ring-[#007aff]/30" title="Non lu" />
                    )}
                  </div>
                </div>

                {/* Row 2: Title and Field */}
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight leading-snug">
                    {n.title}
                  </h3>
                  {n.fieldName && (
                    <span className="text-[10px] text-white/50 block mt-0.5">{n.fieldName}</span>
                  )}
                </div>

                {/* Row 3: Message Body */}
                <p className="text-xs text-white/80 leading-relaxed font-normal">
                  {n.message}
                </p>

                {/* Row 4: Economic Impact & Action CTA */}
                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2 min-w-0">
                  {n.economicImpact ? (
                    <span className="text-[10px] text-[#34d399] font-medium flex items-center gap-1 truncate">
                      <ShieldCheck className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{n.economicImpact}</span>
                    </span>
                  ) : (
                    <div />
                  )}

                  {n.actionLabel && (
                    <div className="flex items-center gap-1 text-[11px] text-[#38bdf8] font-semibold hover:underline flex-shrink-0">
                      <span>{n.actionLabel}</span>
                      <span>→</span>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <div className="apple-card p-6 flex flex-col items-center justify-center text-center gap-2 text-xs text-white/50">
            <Check className="w-6 h-6 text-white/30" />
            <p>Aucune notification dans cette vue.</p>
          </div>
        )}
      </section>
    </div>
  );
};
