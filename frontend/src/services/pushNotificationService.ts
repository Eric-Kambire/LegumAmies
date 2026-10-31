/**
 * Native Web Push Notification Dispatcher for LegumAmies PWA
 * Works across desktop browsers and installed iOS/Android PWAs.
 * Strictly zero emojis - uses genuine Apple Touch icons, favicons, and vector branding.
 */

export async function requestWebPushPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('[Push] Error requesting permission:', err);
    return 'default';
  }
}

export async function dispatchNativePushNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, unknown>;
  }
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  const iconUrl = options?.icon || '/apple-touch-icon.png';
  const badgeUrl = options?.badge || '/icon-192.png';

  try {
    if ('serviceWorker' in navigator) {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)),
      ]);

      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body: options?.body,
          icon: iconUrl,
          badge: badgeUrl,
          tag: options?.tag || 'legum-notif',
          data: options?.data,
        });
        return true;
      }
    }

    // Direct Window Notification fallback
    new Notification(title, {
      body: options?.body,
      icon: iconUrl,
      badge: badgeUrl,
      tag: options?.tag,
    });
    return true;
  } catch (err) {
    console.warn('[Push] Error showing native notification:', err);
    return false;
  }
}
