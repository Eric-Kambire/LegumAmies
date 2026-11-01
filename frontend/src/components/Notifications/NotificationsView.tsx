import React, { useCallback, useState } from 'react';
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
  Calendar,
  Sprout,
} from 'lucide-react';
import type { AgriculturalNotification, NotificationPreferences } from '../../types/agricultural';
import { DEFAULT_STREAK, DUO_SIMULATION_PRESETS } from '../../services/duoNotificationService';
import { requestWebPushPermission, dispatchNativePushNotification } from '../../services/pushNotificationService';
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
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    const saved = localStorage.getItem('legum_notif_prefs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Ignore a malformed stored preference value.
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
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const persistPreferences = (updated: NotificationPreferences) => {
    setPreferences(updated);
    localStorage.setItem('legum_notif_prefs', JSON.stringify(updated));
  };

  const handleRequestLocalNotifications = async () => {
    const permission = await requestWebPushPermission();
    setPermissionState(permission);
    if (permission === 'granted') {
      persistPreferences({ ...preferences, pushEnabled: true });
      await dispatchNativePushNotification("Légume'Ami : notifications locales activées", {
        body: "Les démonstrations s'affichent pendant que Légume'Ami est ouverte.",
        tag: 'local-notification-enabled',
      });
    }
  };

  const handleTogglePref = (key: keyof NotificationPreferences) => {
    persistPreferences({ ...preferences, [key]: !preferences[key] } as NotificationPreferences);
  };

  const handleTriggerPreset = useCallback(
    async (preset: (typeof DUO_SIMULATION_PRESETS)[number]) => {
      const notification: AgriculturalNotification = {
        ...preset.notification,
        id: `sim_${Date.now()}`,
        timestamp: "À l'instant",
        isRead: false,
      };
      await dispatchNativePushNotification(notification.title, {
        body: notification.message,
        tag: notification.id,
        data: { destination: notification.actionDestination },
      });
      onTriggerSimulation?.(notification);
    },
    [onTriggerSimulation]
  );

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;
  const filteredNotifications = notifications.filter((notification) => {
    if (filter === 'unread') return !notification.isRead;
    if (filter === 'risk') return notification.category === 'weather_risk';
    if (filter === 'reminder') {
      return notification.category === 'stage_update' || notification.category === 'harvest_window';
    }
    return true;
  });

  const hasDemoNotifications = notifications.some(isDemoNotification);

  const openNotification = (notification: AgriculturalNotification) => {
    if (!notification.isRead) onMarkAsRead(notification.id);
    if (notification.actionDestination) onNavigateToTab(notification.actionDestination);
  };

  return (
    <div className="app-page-scroll flex-1 overflow-y-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-6 max-w-3xl mx-auto w-full flex flex-col gap-4 sm:gap-5">
      <header className="flex items-start justify-between min-w-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/legumeAmi.png" alt="Logo Légume'Ami" className="w-10 h-10 object-contain drop-shadow-md flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">Alertes & vigilance</h1>
            <p className="text-xs text-white/50 mt-0.5">
              {unreadCount > 0
                ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
                : 'Toutes les alertes sont à jour'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {unreadCount > 0 && (
            <button onClick={onMarkAllAsRead} className="apple-glass px-3 py-1.5 rounded-full text-xs text-white/80 hover:text-white flex items-center gap-1.5 active:scale-95 transition-transform" aria-label="Marquer toutes les alertes comme lues">
              <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Tout lire</span>
            </button>
          )}
          <button onClick={() => setIsSettingsOpen((open) => !open)} aria-expanded={isSettingsOpen} aria-controls="notification-settings" className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${isSettingsOpen ? 'bg-white text-black shadow-md' : 'apple-glass text-white/80 hover:text-white'}`} aria-label="Préférences de notifications">
            <Sliders className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <nav aria-label="Filtres de notifications" className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 -mx-1 px-1">
        {FILTERS.map((item) => (
          <button key={item.id} onClick={() => setFilter(item.id)} aria-pressed={filter === item.id} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95 ${filter === item.id ? 'bg-white text-black font-semibold shadow-md' : 'apple-glass text-white/70 hover:text-white'}`}>
            {item.label}{item.id === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
          </button>
        ))}
      </nav>

      {hasDemoNotifications && (
        <div className="apple-card px-3.5 py-3 border-amber-500/25 text-[11px] text-white/65">
          <strong className="text-amber-200">Démonstration :</strong> les alertes associées aux parcelles d’exemple illustrent l’interface et ne sont pas des alertes pour votre exploitation.
        </div>
      )}

      <section aria-label="Historique des alertes" className="flex flex-col gap-2.5">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notification) => {
            const crop = notification.cropType ? LEGUME_CROPS_CATALOG[notification.cropType] : null;
            return (
              <article key={notification.id} role="button" tabIndex={0} onClick={() => openNotification(notification)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openNotification(notification); } }} className={`apple-card p-3.5 sm:p-4 flex flex-col gap-2 cursor-pointer transition-all active:scale-[0.99] hover:bg-white/[0.09] focus-visible:outline-none ${!notification.isRead ? 'border-white/25 bg-white/[0.12] shadow-md' : 'opacity-85'}`} aria-label={`${notification.title}. ${notification.isRead ? 'Lue' : 'Non lue'}`}>
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${notification.severity === 'critical' ? 'bg-rose-500/20 text-rose-300' : notification.severity === 'warning' ? 'bg-amber-500/20 text-amber-300' : 'bg-[#007aff]/20 text-[#38bdf8]'}`} aria-hidden="true">
                      {notification.category === 'weather_risk' && <ShieldAlert className="w-3.5 h-3.5" />}
                      {notification.category === 'stage_update' && <Sprout className="w-3.5 h-3.5" />}
                      {notification.category === 'harvest_window' && <Calendar className="w-3.5 h-3.5" />}
                      {notification.category === 'briefing' && <Sparkles className="w-3.5 h-3.5" />}
                    </div>
                    {crop && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border" style={{ backgroundColor: crop.accent.bg, color: crop.accent.text, borderColor: crop.accent.border }}><CropGlyph crop={crop.id} size={11} /><span>{crop.labelFr}</span></span>}
                    {isDemoNotification(notification) && <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[9px] font-semibold text-amber-200">Démo</span>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0"><span className="text-[10px] text-white/45 font-mono">{notification.timestamp}</span>{!notification.isRead && <span className="w-2 h-2 rounded-full bg-[#007aff] ring-2 ring-[#007aff]/30" aria-label="Non lue" />}</div>
                </div>
                <div className="min-w-0"><h2 className="text-xs sm:text-sm font-bold text-white tracking-tight leading-snug">{notification.title}</h2>{notification.fieldName && <span className="text-[10px] text-white/50 block mt-0.5">{notification.fieldName}</span>}</div>
                <p className="text-xs text-white/80 leading-relaxed">{notification.message}</p>
                {notification.actionLabel && <div className="pt-2 border-t border-white/[0.06] text-[11px] text-[#38bdf8] font-semibold">{notification.actionLabel} <span aria-hidden="true">→</span></div>}
              </article>
            );
          })
        ) : (
          <div className="apple-card p-6 flex flex-col items-center justify-center text-center gap-2 text-xs text-white/60"><Check className="w-6 h-6 text-white/30" aria-hidden="true" /><p>Aucune notification dans cette vue.</p><button onClick={() => setFilter('all')} className="text-[#38bdf8] hover:underline">Voir tout l'historique</button></div>
        )}
      </section>

      <section aria-label="Suivi d'activité" className="apple-card px-3.5 py-3 flex items-center gap-3 border-amber-500/20">
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center flex-shrink-0"><Flame className="w-4 h-4 fill-amber-400" aria-hidden="true" /></div>
        <div className="min-w-0"><p className="text-xs font-semibold text-white">Suivi consulté {DEFAULT_STREAK.currentStreakDays} jours de suite</p><p className="text-[10px] text-white/50">Record : {DEFAULT_STREAK.bestStreakDays} jours. Ce compteur est affiché uniquement dans l'application.</p></div>
      </section>

      <section aria-label="Notifications locales" className="apple-card p-3.5 flex items-center justify-between gap-3 border-[#007aff]/25">
        <div className="flex items-center gap-3 min-w-0"><div className="w-8 h-8 rounded-xl bg-[#007aff]/20 text-[#38bdf8] flex items-center justify-center flex-shrink-0"><Bell className="w-4 h-4" aria-hidden="true" /></div><div className="min-w-0"><h2 className="text-xs font-semibold text-white">Notifications locales</h2><p className="text-[11px] text-white/60 leading-relaxed">Elles peuvent s'afficher pendant que Légume'Ami est ouverte. La livraison en arrière-plan n'est pas encore disponible.</p></div></div>
        {permissionState !== 'granted' ? <button onClick={handleRequestLocalNotifications} className="px-3 py-1.5 rounded-full bg-white text-black font-semibold text-xs active:scale-95 flex-shrink-0">Autoriser</button> : <span className="text-[10px] text-emerald-300 font-medium flex-shrink-0">Autorisées</span>}
      </section>

      {isSettingsOpen && (
        <section id="notification-settings" aria-label="Préférences locales" className="apple-card p-4 flex flex-col gap-3 border-white/20">
          <div><h2 className="text-xs font-semibold uppercase tracking-wider text-white/70">Préférences locales</h2><p className="text-[10px] text-white/45 mt-1">Elles sont enregistrées sur cet appareil et ne déclenchent pas de notification en arrière-plan.</p></div>
          {[
            { key: 'quietHoursEnabled' as const, label: 'Heures silencieuses', description: '21 h 00 à 06 h 30' },
            { key: 'criticalRisksImmediate' as const, label: 'Afficher les risques critiques', description: 'Dans l’application ouverte' },
            { key: 'dailyBriefingMorning' as const, label: 'Afficher le point météo', description: 'Au prochain accès à l’application' },
            { key: 'stageUpdateReminders' as const, label: 'Rappels de phénologie', description: 'Dans l’application ouverte' },
          ].map((setting) => <label key={setting.key} className="flex items-center justify-between gap-3 cursor-pointer"><span><span className="block text-xs font-medium text-white">{setting.label}</span><span className="block text-[10px] text-white/50 mt-0.5">{setting.description}</span></span><input type="checkbox" checked={Boolean(preferences[setting.key])} onChange={() => handleTogglePref(setting.key)} className="w-4 h-4 rounded accent-[#007aff] cursor-pointer" /></label>)}
        </section>
      )}

      <section aria-label="Démonstration de notification locale" className="apple-card p-3.5 flex flex-col gap-3 border-white/10">
        <button onClick={() => setIsSimulatorExpanded((expanded) => !expanded)} aria-expanded={isSimulatorExpanded} className="flex items-center justify-between gap-3 text-left"><span><span className="block text-xs font-semibold text-white">Démonstration</span><span className="block text-[10px] text-white/50 mt-0.5">Tester une alerte locale dans l’application ouverte.</span></span>{isSimulatorExpanded ? <ChevronUp className="w-4 h-4 text-white/60 flex-shrink-0" aria-hidden="true" /> : <ChevronDown className="w-4 h-4 text-white/60 flex-shrink-0" aria-hidden="true" />}</button>
        {isSimulatorExpanded && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">{DUO_SIMULATION_PRESETS.map((preset) => <button key={preset.id} onClick={() => handleTriggerPreset(preset)} className="apple-glass p-2.5 rounded-2xl flex items-center justify-between gap-2 text-left hover:bg-white/[0.12] active:scale-[0.98]"><span className="text-xs font-semibold text-white">{preset.name}</span><span className="text-[10px] text-amber-300 flex items-center gap-1 flex-shrink-0">Tester<Play className="w-3 h-3 fill-current" aria-hidden="true" /></span></button>)}</div>}
      </section>
    </div>
  );
};
