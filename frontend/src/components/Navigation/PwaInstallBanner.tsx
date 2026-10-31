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
      alert("Pour installer sur iPhone :\n1. Touchez l'icône Partager (carré avec flèche vers le haut)\n2. Faites défiler et touchez 'Sur l'écran d'accueil'\n3. Touchez 'Ajouter'");
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
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[550] max-w-sm sm:max-w-md w-[calc(100%-1.5rem)] animate-in slide-in-from-top-4 duration-300">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-emerald-500/30 p-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 text-slate-100 select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-md flex-shrink-0">
            <span className="text-sm">🌱</span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-semibold text-white">Installer LegumAmies</span>
            <span className="text-[10px] text-slate-400">
              {isIos ? "Touchez Partager puis 'Sur l'écran d'accueil'" : 'Accès rapide hors-ligne au champ'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-950 transition-all active:scale-95"
          >
            {isIos ? <Share className="w-3 h-3" /> : <Download className="w-3 h-3" />}
            <span>Installer</span>
          </button>

          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
            aria-label="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
