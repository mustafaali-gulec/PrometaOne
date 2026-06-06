/**
 * Monolit Kafka entegrasyonu (çift yönlü).
 *
 *  - publishCore(): referans (core.company/user/vendor) event'lerini yayınlar →
 *    construction-service tüketir (cs_ref_* read-model). KAFKA_BROKERS yoksa no-op.
 *  - ConstructionEventConsumer: construction.hakedis + construction.stock dinler →
 *    audit_logs'a yazar (gerçek muhasebe/bildirim tetiği için uzantı noktası).
 *
 * Tüm Kafka işlemleri hata-toleranslı: yayın/işleme hatası iş akışını kırmaz.
 */
import { Kafka, type Consumer, type Producer } from 'kafkajs';

import { config } from '../config.js';
import { pool } from '../db.js';

let producer: Producer | null = null;
let producerReady = false;

function kafka(clientSuffix: string): Kafka {
  return new Kafka({
    clientId: `${config.KAFKA_CLIENT_ID}${clientSuffix}`,
    brokers: config.kafkaBrokers,
  });
}

/** Referans event yayını. type: 'upserted' | 'deleted'. Hata yutulur. */
export async function publishCore(
  topic: 'core.company' | 'core.user' | 'core.vendor',
  key: string,
  payload: Record<string, unknown>,
  type: 'upserted' | 'deleted' = 'upserted',
): Promise<void> {
  if (config.kafkaBrokers.length === 0) return;
  try {
    if (!producer) producer = kafka('-producer').producer({ allowAutoTopicCreation: true });
    if (!producerReady) {
      await producer.connect();
      producerReady = true;
    }
    await producer.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify({
            type,
            payload,
            emittedAt: new Date().toISOString(),
            source: 'api-server',
          }),
          headers: { 'event-type': type },
        },
      ],
    });
  } catch (err) {
    console.error(`[kafka] core event yayın hatası (topic=${topic}):`, err);
  }
}

export async function disconnectKafkaProducer(): Promise<void> {
  if (producer && producerReady) {
    try {
      await producer.disconnect();
    } finally {
      producerReady = false;
    }
  }
}

interface EventEnvelope {
  type?: string;
  payload?: Record<string, unknown>;
}

/** construction.* event'lerini dinleyip audit_logs'a yazan tüketici. */
export class ConstructionEventConsumer {
  private readonly consumer: Consumer;
  private running = false;

  constructor() {
    this.consumer = kafka('-cons').consumer({ groupId: 'api-server-construction' });
  }

  async start(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: 'construction.hakedis', fromBeginning: false });
    await this.consumer.subscribe({ topic: 'construction.stock', fromBeginning: false });
    this.running = true;
    console.warn(
      '[kafka] construction event tüketicisi dinliyor: construction.hakedis, construction.stock',
    );
    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const raw = message.value?.toString() ?? '';
          if (raw.length === 0) return;
          const env = JSON.parse(raw) as EventEnvelope;
          const companyId = Number(env.payload?.['companyId'] ?? 0) || null;
          await pool.query(
            `INSERT INTO audit_logs (user_id, username, company_id, action, details)
             VALUES (NULL, $1, $2, $3, $4::jsonb)`,
            [
              'construction-service',
              companyId,
              `construction.${topic}:${env.type ?? 'event'}`,
              raw,
            ],
          );
          // UZANTI NOKTASI: hakediş approved/paid → muhasebe fişi / bildirim burada üretilebilir.
        } catch (err) {
          console.error(`[kafka] construction event işleme hatası (topic=${topic}):`, err);
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
}
