/**
 * İstemci IP çözümü.
 *
 * audit_logs.ip_address ve sessions.ip_address kolonları PG `inet` tipindedir;
 * geçersiz bir string (eski kodun başlıksız istekler için yazdığı "unknown"
 * gibi) insert'i 22P02 ile patlatır ve denetim kaydının TAMAMI kaybolur.
 * Buradaki yardımcılar yalnız GEÇERLİ bir IP döner, bulunamazsa null.
 */
import { isIP } from 'node:net';

import type { Context } from 'hono';

/**
 * Tek bir adayı normalize eder: boşluk kırpar, "1.2.3.4:5678" / "[::1]:8080"
 * biçimlerinden portu ayıklar, IPv4-eşlemeli IPv6'yı ("::ffff:10.0.0.1")
 * IPv4'e indirger. Geçerli IP değilse null.
 */
export function normalizeIp(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  let ip = candidate;
  if (isIP(ip) === 0) {
    ip = ip.startsWith('[') ? ip.replace(/^\[([^\]]+)\](?::\d+)?$/, '$1') : ip.replace(/:\d+$/, '');
    if (isIP(ip) === 0) return null;
  }

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped?.[1] !== undefined && isIP(mapped[1]) === 4) return mapped[1];
  return ip;
}

/**
 * X-Forwarded-For zinciri + X-Real-IP içinden ilk geçerli IP'yi döndürür.
 * Zincirde "unknown" gibi geçersiz adaylar atlanır; hiçbiri geçerli değilse null.
 */
export function extractClientIp(
  forwardedFor: string | undefined,
  realIp: string | undefined,
): string | null {
  const candidates = [...(forwardedFor?.split(',') ?? []), realIp];
  for (const raw of candidates) {
    const ip = normalizeIp(raw);
    if (ip !== null) return ip;
  }
  return null;
}

/** getConnInfo ile aynı erişim yolu; adapter/env yoksa sessizce undefined. */
function socketRemoteAddress(c: Context): string | undefined {
  try {
    const env = c.env as
      | { server?: { incoming?: { socket?: { remoteAddress?: string } } } }
      | undefined;
    const bindings = (env?.server ?? env) as
      | { incoming?: { socket?: { remoteAddress?: string } } }
      | undefined;
    return bindings?.incoming?.socket?.remoteAddress;
  } catch {
    return undefined;
  }
}

/**
 * İstek için kaydedilecek IP: önce proxy başlıkları, olmazsa TCP soket adresi
 * (nginx arkasında olmayan doğrudan/konteyner-içi istekler). Hiçbiri geçerli
 * değilse null — çağıran bunu `inet` kolonuna güvenle yazabilir.
 */
export function resolveClientIp(c: Context): string | null {
  return (
    extractClientIp(c.req.header('x-forwarded-for'), c.req.header('x-real-ip')) ??
    normalizeIp(socketRemoteAddress(c))
  );
}
