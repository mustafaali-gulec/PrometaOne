/**
 * PushDevice — push bildirimi alabilen kayıtlı cihaz/abonelik.
 *
 * Frontend'in `subscriptionToDevice` / `createFcmDevice` / `createApnDevice`
 * üreticileriyle birebir aynı alan kümesi (App.jsx). Kaynak tablo:
 * push_devices (migration 045). endpoint cihazın doğal anahtarıdır (UNIQUE);
 * web_push'ta subscription URL'i, fcm'de registration token, apn'de device
 * token taşır.
 */

export const PUSH_PLATFORMS = ['web', 'ios', 'android'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

export const PUSH_PROVIDERS = ['web_push', 'fcm', 'apn'] as const;
export type PushProvider = (typeof PUSH_PROVIDERS)[number];

/** Web Push şifreleme anahtarları (PushSubscription.toJSON().keys). */
export interface PushKeys {
  p256dh?: string | undefined;
  auth?: string | undefined;
}

export interface PushDevice {
  id: string;
  userId: string | null;
  username: string;
  platform: PushPlatform;
  provider: PushProvider;
  endpoint: string;
  keys: PushKeys | null;
  userAgent: string | null;
  bundleId: string | null;
  registeredAt: Date;
  lastUsedAt: Date;
  active: boolean;
}
