/**
 * EventPublisher — domain olaylarını dış dünyaya (Kafka) yayınlama portu.
 * Servis Kafka'sız da çalışmalı → infra katmanında no-op fallback vardır.
 * Yayın hatası ASLA iş akışını kırmamalı (impl içinde yutulur).
 */
export interface DomainEvent {
  /** Mantıksal konu (infra'da prefix eklenir): 'hakedis' | 'stock' | ... */
  topic: string;
  /** Partition/sıralama anahtarı (ör. progressId, materialId). */
  key: string;
  /** Olay tipi: 'status_changed' | 'moved' | ... */
  type: string;
  /** Olay gövdesi (JSON-serileştirilebilir). */
  payload: Record<string, unknown>;
}

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}
