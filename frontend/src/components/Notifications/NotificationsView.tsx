import React, { useState } from 'react';
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
} from 'lucide-react';
import type { AgriculturalNotification, NotificationPreferences } from '../../types/agricultural';

interface NotificationsViewProps {
  notifications: AgriculturalNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onNavigateToTab: (tab: 'weather' | 'fields' | 'insights') => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateToTab,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'risk' | 'reminder'>('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
    if (!('Notification' in window)) {
      alert("Votre navigateur ne supporte pas les notifications push.");
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      setPermissionState(perm);
      if (perm === 'granted') {
        const updated = { ...preferences, pushEnabled: true };
        setPreferences(updated);
        localStorage.setItem('legum_notif_prefs', JSON.stringify(updated));
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const handleTogglePref = (key: keyof NotificationPreferences) => {
    const updated = { ...preferences, [key]: !preferences[key] };
    setPreferences(updated as NotificationPreferences);
    localStorage.setItem('legum_notif_prefs', JSON.stringify(updated));
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'risk') return n.category === 'weather_risk';
    if (filter === 'reminder') return n.category === 'stage_update' || n.category === 'harvest_window';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pt-6 pb-28 max-w-4xl mx-auto w-full select-none flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Alertes & Rappels</h1>
          <p className="text-xs text-white/50 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}` : 'Toutes les alertes sont à jour'}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="apple-glass px-3 py-1.5 rounded-full text-xs text-white/80 hover:text-white flex items-center gap-1 active:scale-95 transition-transform"
              title="Tout marquer comme lu"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tout lire</span>
            </button>
          )}

          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="w-9 h-9 rounded-full apple-glass flex items-center justify-center text-white/80 hover:text-white active:scale-95 transition-transform"
            title="Préférences de notification"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PWA Push Permission Card (Value-First Onboarding) */}
      {permissionState !== 'granted' && (
        <div className="apple-card p-4 bg-gradient-to-br from-white/[0.08] to-white/[0.03] border-white/20 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#007aff]/20 text-[#38bdf8] flex items-center justify-center text-xl flex-shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-white">Activer les alertes sur votre smartphone</h2>
              <p className="text-[11px] text-white/65 mt-0.5 leading-relaxed">
                Soyez averti des alertes canicule sur la floraison, des fenêtres de traitement sans vent et de l'imminence de votre récolte, même sans ouvrir l'application.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={handleRequestPush}
              className="px-4 py-2 rounded-full bg-white text-black font-semibold text-xs shadow-md active:scale-95 transition-transform"
            >
              Activer les notifications
            </button>
          </div>
        </div>
      )}

      {/* Settings Panel (Toggleable) */}
      {isSettingsOpen && (
        <div className="apple-card p-4 flex flex-col gap-3.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Préférences d'Alerte & Fréquence
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
                  <p className="font-medium text-white">Heures de silence (Nuit)</p>
                  <p className="text-[10px] text-white/50">Aucune notification entre 21h00 et 06h30</p>
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
                  <p className="text-[10px] text-white/50">Alerte instantanée en cas de gel ou canicule</p>
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
                  <p className="font-medium text-white">Briefing du matin (07h00)</p>
                  <p className="text-[10px] text-white/50">Résumé audio ou texte de la journée</p>
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
                  <p className="font-medium text-white">Rappels de suivi phénologique</p>
                  <p className="text-[10px] text-white/50">Check-in hebdomadaire pour ajuster les stades</p>
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

      {/* Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 select-none">
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
      </div>

      {/* Notifications Feed */}
      <div className="flex flex-col gap-2.5">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                if (!n.isRead) onMarkAsRead(n.id);
                if (n.actionDestination) onNavigateToTab(n.actionDestination);
              }}
              className={`apple-card p-4 flex flex-col gap-2 cursor-pointer transition-all active:scale-[0.99] ${
                !n.isRead ? 'border-white/25 bg-white/[0.12] shadow-md' : 'opacity-85'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
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

                  <div>
                    <h3 className="text-xs font-semibold text-white">{n.title}</h3>
                    {n.fieldName && (
                      <span className="text-[10px] text-white/50">{n.fieldName}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/40 font-mono">{n.timestamp}</span>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-[#007aff]" title="Non lu" />
                  )}
                </div>
              </div>

              <p className="text-xs text-white/75 leading-relaxed pl-9">
                {n.message}
              </p>

              {n.actionLabel && (
                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-end pl-9">
                  <span className="text-[11px] text-[#38bdf8] font-medium hover:underline">
                    {n.actionLabel} →
                  </span>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="apple-card p-6 flex flex-col items-center justify-center text-center gap-2 text-xs text-white/50">
            <Check className="w-6 h-6 text-white/30" />
            <p>Aucune notification dans cette vue.</p>
          </div>
        )}
      </div>
    </div>
  );
};
