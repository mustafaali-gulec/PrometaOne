/**
 * Basit in-memory rate limit yardımcısı.
 *
 * Sabit pencere (fixed window) sayacı: pencere içinde `limit`'ten fazla istek
 * reddedilir. Tek proses içindir (multi-instance deploy'da instance başına
 * sayar — bu uçlar için yeterli, amaç kaba kötüye-kullanım freni).
 *
 * İki katman:
 *   - createRateLimiter: saf, test edilebilir sayaç (clock inject edilebilir)
 *   - rateLimitMiddleware: Hono middleware'i — anahtar IP + auth.username
 */
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

export interface RateLimiterOptions {
  /** Pencere başına izin verilen istek sayısı. */
  limit: number;
  /** Pencere süresi (ms). Öndeğer: 60_000 (1 dakika). */
  windowMs?: number;
  /** Test için inject edilebilir saat. Öndeğer: Date.now. */
  now?: () => number;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

/** Map sınırsız büyümesin diye süresi geçen kayıtların temizlenme eşiği. */
const PURGE_THRESHOLD = 5000;

/**
 * Saf rate limiter. Dönen fonksiyon: anahtar için istek İZİNLİ ise true.
 */
export function createRateLimiter(opts: RateLimiterOptions): (key: string) => boolean {
  const windowMs = opts.windowMs ?? 60_000;
  const now = opts.now ?? Date.now;
  const windows = new Map<string, WindowEntry>();

  return (key: string): boolean => {
    const t = now();

    if (windows.size > PURGE_THRESHOLD) {
      for (const [k, w] of windows) {
        if (w.resetAt <= t) windows.delete(k);
      }
    }

    const entry = windows.get(key);
    if (!entry || entry.resetAt <= t) {
      windows.set(key, { count: 1, resetAt: t + windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= opts.limit;
  };
}

/**
 * Hono middleware fabrikası. Anahtar: `name:IP:username` — auth'suz isteklerde
 * yalnız IP. authMiddleware/optionalAuthMiddleware'den SONRA takılmalı ki
 * username çözülmüş olsun.
 */
export function rateLimitMiddleware(
  name: string,
  limit: number,
  windowMs = 60_000,
): MiddlewareHandler {
  const allow = createRateLimiter({ limit, windowMs });

  return async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'local';
    const username = c.get('auth')?.username ?? '';
    if (!allow(`${name}:${ip}:${username}`)) {
      throw new HTTPException(429, { message: 'Çok fazla istek — lütfen biraz bekleyin' });
    }
    await next();
  };
}
