import React, { useState, useCallback, useEffect } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Flame,
  Play,
  ShieldAlert,
  Sliders,
  Sparkles,
  Sprout,
  Moon,
  Zap,
  Info,
} from 'lucide-react';
import type { AgriculturalNotification, NotificationPreferences } from '../../types/agricultural';
import { DEFAULT_STREAK, DUO_SIMULATION_PRESETS } from '../../services/duoNotificationService';
import {
  requestWebPushPermission,
  dispatchNativePushNotification,
  getNotificationPermission,
  isNativeNotificationSupported,
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

type NotificationFilter = 'all' | 'unread' | 'risk' | 'reminder';

const FILTERS: Array<{ id: NotificationFilter; label: string }> = [
  { id: 'all', label: 'Toutes' },
  { id: 'unread', label: 'Non lues' },
  { id: 'risk', label: 'Risques météo' },
  { id: 'reminder', label: 'Rappels' },
];

const DEMO_FIELD_IDS = new Set(['field_lauragais_1', 'field_beauce_2', 'field_berry_3']);
const isDemoNotification = (notification: AgriculturalNotification) =>
  Boolean(notification.fieldId && DEMO_FIELD_IDS.has(notification.fieldId));

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
    className={`w-11 h-6 rounded-full transition-colors duration-200 relative p-0.5 focus:outline-none flex-shrink-0 cursor-pointer ${
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
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSimulatorExpanded, setIsSimulatorExpanded] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

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

  const [permissionState, setPermissionState] = useState<NotificationPermission>(() =>
    getNotificationPermission()
  );

  const isSupported = isNativeNotificationSupported();

  // Refresh permission when user returns to tab after modifying browser permissions
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setPermissionState(getNotificationPermission());
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const showFeedback = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  const persistPreferences = (updated: NotificationPreferences) => {
    setPreferences(updated);
    localStorage.setItem('legum_notif_prefs', JSON.stringify(updated));
  };

  const handleRequestPush = async () => {
    const perm = await requestWebPushPermission();
    setPermissionState(perm);

    if (perm === 'granted') {
      persistPreferences({ ...preferences, pushEnabled: true });
      showFeedback('Notifications système activées ! Envoi de la notification test...');

      // Dispatch real native notification immediately to device OS
      const result = await dispatchNativePushNotification("Légume'Ami : Notifications Système Actives", {
        body: 'Alertes météo, canicule sur floraison et fenêtres de moisson activées sur cet appareil.',
        tag: 'welcome-system-push',
      });

      if (result.success) {
        showFeedback('Notification affichée sur votre appareil (PC / Mobile) !');
      }
    } else if (perm === 'denied') {
      showFeedback('Autorisation refusée par le navigateur. Débloquez les notifications via l’adresse du site.');
    }
  };

  const handleTestSystemPush = async () => {
    showFeedback('Envoi d’une alerte de test vers votre appareil...');
    const result = await dispatchNativePushNotification("Légume'Ami : Test Alerte Système", {
      body: 'Vérification réussie : votre ordinateur ou téléphone reçoit bien les notifications système.',
      tag: `test-push-${Date.now()}`,
    });

    if (result.success) {
      showFeedback('Alerte envoyée ! Regardez le centre de notifications de votre système (Windows / Mac / Android).');
    } else {
      showFeedback(result.error || 'Échec de l’envoi de la notification.');
      setPermissionState(result.permission);
    }
  };

  const handleTogglePref = (key: keyof NotificationPreferences) => {
    persistPreferences({ ...preferences, [key]: !preferences[key] } as NotificationPreferences);
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

      // 1. Dispatch real native OS notification (prompts if permission is still default)
      const pushResult = await dispatchNativePushNotification(newNotif.title, {
        body: newNotif.message,
        tag: newNotif.id,
        data: { destination: newNotif.actionDestination },
      });

      if (pushResult.success) {
        showFeedback('Notification envoyée à votre système (PC / Mobile) !');
      } else if (pushResult.permission === 'denied') {
        showFeedback('Alerte affichée dans l’app (notifications système bloquées par le navigateur).');
      }

      setPermissionState(pushResult.permission);

      // 2. Trigger in-app Dynamic Island banner & feed update
      if (onTriggerSimulation) {
        onTriggerSimulation(newNotif);
      }
    },
    [onTriggerSimulation]
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'risk') return n.category === 'weather_risk';
    if (filter === 'reminder') return n.category === 'stage_update' || n.category === 'harvest_window';
    return true;
  });

  const openNotification = (notif: AgriculturalNotification) => {
    if (!notif.isRead) onMarkAsRead(notif.id);
    if (notif.actionDestination) onNavigateToTab(notif.actionDestination);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pt-4 pb-32 max-w-2xl mx-auto w-full select-none flex flex-col gap-4 sm:gap-5 scrollbar-none">
      {/* Feedback Toast Banner */}
      {feedbackToast && (
        <div className="sticky top-2 z-50 px-4 py-2.5 rounded-2xl bg-white/95 text-slate-900 text-xs font-semibold shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 border border-black/10">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#007aff] flex-shrink-0" />
            <span>{feedbackToast}</span>
          </div>
          <button
            onClick={() => setFeedbackToast(null)}
            className="text-[11px] text-slate-500 hover:text-slate-800"
          >
            Fermer
          </button>
        </div>
      )}

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
              Notifications & Alertes
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

      {/* 2. REAL NATIVE OS PUSH NOTIFICATION CARD (Highlighted for user certainty) */}
      <section
        aria-label="État des notifications système"
        className={`apple-card p-4 sm:p-5 flex flex-col gap-3.5 border transition-all ${
          permissionState === 'granted'
            ? 'border-emerald-500/30 bg-emerald-950/20'
            : permissionState === 'denied'
              ? 'border-amber-500/30 bg-amber-950/20'
              : 'border-[#007aff]/30 bg-[#007aff]/10'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                permissionState === 'granted'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : permissionState === 'denied'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-[#007aff]/20 text-[#38bdf8]'
              }`}
            >
              {permissionState === 'granted' ? (
                <Check className="w-5 h-5 text-emerald-400" />
              ) : permissionState === 'denied' ? (
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              ) : (
                <Bell className="w-5 h-5 text-[#38bdf8] animate-bounce" />
              )}
            </div>

            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Alertes Système (PC & Téléphone)</span>
                {permissionState === 'granted' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Actif
                  </span>
                )}
              </h2>

              <p className="text-xs text-white/70 mt-1 leading-relaxed">
                {permissionState === 'granted'
                  ? 'Les alertes s’affichent directement dans le centre de notifications de votre système (Windows Action Center, Mac ou tiroir Android), même lorsque Légume\'Ami est en arrière-plan.'
                  : permissionState === 'denied'
                    ? 'Les notifications système sont bloquées par votre navigateur. Cliquez sur l’icône de cadenas ou paramètres à gauche de l’adresse web pour autoriser les notifications.'
                    : 'Autorisez les notifications pour recevoir les alertes météo (canicule, gel, fenêtre de moisson) directement sur votre ordinateur ou votre mobile.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Button for OS Notifications */}
        <div className="flex items-center gap-2 pt-1">
          {permissionState === 'granted' ? (
            <button
              onClick={handleTestSystemPush}
              className="apple-glass px-3.5 py-1.5 rounded-full text-xs font-semibold text-white/90 hover:text-white flex items-center gap-1.5 hover:bg-white/15 active:scale-95 transition-all border border-emerald-500/30"
            >
              <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
              <span>Tester la notification sur cet appareil</span>
            </button>
          ) : permissionState === 'denied' ? (
            <button
              onClick={handleRequestPush}
              className="apple-glass px-3.5 py-1.5 rounded-full text-xs font-semibold text-amber-300 hover:text-amber-200 active:scale-95 transition-all border border-amber-500/30"
            >
              Réessayer l’autorisation
            </button>
          ) : (
            <button
              onClick={handleRequestPush}
              className="px-4 py-2 rounded-full bg-white text-black text-xs font-bold active:scale-95 transition-all shadow-md flex items-center gap-1.5 hover:bg-white/90"
            >
              <Bell className="w-3.5 h-3.5 text-black" />
              <span>Activer les alertes sur cet appareil</span>
            </button>
          )}

          {!isSupported && (
            <span className="text-[11px] text-rose-300">
              Navigateur non compatible avec l’API Notification.
            </span>
          )}
        </div>
      </section>

      {/* 3. Apple iOS Inset Grouped Settings Panel */}
      {isSettingsOpen && (
        <section
          aria-label="Réglages des alertes"
          className="apple-card p-4 sm:p-5 flex flex-col gap-3.5 animate-in fade-in duration-200 border-white/20 shadow-xl"
        >
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
              RÉGLAGES & PRÉFÉRENCES SYSTÈME
            </span>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="text-xs text-[#38bdf8] hover:underline font-medium"
            >
              Terminé
            </button>
          </div>

          <div className="flex flex-col divide-y divide-white/[0.06] text-xs">
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
                  <p className="font-semibold text-white">Point météo matinal</p>
                  <p className="text-[10px] text-white/50">Briefing à 07h00 pour vos parcelles</p>
                </div>
              </div>
              <AppleToggle
                checked={preferences.dailyBriefingMorning}
                onChange={() => handleTogglePref('dailyBriefingMorning')}
                ariaLabel="Basculer point météo matinal"
              />
            </div>

            {/* Stage Update Reminders */}
            <div className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center flex-shrink-0">
                  <Sprout className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-white">Rappels de phénologie</p>
                  <p className="text-[10px] text-white/50">Suivi des stades de floraison & gousse</p>
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

      {/* 4. Duolingo-style Streak Capsule */}
      <section
        aria-label="Série de surveillance active"
        className="apple-card p-3 sm:p-3.5 flex items-center justify-between gap-3 bg-gradient-to-r from-amber-500/10 via-transparent to-transparent border-amber-500/20"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white shadow-md flex-shrink-0">
            <Flame className="w-4 h-4 fill-white text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate">
              Série de {DEFAULT_STREAK.currentStreakDays} jours de surveillance
            </p>
            <p className="text-[10px] text-white/50 truncate">
              Record : {DEFAULT_STREAK.bestStreakDays} jours consécutifs
            </p>
          </div>
        </div>

        {/* Weekly Day Capsules */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {DEFAULT_STREAK.weeklyHistory.map((day) => (
            <div
              key={day.day}
              className={`flex flex-col items-center justify-center w-6 h-8 rounded-lg text-[9px] font-semibold transition-all ${
                day.isToday
                  ? 'bg-amber-400 text-black shadow-sm font-bold scale-105'
                  : day.active
                    ? 'bg-amber-400/20 text-amber-300'
                    : 'bg-white/5 text-white/30'
              }`}
            >
              <span>{day.day}</span>
              {day.active && <div className="w-1 h-1 rounded-full bg-current mt-0.5" />}
            </div>
          ))}
        </div>
      </section>

      {/* 5. Apple Segmented Control Filters */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-2">
        <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl apple-glass">
          {FILTERS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filter === tab.id
                  ? 'bg-white text-black shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 6. Notifications List */}
      <div className="flex flex-col gap-2.5">
        {filteredNotifications.length === 0 ? (
          <div className="apple-card p-8 text-center flex flex-col items-center justify-center gap-2">
            <Bell className="w-8 h-8 text-white/20 mb-1" />
            <p className="text-sm font-semibold text-white">Aucune notification dans cette vue</p>
            <p className="text-xs text-white/40">Vos parcelles sont surveillées en continu.</p>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const cropConfig = notif.cropType ? LEGUME_CROPS_CATALOG[notif.cropType] : null;
            const isDemo = isDemoNotification(notif);

            return (
              <article
                key={notif.id}
                onClick={() => openNotification(notif)}
                className={`apple-card p-3.5 sm:p-4 flex flex-col gap-2.5 cursor-pointer hover:bg-white/[0.08] transition-all active:scale-[0.99] border-l-4 ${
                  notif.severity === 'critical'
                    ? 'border-l-rose-500 border-white/10'
                    : notif.severity === 'warning'
                      ? 'border-l-amber-500 border-white/10'
                      : 'border-l-[#007aff] border-white/10'
                } ${notif.isRead ? 'opacity-65' : 'shadow-md'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {cropConfig ? (
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${cropConfig.color}25` }}
                      >
                        <CropGlyph crop={cropConfig.id} className="w-5 h-5 text-white" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                        <Zap className="w-4 h-4 text-amber-400" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                          {notif.title}
                        </h3>
                        {isDemo && (
                          <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">
                            Démo
                          </span>
                        )}
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#38bdf8] flex-shrink-0" />
                        )}
                      </div>

                      <p className="text-xs text-white/70 mt-1 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] text-white/40 flex-shrink-0 whitespace-nowrap">
                    {notif.timestamp}
                  </span>
                </div>

                {/* Footer Badges & Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] text-[11px]">
                  <div className="flex items-center gap-2 text-white/50">
                    {notif.fieldName && (
                      <span className="font-medium text-white/70 truncate max-w-[150px]">
                        {notif.fieldName}
                      </span>
                    )}
                    {notif.economicImpact && (
                      <span className="text-emerald-400 font-medium">
                        {notif.economicImpact}
                      </span>
                    )}
                  </div>

                  {notif.actionLabel && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openNotification(notif);
                      }}
                      className="text-[#38bdf8] hover:text-white font-semibold transition-colors flex items-center gap-1"
                    >
                      <span>{notif.actionLabel}</span>
                      <span>→</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* 7. Discreet Demonstration Simulator Drawer */}
      <section
        aria-label="Simulateur d'alertes système"
        className="apple-card p-3.5 flex flex-col gap-3 border-white/10"
      >
        <button
          onClick={() => setIsSimulatorExpanded(!isSimulatorExpanded)}
          aria-expanded={isSimulatorExpanded}
          className="flex items-center justify-between gap-3 text-left w-full cursor-pointer"
        >
          <div>
            <span className="block text-xs font-semibold text-white">
              Simulateur d'alertes système (Démonstration)
            </span>
            <span className="block text-[10px] text-white/50 mt-0.5">
              Tester l'envoi d'une alerte native sur votre ordinateur ou votre smartphone.
            </span>
          </div>
          {isSimulatorExpanded ? (
            <ChevronUp className="w-4 h-4 text-white/60 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/60 flex-shrink-0" />
          )}
        </button>

        {isSimulatorExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 animate-in fade-in duration-200">
            {DUO_SIMULATION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleTriggerPreset(preset)}
                className="apple-glass p-2.5 rounded-xl flex items-center justify-between text-left text-xs text-white/80 hover:text-white hover:bg-white/10 transition-all active:scale-95 border border-white/10 cursor-pointer"
              >
                <div className="min-w-0 pr-2">
                  <span className="block font-semibold truncate text-white">{preset.name}</span>
                  <span className="block text-[10px] text-white/50 truncate">
                    {preset.notification.category === 'weather_risk'
                      ? 'Alerte météo'
                      : preset.notification.category === 'harvest_window'
                        ? 'Récolte'
                        : 'Série'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-300 flex-shrink-0">
                  <span>Tester</span>
                  <Play className="w-3 h-3 fill-amber-300" />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
