import React, { useEffect, useState } from 'react';
import { X, Flame, ArrowRight, ShieldCheck } from 'lucide-react';
import type { AgriculturalNotification } from '../../types/agricultural';
import { CropGlyph } from '../Common/LegumeGlyphs';
import { LEGUME_CROPS_CATALOG } from '../../data/legumeCatalog';

interface DuoNotificationBannerProps {
  notification: AgriculturalNotification | null;
  onDismiss: () => void;
  onActionClick: (destination: 'weather' | 'fields' | 'insights') => void;
}

export const DuoNotificationBanner: React.FC<DuoNotificationBannerProps> = ({
  notification,
  onDismiss,
  onActionClick,
}) => {
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      setIsDismissing(true);
      setTimeout(onDismiss, 300);
    }, 7000); // Auto-dismiss after 7 seconds
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification || isDismissing) return null;

  const crop = notification.cropType ? LEGUME_CROPS_CATALOG[notification.cropType] : null;

  const handleClose = () => {
    setIsDismissing(true);
    setTimeout(onDismiss, 300);
  };

  const handleAction = () => {
    if (notification.actionDestination) {
      onActionClick(notification.actionDestination);
    }
    handleClose();
  };

  return (
    <aside
      aria-label="Notification d'alerte Duolingo"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-top-4 duration-300 pointer-events-auto"
    >
      <div className="apple-glass rounded-3xl p-4 shadow-2xl border border-white/20 text-white flex flex-col gap-2.5 bg-gradient-to-br from-[#121826]/95 to-[#0b0f19]/95 backdrop-blur-2xl">
        {/* Dynamic Island Header with Streak Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Duolingo Streak Flame Capsule */}
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-bold shadow-xs">
              <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />
              <span>{notification.streakDays || 8}j de série</span>
            </div>

            {crop && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                style={{
                  backgroundColor: crop.accent.bg,
                  color: crop.accent.text,
                  borderColor: crop.accent.border,
                }}
              >
                <CropGlyph crop={crop.id} size={12} />
                <span>{crop.labelFr}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/40 font-mono">À l'instant</span>
            <button
              onClick={handleClose}
              className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Message Body with Punchy Tone */}
        <div>
          <h4 className="text-xs font-bold text-white tracking-tight">{notification.title}</h4>
          <p className="text-[11px] text-white/80 leading-relaxed mt-1 font-normal">
            {notification.message}
          </p>
        </div>

        {/* Footer with Economic Impact & Direct Action Button */}
        <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between">
          <span className="text-[10px] text-white/50 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#34d399]" />
            <span>{notification.economicImpact || 'Vigilance active'}</span>
          </span>

          <button
            onClick={handleAction}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white text-black font-semibold text-xs transition-all active:scale-95 shadow-md hover:bg-white/90"
          >
            <span>{notification.actionLabel || 'Voir'}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </aside>
  );
};
