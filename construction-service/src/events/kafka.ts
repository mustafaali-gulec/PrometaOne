/**
 * EventPublisher infra impl'leri.
 *   - KafkaEventPublisher: kafkajs producer; topic = `${prefix}.${event.topic}`.
 *     Yayın hatası loglanır ama ASLA fırlatılmaz (iş akışını kırmaz).
 *   - NoopEventPublisher: Kafka yoksa (KAFKA_BROKERS tanımsız) sessiz no-op.
 * Factory env'e göre uygun impl'i seçer.
 */
import { Kafka, type Producer } from 'kafkajs';

import type { DomainEvent, EventPublisher } from '../modules/construction/application/ports/EventPublisher.js';
import { config } from '../config.js';

export class NoopEventPublisher implements EventPublisher {
  async publish(_event: DomainEvent): Promise<void> {
    // Kafka yapılandırılmamış — sessizce yut.
  }
}

export class KafkaEventPublisher implements EventPublisher {
  private readonly producer: Producer;
  private connected = false;

  constructor(
    brokers: ReadonlyArray<string>,
    clientId: string,
    private readonly topicPrefix: string,
  ) {
    const kafka = new Kafka({ clientId, brokers: [...brokers] });
    this.producer = kafka.producer({ allowAutoTopicCreation: true });
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await this.producer.connect();
    this.connected = true;
    console.log('[kafka] producer bağlandı');
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    try {
      await this.producer.disconnect();
    } finally {
      this.connected = false;
    }
  }

  async publish(event: DomainEvent): Promise<void> {
    const topic = `${this.topicPrefix}.${event.topic}`;
    try {
      if (!this.connected) await this.connect();
      await this.producer.send({
        topic,
        messages: [
          {
            key: event.key,
            value: JSON.stringify({
              type: event.type,
              payload: event.payload,
              emittedAt: new Date().toISOString(),
              source: 'construction-service',
            }),
            headers: { 'event-type': event.type },
          },
        ],
      });
    } catch (err) {
      // Event yayını iş akışını kırmamalı — yalnızca logla.
      console.error(`[kafka] yayın hatası (topic=${topic}, type=${event.type}):`, err);
    }
  }
}

let singleton: EventPublisher | null = null;

/** Env'e göre publisher: Kafka broker varsa Kafka, yoksa no-op. */
export function getEventPublisher(): EventPublisher {
  if (singleton) return singleton;
  if (config.kafkaBrokers.length > 0) {
    singleton = new KafkaEventPublisher(
      config.kafkaBrokers,
      config.KAFKA_CLIENT_ID,
      config.KAFKA_TOPIC_PREFIX,
    );
  } else {
    console.warn('[kafka] KAFKA_BROKERS tanımsız — event publisher no-op modunda');
    singleton = new NoopEventPublisher();
  }
  return singleton;
}
