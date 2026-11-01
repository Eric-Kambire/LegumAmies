import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCheck, ChevronRight, X } from 'lucide-react';
import type { AgriculturalNotification } from '../../types/agricultural';
import { getNotificationProvenance } from '../../services/provenance';
import { ProvenanceBadge } from '../Common/ProvenanceBadge';
import { useIsPhone } from '../../hooks/useMediaQuery';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AgriculturalNotification[];
  onOpenItem: (notification: AgriculturalNotification) => void;
  onMarkAllAsRead: () => void;
  onOpenAll: () => void;
  /** Bell button on desktop, used to anchor the popover and to ignore its own clicks. */
  anchorRef: React.RefObject<HTMLElement | null>;
}

const SEVERITY_DOT: Record<AgriculturalNotification['severity'], string> = {
  critical: 'bg-rose-400',
  warning: 'bg-amber-400',
  info: 'bg-sky-400',
};

const MAX_ITEMS = 6;

/**
 * Global notification center. Rendered through a portal at document.body so no
 * ancestor `overflow` or stacking context (nav bar, map, tab bar) can clip it.
 * Desktop: popover anchored under the bell. Phones: bottom sheet above the tab bar.
 */
export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  onOpenItem,
  onMarkAllAsRead,
  onOpenAll,
  anchorRef,
}) => {
  const isPhone = useIsPhone();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 72, right: 24 });

  const unread = notifications.filter((n) => !n.isRead).length;
  const items = notifications.slice(0, MAX_ITEMS);

  // Anchor the desktop popover under the bell and keep it inside the viewport.
  useLayoutEffect(() => {
    if (!isOpen || isPhone) return;
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({
        top: Math.round(rect.bottom + 10),
        right: Math.max(12, Math.round(window.innerWidth - rect.right - 8)),
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [isOpen, isPhone, anchorRef]);

  // Focus in on open, back to the opener on close.
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    const anchorEl = anchorRef.current;
    const t = window.setTimeout(() => closeRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(t);
      (anchorEl && !isPhone ? anchorEl : opener)?.focus?.();
    };
  }, [isOpen, isPhone, anchorRef]);

  // Escape and outside click.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return; // the bell toggles itself
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Centre de notifications"
      aria-modal={isPhone}
      data-testid="notification-center"
      style={isPhone ? undefined : { top: pos.top, right: pos.right }}
      className={
        isPhone
          ? 'fixed left-0 right-0 z-[820] bottom-[var(--bottom-stack)] max-h-[calc(100dvh-var(--bottom-stack)-3.5rem)] rounded-t-[28px] apple-glass flex flex-col text-white animate-in slide-in-from-bottom-4 duration-200'
          : 'fixed z-[820] w-[380px] max-h-[min(34rem,calc(100dvh-6rem))] rounded-[24px] apple-glass flex flex-col text-white animate-in fade-in zoom-in-95 duration-150'
      }
    >
      {isPhone && <div className="w-10 h-1 rounded-full bg-white/30 mx-auto mt-2.5" aria-hidden="true" />}

      <header className="flex items-center gap-2 px-4 pt-3 pb-2.5">
        <h2 className="text-sm font-semibold flex-1">
          Notifications
          <span className="ml-2 text-xs font-normal text-white/55" data-testid="notification-center-count">
            {unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'tout est lu'}
          </span>
        </h2>
        {unread > 0 && (
          <button
            type="button"
            onClick={onMarkAllAsRead}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] text-white/80 hover:text-white hover:bg-white/10"
          >
            <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" /> Tout lire
          </button>
        )}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Fermer les notifications"
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </header>

      <ul className="flex-1 min-h-0 overflow-y-auto px-2 pb-1 divide-y divide-white/[0.06]">
        {items.length === 0 && (
          <li className="px-3 py-8 text-center text-xs text-white/50 flex flex-col items-center gap-2">
            <Bell className="w-6 h-6 text-white/25" aria-hidden="true" />
            Aucune notification pour le moment.
          </li>
        )}
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onOpenItem(n)}
              className="w-full text-left flex items-start gap-3 px-2.5 py-2.5 rounded-xl hover:bg-white/[0.06] focus-visible:bg-white/[0.06]"
            >
              <span
                className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${SEVERITY_DOT[n.severity]} ${n.isRead ? 'opacity-35' : ''}`}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={`text-[13px] leading-snug truncate ${n.isRead ? 'text-white/65' : 'font-semibold text-white'}`}>
                    {n.title}
                  </span>
                  {!n.isRead && (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0a84ff] flex-shrink-0" aria-hidden="true" />
                      <span className="sr-only">Non lue</span>
                    </>
                  )}
                </span>
                <span className="block text-[11px] text-white/55 leading-snug line-clamp-2 mt-0.5">{n.message}</span>
                <span className="flex items-center gap-2 mt-1.5 text-[10px] text-white/40">
                  <ProvenanceBadge kind={getNotificationProvenance(n)} />
                  <span className="truncate">{n.fieldName}</span>
                  <span className="ml-auto flex-shrink-0">{n.timestamp}</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <footer className="px-4 py-3 border-t border-white/[0.08]">
        <button
          type="button"
          onClick={onOpenAll}
          className="w-full inline-flex items-center justify-center gap-1 py-2 rounded-full bg-white text-black text-xs font-semibold active:scale-[0.98]"
        >
          Ouvrir tout l'historique <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <p className="text-[10px] text-white/35 text-center mt-2">
          Notifications locales : elles s'affichent quand l'application est ouverte.
        </p>
      </footer>
    </div>
  );

  return createPortal(
    <>
      {isPhone && (
        <div className="fixed inset-0 z-[810] bg-black/55 backdrop-blur-[2px]" aria-hidden="true" />
      )}
      {panel}
    </>,
    document.body
  );
};
