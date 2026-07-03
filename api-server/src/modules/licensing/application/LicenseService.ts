/**
 * LicenseService — lisans durumu + aktivasyon orkestrasyonu.
 *
 * Store (60 sn cache'li DB okuma) + saf verifier'ı birleştirir. Guard ve
 * route'lar yalnız bu servisi çağırır; imza/tarih/fingerprint kuralları
 * verifier.ts'te tek yerdedir.
 */
import type { PgLicenseStore } from '../infrastructure/persistence/PgLicenseStore.js';

import {
  licenseDaysLeft,
  parseLicenseFile,
  verifyLicense,
  type LicenseVerification,
} from './verifier.js';

export interface LicenseStatusDto {
  valid: boolean;
  reason?: LicenseVerification['reason'];
  customer?: string;
  validUntil?: string;
  daysLeft?: number;
  maxTerminals?: number;
  terminalsUsed?: number;
}

export interface VerificationOutcome {
  verification: LicenseVerification;
  /** false → DB'ye ulaşılamadı (guard fail-open kararı için). */
  dbOk: boolean;
}

export class LicenseService {
  constructor(
    private readonly store: PgLicenseStore,
    private readonly publicKeyPem: string,
    /** Bu makinenin donanım kimliği (config.PROMETA_FINGERPRINT). */
    private readonly machineFingerprint: string | null,
  ) {}

  /** Kayıtlı lisansı doğrular (store 60 sn cache'li). */
  async getVerification(): Promise<VerificationOutcome> {
    let stored;
    try {
      stored = await this.store.getStored();
    } catch {
      return { verification: { valid: false, reason: 'missing' }, dbOk: false };
    }
    if (!stored) {
      return { verification: { valid: false, reason: 'missing' }, dbOk: true };
    }
    const verification = verifyLicense(stored.licenseJson, {
      publicKeyPem: this.publicKeyPem,
      fingerprint: this.machineFingerprint,
    });
    return { verification, dbOk: true };
  }

  /** GET /status cevabı — payload'dan insan-okur alanlar + koltuk sayısı. */
  async getStatus(): Promise<LicenseStatusDto> {
    const { verification, dbOk } = await this.getVerification();
    const dto: LicenseStatusDto = { valid: verification.valid };
    if (verification.reason !== undefined) dto.reason = verification.reason;

    const p = verification.payload;
    if (p) {
      dto.customer = p.customer;
      dto.validUntil = p.validUntil;
      dto.daysLeft = licenseDaysLeft(p.validUntil);
      dto.maxTerminals = p.maxTerminals;
    }
    if (dbOk) {
      try {
        dto.terminalsUsed = await this.store.countTerminals();
      } catch {
        // Sayım alınamadıysa alanı boş bırak — status yine döner.
      }
    }
    return dto;
  }

  /**
   * Lisansı doğrulayıp (geçersizse doğrulama sonucunu döner, KAYDETMEZ)
   * license_store'a upsert eder ve cache'i tazeler.
   */
  async activate(
    raw: unknown,
    activatedBy: string | null,
  ): Promise<{ ok: boolean; verification: LicenseVerification }> {
    const verification = verifyLicense(raw, {
      publicKeyPem: this.publicKeyPem,
      fingerprint: this.machineFingerprint,
    });
    if (!verification.valid) return { ok: false, verification };

    // Normalize edilmiş { payload, signature } sakla (string geldiyse parse et).
    const file = parseLicenseFile(raw)!;
    await this.store.save(file, activatedBy);
    return { ok: true, verification };
  }
}
