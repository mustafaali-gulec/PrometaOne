/**
 * RefEventConsumer — monolitin yayınladığı referans event'lerini (core.company,
 * core.user, core.vendor) tüketir ve cs_ref_* read-model tablolarını günceller.
 *
 * Event gövdesi: { type: 'upserted' | 'deleted', payload: {...} }.
 * KAFKA_BROKERS yoksa hiç başlatılmaz (index.ts kontrol eder). Hatalar loglanır,
 * consumer dönmeye devam eder (tek bozuk mesaj akışı durdurmaz).
 */
import { Kafka, type Consumer } from 'kafkajs';
import type { Pool } from 'pg';

// Monolit yayıncısı ile hizalı referans topic'leri
const CORE_TOPICS = ['core.company', 'core.user', 'core.vendor'];

interface EventEnvelope {
  type?: string;
  payload?: Record<string, unknown>;
}

export class RefEventConsumer {
  private readonly consumer: Consumer;
  private running = false;

  constructor(
    private readonly pool: Pool,
    brokers: ReadonlyArray<string>,
    clientId: string,
  ) {
    const kafka = new Kafka({ clientId: `${clientId}-ref`, brokers: [...brokers] });
    this.consumer = kafka.consumer({ groupId: 'construction-service-ref' });
  }

  async start(): Promise<void> {
    await this.consumer.connect();
    for (const t of CORE_TOPICS) {
      await this.consumer.subscribe({ topic: t, fromBeginning: true });
    }
    this.running = true;
    console.log(`[kafka] ref consumer dinliyor: ${CORE_TOPICS.join(', ')}`);
    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const raw = message.value?.toString() ?? '';
          if (raw.length === 0) return;
          const env = JSON.parse(raw) as EventEnvelope;
          await this.apply(topic, env);
        } catch (err) {
          console.error(`[kafka] ref event işleme hatası (topic=${topic}):`, err);
        }
      },
    });
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    try {
      await this.consumer.disconnect();
    } finally {
      this.running = false;
    }
  }

  private async apply(topic: string, env: EventEnvelope): Promise<void> {
    const p = env.payload ?? {};
    const num = (v: unknown): number | null => (v === undefined || v === null ? null : Number(v));
    const str = (v: unknown): string | null => {
      if (v === undefined || v === null) return null;
      if (typeof v === 'string') return v;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      return null;
    };
    const id = num(p['id']);
    if (id === null) return;

    if (topic === 'core.company') {
      if (env.type === 'deleted') {
        await this.pool.query('DELETE FROM cs_ref_companies WHERE id = $1', [id]);
        return;
      }
      await this.pool.query(
        `INSERT INTO cs_ref_companies (id, name, tax_no, synced_at)
         VALUES ($1,$2,$3,NOW())
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, tax_no=EXCLUDED.tax_no, synced_at=NOW()`,
        [id, str(p['name']), str(p['taxNo'] ?? p['tax_no'])],
      );
    } else if (topic === 'core.user') {
      if (env.type === 'deleted') {
        await this.pool.query('DELETE FROM cs_ref_users WHERE id = $1', [id]);
        return;
      }
      await this.pool.query(
        `INSERT INTO cs_ref_users (id, username, full_name, role, active, synced_at)
         VALUES ($1,$2,$3,$4,$5,NOW())
         ON CONFLICT (id) DO UPDATE SET username=EXCLUDED.username, full_name=EXCLUDED.full_name,
           role=EXCLUDED.role, active=EXCLUDED.active, synced_at=NOW()`,
        [
          id,
          str(p['username']),
          str(p['fullName'] ?? p['full_name']),
          str(p['role']),
          p['active'] === undefined ? null : Boolean(p['active']),
        ],
      );
    } else if (topic === 'core.vendor') {
      if (env.type === 'deleted') {
        await this.pool.query('DELETE FROM cs_ref_vendors WHERE id = $1', [id]);
        return;
      }
      await this.pool.query(
        `INSERT INTO cs_ref_vendors (id, code, name, tax_id, synced_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT (id) DO UPDATE SET code=EXCLUDED.code, name=EXCLUDED.name,
           tax_id=EXCLUDED.tax_id, synced_at=NOW()`,
        [id, str(p['code']), str(p['name']), str(p['taxId'] ?? p['tax_id'])],
      );
    }
  }
}
