import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';
import { isIosDevice, isRunningStandalone, promptPwaInstall, setupInstallPromptListener } from '../../services/pwaService';

export const PwaInstallBanner: React.FC = () => {
  const [isIos] = useState<boolean>(() => isIosDevice());
  const [canInstall, setCanInstall] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (isRunningStandalone()) return false;
    if (sessionStorage.getItem('legum_pwa_dismissed') === 'true') return false;
    return isIosDevice();
  });
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (isRunningStandalone() || sessionStorage.getItem('legum_pwa_dismissed') === 'true') {
      return;
    }

    setupInstallPromptListener(() => {
      setCanInstall(true);
    });
  }, []);

  if (!canInstall || isDismissed) return null;

  const handleInstallClick = async () => {
    if (isIos) {
      alert("Pour installer sur iPhone :\n1. Touchez l'icône Partager (carré avec flèche vers le haut)\n2. Touchez 'Sur l'écran d'accueil'\n3. Touchez 'Ajouter'");
      return;
    }
    const success = await promptPwaInstall();
    if (success) {
      setCanInstall(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('legum_pwa_dismissed', 'true');
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[550] max-w-sm w-[calc(100%-2rem)] animate-in slide-in-from-top-4 duration-300">
      <div className="apple-glass px-4 py-2.5 rounded-full shadow-2xl flex items-center justify-between gap-3 text-white select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/legumeAmi.png"
            alt="LegumAmies Logo"
            className="w-8 h-8 rounded-full object-contain border border-white/20 bg-black/20 flex-shrink-0"
          />

          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-white truncate">LegumAmies</span>
            <span className="text-[10px] text-white/50 truncate">
              {isIos ? "Touchez Partager ⎋ puis 'Sur l'écran d'accueil'" : 'Installer comme app native'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white text-black font-semibold text-xs shadow-md transition-all active:scale-95"
          >
            {isIos ? <Share className="w-3 h-3" /> : <Download className="w-3 h-3" />}
            <span>Installer</span>
          </button>

          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-full text-white/50 hover:text-white transition-colors"
            aria-label="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
