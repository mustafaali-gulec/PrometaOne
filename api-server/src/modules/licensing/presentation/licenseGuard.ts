/**
 * licenseGuard — /v1 altındaki TÜM istekleri lisans kontrolünden geçirir.
 *
 * index.ts'te route kayıtlarından ÖNCE `v1.use('*', licenseGuard)` olarak
 * bağlanır (Hono'da middleware yalnız kendinden SONRA kaydedilen route'lara
 * uygulanır).
 *
 * Kurallar:
 * - Muaf yollar (startsWith): /health, /license, /auth — her zaman geçer
 *   (lisans yokken bile durum sorgulanabilsin + admin girip aktive edebilsin).
 * - Lisans yok/geçersiz → 403 license_invalid; süresi dolmuş → 403
 *   license_expired (ayrı kod — UI ayrı mesaj gösterir).
 * - Koltuk (terminal) sınırı: istek X-Terminal-Id (uuid) taşıyorsa terminal
 *   license_terminals'a upsert edilir (5 dk in-memory throttle ile — her istek
 *   DB'ye vurmaz). Yeni terminal ve kayıtlı sayı >= maxTerminals → 403
 *   license_seat_limit. Header yoksa (curl/entegrasyon) koltuk kontrolü atlanır.
 * - DB erişilemezse guard isteği ENGELLEMEZ (fail-open yalnız DB hatasında;
 *   lisans hiç yoksa fail-closed).
 */
import type { MiddlewareHandler } from 'hono';

import type { LicenseService } from '../application/LicenseService.js';
import type { PgLicenseStore } from '../infrastructure/persistence/PgLicenseStore.js';

/** Lisans kontrolünden muaf yol önekleri (/v1 soyulduktan sonra). */
const EXEMPT_PREFIXES = ['/health', '/license', '/auth'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Terminal upsert throttle penceresi — 5 dk. */
const TERMINAL_THROTTLE_MS = 5 * 60 * 1000;

export interface LicenseGuardDeps {
  service: LicenseService;
  store: PgLicenseStore;
}

export function createLicenseGuard(deps: LicenseGuardDeps): MiddlewareHandler {
  // terminal_id → son başarılı upsert zamanı (ms). Süreç-içi; restart'ta sıfırlanır.
  const lastUpsertAt = new Map<string, number>();

  return async (c, next) => {
    // c.req.path tam yoldur (/v1/...); mount önekini soy.
    const path = c.req.path.startsWith('/v1') ? c.req.path.slice(3) : c.req.path;
    if (EXEMPT_PREFIXES.some((p) => path.startsWith(p))) {
      return next();
    }

    const { verification, dbOk } = await deps.service.getVerification();

    // DB erişilemedi → fail-open (lisanslı müşteriyi DB kesintisi kilitlemesin).
    if (!dbOk) return next();

    if (!verification.valid) {
      if (verification.reason === 'expired') {
        return c.json(
          {
            error: 'license_expired',
            message: 'Lisans süresi doldu. Lütfen yeni lisans için tedarikçinizle iletişime geçin.',
          },
          403,
        );
      }
      return c.json(
        {
          error: 'license_invalid',
          message:
            'Geçerli bir ürün lisansı bulunamadı. Lütfen sistem yöneticinizin lisans aktivasyonu yapmasını sağlayın.',
        },
        403,
      );
    }

    // ===== Koltuk (terminal) sınırı ========================================
    const terminalId = c.req.header('X-Terminal-Id')?.trim().toLowerCase();
    if (terminalId && UUID_RE.test(terminalId)) {
      const nowMs = Date.now();
      const last = lastUpsertAt.get(terminalId);
      if (last === undefined || nowMs - last >= TERMINAL_THROTTLE_MS) {
        let name: string | null = null;
        const rawName = c.req.header('X-Terminal-Name');
        if (rawName) {
          try {
            name = decodeURIComponent(rawName);
          } catch {
            name = rawName;
          }
        }
        try {
          const known = await deps.store.terminalExists(terminalId);
          if (!known) {
            const used = await deps.store.countTerminals();
            const max = verification.payload?.maxTerminals ?? 1;
            if (used >= max) {
              return c.json(
                {
                  error: 'license_seat_limit',
                  message: `Terminal limiti aşıldı: lisansınız en fazla ${max} terminale izin veriyor. Yönetim ekranından kullanılmayan bir terminali kaldırabilir veya lisansınızı yükseltebilirsiniz.`,
                },
                403,
              );
            }
          }
          // Guard auth'tan önce çalışır → username burada bilinmez, boş kalır.
          await deps.store.upsertTerminal(terminalId, name, null);
          lastUpsertAt.set(terminalId, nowMs);
          // Sınırsız büyümesin (pratikte terminal sayısı küçüktür).
          if (lastUpsertAt.size > 10_000) lastUpsertAt.clear();
        } catch {
          // DB hatasında koltuk kontrolü isteği engellemez (fail-open).
        }
      }
    }

    return next();
  };
}
