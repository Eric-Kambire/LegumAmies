/**
 * PWA Service: Service worker registration & installation banner controls
 * Ensures bulletproof registration across Vite dev server and production builds.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deferredInstallPrompt: any = null;

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/**
 * Registers the service worker immediately if DOM is ready, or on window load.
 * Returns the ServiceWorkerRegistration promise.
 */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }

  if (registrationPromise) {
    return registrationPromise;
  }

  const doRegister = async (): Promise<ServiceWorkerRegistration | null> => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[PWA] Service Worker enregistré avec succès:', reg.scope);
      return reg;
    } catch (err) {
      console.warn('[PWA] Échec enregistrement Service Worker:', err);
      return null;
    }
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    registrationPromise = doRegister();
  } else {
    registrationPromise = new Promise((resolve) => {
      window.addEventListener('load', () => {
        doRegister().then(resolve);
      });
    });
  }

  return registrationPromise;
}

/**
 * Ensures that an active ServiceWorkerRegistration is available and ready.
 */
export async function getActiveServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    let reg: ServiceWorkerRegistration | null | undefined = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await registerServiceWorker();
    }

    if (reg) {
      const targetReg = reg;
      // Wait for service worker to become ready/active
      const readyReg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<ServiceWorkerRegistration | null>((resolve) =>
          setTimeout(() => resolve(targetReg), 2500)
        ),
      ]);
      return readyReg || targetReg;
    }
  } catch (err) {
    console.warn('[PWA] Erreur récupération Service Worker:', err);
  }
  return null;
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
