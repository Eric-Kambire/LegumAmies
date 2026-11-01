/**
 * Native OS Push Notification Service for Légume'Ami PWA
 * Works across desktop browsers (Windows Action Center, macOS Notification Center)
 * and mobile devices (Android notification drawer, iOS 16.4+ standalone PWA).
 *
 * Utilizes ServiceWorkerRegistration.showNotification for real system notifications.
 * Strictly 0 emojis - uses vector SVG glyphs and official Légume'Ami branding.
 */

import { getActiveServiceWorker, registerServiceWorker } from './pwaService';

export interface PushNotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  silent?: boolean;
  requireInteraction?: boolean;
  promptIfDefault?: boolean;
}

export interface PushDispatchResult {
  success: boolean;
  permission: NotificationPermission;
  method?: 'serviceworker' | 'window';
  error?: string;
}

/**
 * Checks whether native system notifications are supported in this browser/device.
 */
export function isNativeNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Gets the current notification permission state.
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNativeNotificationSupported()) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Requests browser permission for native OS push notifications.
 * Automatically ensures the service worker is registered first.
 */
export async function requestWebPushPermission(): Promise<NotificationPermission> {
  if (!isNativeNotificationSupported()) {
    return 'denied';
  }

  try {
    // Ensure service worker is running before requesting permission
    await registerServiceWorker();

    const permission = await Notification.requestPermission();
    console.log('[Push] Notification permission state:', permission);
    return permission;
  } catch (err) {
    console.warn('[Push] Error requesting notification permission:', err);
    return Notification.permission || 'default';
  }
}

/**
 * Dispatches a REAL native OS notification that appears in the device's
 * physical notification shade (Android / iOS) or computer desktop toast (Windows / Mac).
 */
export async function dispatchNativePushNotification(
  title: string,
  options?: PushNotificationOptions
): Promise<PushDispatchResult> {
  if (!isNativeNotificationSupported()) {
    return {
      success: false,
      permission: 'denied',
      error: 'Les notifications ne sont pas supportées sur ce navigateur.',
    };
  }

  let permission = Notification.permission;

  // If permission is default and user hasn't explicitly disabled prompt, request it
  if (permission === 'default' && options?.promptIfDefault !== false) {
    permission = await requestWebPushPermission();
  }

  if (permission !== 'granted') {
    return {
      success: false,
      permission,
      error:
        permission === 'denied'
          ? 'Notifications bloquées par les paramètres du navigateur.'
          : 'Permission non accordée.',
    };
  }

  // Generate absolute icon URLs for OS desktop/mobile notification trays
  const origin = window.location.origin;
  const iconUrl = options?.icon ? new URL(options.icon, origin).href : new URL('/legumeAmi.png', origin).href;
  const badgeUrl = options?.badge ? new URL(options.badge, origin).href : new URL('/icon-192.png', origin).href;
  const tag = options?.tag || `legum-${Date.now()}`;

  // 1. Primary Modern Path: Service Worker showNotification
  // Required for Android Chrome (where new Notification() is forbidden) and iOS PWA,
  // and routes directly into the OS Notification Center on Windows and macOS.
  if ('serviceWorker' in navigator) {
    try {
      const reg = await getActiveServiceWorker();
      if (reg && typeof reg.showNotification === 'function') {
        const swOptions = {
          body: options?.body || '',
          icon: iconUrl,
          badge: badgeUrl,
          tag,
          vibrate: [200, 100, 200],
          data: {
            url: origin,
            timestamp: Date.now(),
            ...options?.data,
          },
          requireInteraction: options?.requireInteraction ?? false,
          silent: options?.silent ?? false,
        };

        await reg.showNotification(title, swOptions as unknown as NotificationOptions);

        console.log('[Push] Native notification sent via Service Worker:', title);
        return { success: true, permission: 'granted', method: 'serviceworker' };
      }
    } catch (swErr) {
      console.warn('[Push] ServiceWorker showNotification failed, trying fallback:', swErr);
    }
  }

  // 2. Direct Window Notification Fallback (For desktop browsers if SW is temporarily offline)
  try {
    const notif = new Notification(title, {
      body: options?.body,
      icon: iconUrl,
      badge: badgeUrl,
      tag,
      data: options?.data,
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
    };

    console.log('[Push] Native notification sent via Window constructor:', title);
    return { success: true, permission: 'granted', method: 'window' };
  } catch (windowErr) {
    console.warn('[Push] Window Notification fallback failed:', windowErr);
    return {
      success: false,
      permission: 'granted',
      error: `Échec d'affichage système: ${windowErr instanceof Error ? windowErr.message : String(windowErr)}`,
    };
  }
}
