/**
 * PgMirrorRepository — AppStateMirror PG implementasyonu.
 * Tablo: app_state_entities (044_app_state_mirror.sql).
 *
 * replaceAll TEK transaction'da (pool.connect() + BEGIN/COMMIT/ROLLBACK —
 * PgFixedAssetRepository.syncAll kalıbı):
 *   1. Satırlar (companyId, domain, clientId) üzerinde DEDUPE edilir (son
 *      kazanır) — aynı batch'te çift id "ON CONFLICT ... cannot affect row a
 *      second time" hatası üretmesin.
 *   2. Her (company_id, domain) grubu için delete-prune: rows'ta OLMAYAN
 *      client_id'ler silinir (grup boşsa tamamı silinir — dizi boşaltıldı).
 *   3. Batched multi-row INSERT ... ON CONFLICT DO UPDATE (BATCH_SIZE=500,
 *      satır başına 4 parametre → 2000 parametre/statement, pg limitinin
 *      çok altında). data JSON.stringify + $N::jsonb ile yazılır (pg rastgele
 *      JS objesini jsonb'ye otomatik çevirmez).
 */
import type { AppStateMirror } from '../../application/ports/AppStateMirror.js';
import type { MirrorGroup, MirrorRow } from '../../domain/BlobProjector.js';

/** pg.PoolClient'ın burada kullanılan alt kümesi (testte mock'lanabilir). */
export interface MirrorPoolClient {
  query(queryText: string, values?: readonly unknown[]): Promise<unknown>;
  release(): void;
}

/** pg.Pool'un burada kullanılan alt kümesi. */
export interface MirrorPool {
  connect(): Promise<MirrorPoolClient>;
}

const BATCH_SIZE = 500;

/** Map anahtarı ayracı (U+0000) — domain/client_id içinde anlamlı olarak geçemez. */
const SEP = '\u0000';

interface GroupBucket {
  companyId: string;
  domain: string;
  rows: MirrorRow[];
}

export class PgMirrorRepository implements AppStateMirror {
  constructor(private readonly pool: MirrorPool) {}

  async replaceAll(rows: readonly MirrorRow[], groups?: readonly MirrorGroup[]): Promise<void> {
    // 1) Dedupe (son kazanır).
    const deduped = new Map<string, MirrorRow>();
    for (const row of rows) {
      deduped.set(row.companyId + SEP + row.domain + SEP + row.clientId, row);
    }

    // 2) Grup kovaları — açık gruplar + satırlardan türeyenler.
    const buckets = new Map<string, GroupBucket>();
    const bucketOf = (companyId: string, domain: string): GroupBucket => {
      const key = companyId + SEP + domain;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { companyId, domain, rows: [] };
        buckets.set(key, bucket);
      }
      return bucket;
    };
    for (const g of groups ?? []) bucketOf(g.companyId, g.domain);
    for (const row of deduped.values()) bucketOf(row.companyId, row.domain).rows.push(row);

    if (buckets.size === 0) return; // ayna işi yok

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const bucket of buckets.values()) {
        // Delete-prune: rows'ta olmayan client_id'ler gider (boş grup → hepsi).
        await client.query(
          `DELETE FROM app_state_entities
             WHERE company_id = $1 AND domain = $2 AND NOT (client_id = ANY($3::text[]))`,
          [bucket.companyId, bucket.domain, bucket.rows.map((r) => r.clientId)],
        );

        // Batched upsert.
        for (let start = 0; start < bucket.rows.length; start += BATCH_SIZE) {
          const batch = bucket.rows.slice(start, start + BATCH_SIZE);
          const tuples: string[] = [];
          const values: unknown[] = [];
          batch.forEach((row, i) => {
            const p = i * 4;
            tuples.push(`($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}::jsonb, now())`);
            values.push(row.companyId, row.domain, row.clientId, JSON.stringify(row.data ?? null));
          });
          await client.query(
            `INSERT INTO app_state_entities (company_id, domain, client_id, data, updated_at)
               VALUES ${tuples.join(', ')}
             ON CONFLICT (company_id, domain, client_id)
               DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
            values,
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ROLLBACK hatası orijinal hatayı gölgelemesin
      }
      throw err;
    } finally {
      client.release();
    }
  }
}
