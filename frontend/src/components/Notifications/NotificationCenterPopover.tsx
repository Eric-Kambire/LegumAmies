import React, { useEffect, useRef } from 'react';
import { ArrowRight, Bell, CheckCheck, X } from 'lucide-react';
import type { AgriculturalNotification } from '../../types/agricultural';

interface Props {
  notifications: AgriculturalNotification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onOpenHistory: () => void;
  onNavigate: (tab: 'weather' | 'fields' | 'insights') => void;
}

export const NotificationCenterPopover: React.FC<Props> = ({
  notifications, onClose, onMarkRead, onMarkAllRead, onOpenHistory, onNavigate,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onPointer = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          !(e.target as HTMLElement).closest?.('[data-notification-trigger]')) onClose();
    };
    window.addEventListener('keydown', onKey);
    // Capture phase so the outside-click still fires even when Leaflet (or other
    // widgets) stop pointer-event propagation before it reaches document.
    document.addEventListener('pointerdown', onPointer, true);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer, true); };
  }, [onClose]);

  return (
    <section
      ref={panelRef}
      role="dialog"
      aria-label="Centre de notifications"
      className="fixed z-[790] md:top-[72px] md:right-5 md:bottom-auto md:w-[390px] top-auto bottom-[calc(5.8rem+env(safe-area-inset-bottom,0px))] left-3 right-3 max-h-[min(570px,70vh)] flex flex-col rounded-[24px] border border-white/15 bg-[#151c2a] shadow-[0_24px_80px_rgba(0,0,0,0.7)] overflow-hidden text-white"
    >
      <header className="flex items-center gap-2.5 shrink-0 p-4 border-b border-white/10">
        <Bell className="w-4 h-4 text-amber-300"/>
        <h2 className="font-semibold text-sm flex-1">Alertes <span className="text-white/50 font-normal">· {unread} non lue{unread > 1 ? 's' : ''}</span></h2>
        <button type="button" onClick={onMarkAllRead} title="Tout marquer lu" aria-label="Tout marquer lu" className="p-1.5 rounded-lg hover:bg-white/10"><CheckCheck className="w-4 h-4"/></button>
        <button type="button" onClick={onClose} title="Fermer" aria-label="Fermer" className="p-1.5 rounded-lg hover:bg-white/10"><X className="w-4 h-4"/></button>
      </header>
      <div className="min-h-0 overflow-y-auto p-2">
        {notifications.length === 0 && <p className="p-5 text-center text-xs text-white/55">Aucune notification pour le moment.</p>}
        {notifications.slice(0, 7).map((n) => {
          const example = ['field_lauragais_1', 'field_beauce_2', 'field_berry_3'].includes(n.fieldId || '');
          return (
            <button type="button" key={n.id} onClick={() => { onMarkRead(n.id); if (n.actionDestination) { onNavigate(n.actionDestination); onClose(); } }} className="w-full text-left rounded-2xl p-3 hover:bg-white/[0.07] flex items-start gap-2.5">
              <span className={`mt-1 w-2 h-2 shrink-0 rounded-full ${n.isRead ? 'bg-white/15' : n.severity === 'critical' ? 'bg-rose-400' : 'bg-sky-400'}`}/>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-[12px] text-white/90 leading-snug line-clamp-2">{n.title}</span>
                <span className="block mt-1 text-[11px] text-white/60 line-clamp-2">{n.message}</span>
                <span className="flex items-center gap-2 mt-1.5 text-[10px] text-white/40">{n.fieldName || 'Général'} {example && <span className="text-amber-200">· Exemple</span>}</span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 mt-1 text-white/35 shrink-0"/>
            </button>
          );
        })}
      </div>
      <footer className="p-3 border-t border-white/10 shrink-0">
        <button type="button" onClick={onOpenHistory} className="w-full rounded-xl bg-white/[0.08] hover:bg-white/[0.13] p-2.5 text-xs font-semibold flex items-center justify-center gap-2">Voir toutes les alertes <ArrowRight className="w-3.5 h-3.5"/></button>
      </footer>
    </section>
  );
};
