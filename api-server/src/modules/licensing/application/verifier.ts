/**
 * Lisans doğrulayıcı — Ed25519 imza + iş kuralları (SAF, config/DB bağımsız).
 *
 * Kontrol sırası: imza → product → validUntil (expired) → issuedAt
 * (not_yet_valid) → fingerprint. validUntil (YYYY-MM-DD) günü SONUNA kadar
 * geçerlidir (23:59:59, Europe/Istanbul kabulü — basitçe UTC+3 sabiti).
 *
 * DİKKAT: canonicalJSON, tools/license-generator/cli.js içindeki kopyasıyla
 * BİREBİR AYNI olmalıdır — imza bu kanonik metin üzerinde atılır/doğrulanır.
 *
 * Bu dosya bilinçli olarak config.ts'e bağımlı DEĞİLDİR:
 * scripts/license-activate.ts onu tam env kurulumları olmadan da (tsx ile)
 * import edebilir.
 */
import { verify as cryptoVerify } from 'node:crypto';

export interface LicensePayload {
  licenseId: string;
  product: string;
  customer: string;
  issuedAt: string;
  validUntil: string;
  maxTerminals: number;
  fingerprint: string | null;
  features: string[];
  notes: string;
}

export interface LicenseFile {
  payload: LicensePayload;
  signature: string;
}

export type LicenseInvalidReason =
  | 'missing'
  | 'invalid_signature'
  | 'wrong_product'
  | 'expired'
  | 'not_yet_valid'
  | 'fingerprint_mismatch';

export interface LicenseVerification {
  valid: boolean;
  reason?: LicenseInvalidReason;
  payload?: LicensePayload;
}

export interface VerifyLicenseOptions {
  publicKeyPem: string;
  /** Bu makinenin donanım kimliği (config.PROMETA_FINGERPRINT). */
  fingerprint?: string | null;
  /** Test edilebilirlik için "şimdi"; öndeğer new Date(). */
  now?: Date;
}

export const LICENSE_PRODUCT = 'prometa-one';

/** issuedAt için tolere edilen saat kayması (ileri tarihli görünme). */
const ISSUED_AT_SKEW_MS = 5 * 60 * 1000;

// ============================================================================
// canonicalJSON — anahtarları rekürsif alfabetik sıralanmış JSON.stringify.
// tools/license-generator/cli.js içindeki kopyasıyla BİREBİR AYNI tutun.
// ============================================================================
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map((v) => canonicalJSON(v)).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJSON(obj[k])).join(',') + '}';
}

/** Parmak izi karşılaştırması büyük/küçük harf duyarsızdır. */
export function normalizeFingerprint(fp: string): string {
  return fp.trim().toUpperCase();
}

/** validUntil (YYYY-MM-DD) gününün SON ANI — epoch ms (23:59:59.999, UTC+3). */
export function licenseExpiryMomentMs(validUntil: string): number {
  return Date.parse(`${validUntil}T23:59:59.999+03:00`);
}

/** Bitişe kalan tam gün sayısı (bugün dahil, en az 0). */
export function licenseDaysLeft(validUntil: string, now: Date = new Date()): number {
  const expiry = licenseExpiryMomentMs(validUntil);
  if (!Number.isFinite(expiry)) return 0;
  return Math.max(0, Math.ceil((expiry - now.getTime()) / 86_400_000));
}

/**
 * Lisans dosyasını (string ya da parse edilmiş obje) yapısal olarak ayrıştırır.
 * Geçersiz yapı → null (çağıran 'invalid_signature'/'missing' karar verir).
 */
export function parseLicenseFile(raw: unknown): LicenseFile | null {
  let doc: unknown = raw;
  if (typeof doc === 'string') {
    try {
      doc = JSON.parse(doc);
    } catch {
      return null;
    }
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  const d = doc as { payload?: unknown; signature?: unknown };
  if (typeof d.signature !== 'string' || !d.payload || typeof d.payload !== 'object') return null;
  return { payload: d.payload as LicensePayload, signature: d.signature };
}

/**
 * Tam lisans doğrulaması. Asla throw etmez — her hata durumu { valid:false,
 * reason } olarak döner.
 */
export function verifyLicense(license: unknown, opts: VerifyLicenseOptions): LicenseVerification {
  if (license === null || license === undefined || license === '') {
    return { valid: false, reason: 'missing' };
  }

  const file = parseLicenseFile(license);
  if (!file) return { valid: false, reason: 'invalid_signature' };
  const payload = file.payload;

  // 1) İmza (Ed25519 — canonicalJSON(payload) üzerinde)
  let sigOk = false;
  try {
    sigOk = cryptoVerify(
      null,
      Buffer.from(canonicalJSON(payload), 'utf8'),
      opts.publicKeyPem,
      Buffer.from(file.signature, 'base64'),
    );
  } catch {
    sigOk = false;
  }
  if (!sigOk) return { valid: false, reason: 'invalid_signature' };

  // 2) Ürün
  if (payload.product !== LICENSE_PRODUCT) {
    return { valid: false, reason: 'wrong_product', payload };
  }

  const nowMs = (opts.now ?? new Date()).getTime();

  // 3) validUntil — günü sonuna kadar (UTC+3) geçerli
  const expiryMs = licenseExpiryMomentMs(payload.validUntil);
  if (!Number.isFinite(expiryMs) || nowMs > expiryMs) {
    return { valid: false, reason: 'expired', payload };
  }

  // 4) issuedAt gelecekte mi (küçük saat kaymasına tolerans)
  const issuedMs = Date.parse(payload.issuedAt);
  if (Number.isFinite(issuedMs) && issuedMs > nowMs + ISSUED_AT_SKEW_MS) {
    return { valid: false, reason: 'not_yet_valid', payload };
  }

  // 5) Parmak izi — lisans kilitliyse makine fingerprint'i eşleşmeli
  if (payload.fingerprint != null && payload.fingerprint !== '') {
    const machine = opts.fingerprint;
    if (!machine || normalizeFingerprint(machine) !== normalizeFingerprint(payload.fingerprint)) {
      return { valid: false, reason: 'fingerprint_mismatch', payload };
    }
  }

  return { valid: true, payload };
}
