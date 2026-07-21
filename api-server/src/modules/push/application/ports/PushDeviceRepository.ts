/**
 * PushDeviceRepository — port (interface).
 *
 * Concrete implementation: infrastructure/persistence/PgPushDeviceRepository.ts
 */
import type {
  PushDevice,
  PushKeys,
  PushPlatform,
  PushProvider,
} from '../../domain/entities/PushDevice.js';

export interface UpsertDeviceInput {
  /** Yeni kayıt için id — endpoint zaten kayıtlıysa MEVCUT id korunur. */
  id: string;
  userId: string | null;
  username: string;
  platform: PushPlatform;
  provider: PushProvider;
  endpoint: string;
  keys: PushKeys | null;
  userAgent: string | null;
  bundleId: string | null;
}

export interface PushDeviceRepository {
  /**
   * endpoint üzerine upsert. Çakışmada (ON CONFLICT (endpoint)) kayıt yeniden
   * aktive edilir: active=true, last_used_at=now(), keys/user_agent ve sahiplik
   * (username/user_id) tazelenir. Dönen değer upsert SONRASI satırdır
   * (id mevcut kaydınki olabilir).
   */
  upsertByEndpoint(input: UpsertDeviceInput): Promise<PushDevice>;

  /**
   * Kullanıcının cihazlarını topluca pasife alır. provider verilirse yalnız o
   * provider'ınkiler. Döner: pasife alınan satır sayısı.
   */
  deactivateByUsernameProvider(username: string, provider?: PushProvider): Promise<number>;

  /** Tek endpoint'i pasife alır. Döner: pasife alınan satır sayısı (0|1). */
  deactivateByEndpoint(endpoint: string): Promise<number>;

  /** Kullanıcının AKTİF cihazları. */
  findActiveByUsername(username: string): Promise<PushDevice[]>;

  /** Verilen endpoint'lerle eşleşen TÜM kayıtlar (aktif+pasif). */
  findByEndpoints(endpoints: string[]): Promise<PushDevice[]>;

  /** Başarılı gönderim sonrası last_used_at=now() günceller. */
  touchLastUsed(endpoints: string[]): Promise<void>;
}
