/**
 * HttpConstructionBridge — ConstructionBridge HTTP implementasyonu.
 *
 * SERVİSLER ARASI KİMLİK: JWT_SECRET monolit ile construction-service arasında
 * ZATEN paylaşımlıdır (api-server/docker-compose.yml bunu açıkça belgeler —
 * "token stateless doğrulaması için şart"). Köprü, kısa ömürlü (2 dk) bir
 * servis token'ı basar: role=editor (senkron ucu requireWrite ister),
 * companies=[companyId] (companyScopeGuard çapraz-tenant'ı keser), sub=0 +
 * username='satinalma-koprusu' (denetim izinde insan kullanıcıyla karışmaz).
 *
 * BEST-EFFORT: hiçbir hata fırlatılmaz — sipariş işlemi köprü yüzünden
 * düşmez. Başarısızlık ve KISMİ başarı (sync errors[]) console.warn ile
 * loglanır; senkron idempotent olduğundan sonraki yazma açığı kapatır.
 */
import jwt from 'jsonwebtoken';

import {
  poToCommitmentSync,
  type ConstructionBridge,
} from '../../application/ports/ConstructionBridge.js';
import type { PurchaseOrder } from '../../domain/entities/PurchaseOrder.js';

export interface HttpConstructionBridgeOptions {
  /** ör. http://construction-service:3002 (compose) / http://localhost:3002 */
  baseUrl: string;
  jwtSecret: string;
  /** Test için enjekte edilebilir fetch. */
  fetchFn?: typeof fetch;
}

export class HttpConstructionBridge implements ConstructionBridge {
  private readonly fetchFn: typeof fetch;

  constructor(private readonly opts: HttpConstructionBridgeOptions) {
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  async syncPurchaseOrder(po: PurchaseOrder): Promise<void> {
    const payload = poToCommitmentSync(po);
    if (payload === null) return; // şantiye bağı yok ya da taslak — kapsam dışı

    try {
      const token = jwt.sign(
        {
          sub: 0,
          username: 'satinalma-koprusu',
          role: 'editor',
          companies: [po.companyId],
        },
        this.opts.jwtSecret,
        { expiresIn: '2m' },
      );
      const res = await this.fetchFn(`${this.opts.baseUrl}/v1/construction/commitments/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.warn(
          `[construction-bridge] ${po.poNo} senkronu HTTP ${String(res.status)}: ${(await res.text()).slice(0, 300)}`,
        );
        return;
      }
      const result = (await res.json()) as { errors?: { refNo: string; message: string }[] };
      if (Array.isArray(result.errors) && result.errors.length > 0) {
        // Kısmi başarı SESSİZ GEÇİLMEZ: hangi satırın neden düştüğü logda durur
        // (tipik neden: yanlış cs_projects/cs_boq_lines id'si).
        console.warn(
          `[construction-bridge] ${po.poNo}: ${String(result.errors.length)} satır işlenemedi — ` +
            result.errors
              .map((e) => `${e.refNo}: ${e.message}`)
              .join(' | ')
              .slice(0, 500),
        );
      }
    } catch (err) {
      console.warn(
        `[construction-bridge] ${po.poNo} senkronu başarısız (servis kapalı olabilir; idempotent — sonraki yazmada telafi edilir): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
