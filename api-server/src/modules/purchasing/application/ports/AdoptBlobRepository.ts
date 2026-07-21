/**
 * AdoptBlobRepository PORT'u — normalize blob satırlarının TEK transaction'da
 * devralınması. Implementasyon: PgAdoptBlobRepository.
 *
 * Sözleşme:
 *   - Upsert anahtarı (company_id, client_id) → ikinci çağrı duplicate üretmez.
 *   - orders.vendorClientId / prClientId, BU çağrıda upsert edilen VE tabloda
 *     zaten var olan (önceki adopt) client_id'ler üzerinden çözülür.
 *   - Tedarikçisi çözülemeyen order atlanır (vendor_id NOT NULL); pr'ı
 *     çözülemeyen order pr_id=NULL ile yazılır (kolon nullable).
 *   - items/lines iç dizileri her çağrıda delete-then-insert ile YENİDEN yazılır.
 */
import type { NormalizedOrder, NormalizedRequest, NormalizedVendor } from '../dto/AdoptBlobDtos.js';

export interface AdoptAllPayload {
  vendors: ReadonlyArray<NormalizedVendor>;
  requests: ReadonlyArray<NormalizedRequest>;
  orders: ReadonlyArray<NormalizedOrder>;
}

export interface AdoptAllOutcome {
  /** clientId → serverId (bu çağrıda upsert edilenler). */
  vendorIdByClient: Record<string, string>;
  requestIdByClient: Record<string, string>;
  orderIdByClient: Record<string, string>;
  /** Tedarikçisi çözülemediği için atlanan order sayısı. */
  skippedOrders: number;
}

export interface AdoptBlobRepository {
  adoptAll(companyId: number, payload: AdoptAllPayload): Promise<AdoptAllOutcome>;
}
