/**
 * PWA Service: Service worker registration & installation banner controls
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deferredInstallPrompt: any = null;

export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker enregistré avec succès:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Échec enregistrement Service Worker:', err);
        });
    });
  }
}

export function setupInstallPromptListener(onPromptAvailable: () => void): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    onPromptAvailable();
  });
}

export async function promptPwaInstall(): Promise<boolean> {
  if (!deferredInstallPrompt) return false;

  deferredInstallPrompt.prompt();
  const choiceResult = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  return choiceResult.outcome === 'accepted';
}

export function isRunningStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true
  );
}

export function isIosDevice(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !(window as any).MSStream
  );
}
