/**
 * license-activate — lisans dosyasını doğrulayıp license_store'a yazar (CLI).
 *
 * Kullanım (kurulum sihirbazı bunu çağırır):
 *   npm run license:activate -- /license/license.lic
 *   docker compose exec api npm run license:activate -- /license/license.lic
 *
 * tsx ile çalışır ve doğrulama mantığını src'deki verifier'dan İMPORT eder
 * (kopya yok). Bilinçli olarak config.ts'e bağlanmaz — yalnız DATABASE_URL
 * (zorunlu) ve PROMETA_FINGERPRINT / LICENSE_PUBLIC_KEY_PEM (opsiyonel) env
 * değişkenlerini okur; JWT_SECRET vb. gerektirmez.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Pool } from 'pg';

import {
  licenseDaysLeft,
  parseLicenseFile,
  verifyLicense,
} from '../src/modules/licensing/application/verifier.js';
import { resolveLicensePublicKeyPem } from '../src/modules/licensing/publicKey.js';

function fail(msg: string): never {
  console.error(`HATA: ${msg}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const fileArg = process.argv[2];
  if (!fileArg) {
    fail('Kullanım: npm run license:activate -- <lisans-dosyası (license.lic)>');
  }

  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) fail('DATABASE_URL tanımlı değil.');

  const path = resolve(fileArg);
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    fail(`Lisans dosyası okunamadı: ${path}`);
  }

  // 1) Doğrula (imza + ürün + tarih + fingerprint)
  const verification = verifyLicense(raw, {
    publicKeyPem: resolveLicensePublicKeyPem(process.env['LICENSE_PUBLIC_KEY_PEM']),
    fingerprint: process.env['PROMETA_FINGERPRINT'] ?? null,
  });

  if (!verification.valid) {
    const reasons: Record<string, string> = {
      missing: 'dosya boş',
      invalid_signature: 'imza geçersiz veya dosya bozuk/tahrif edilmiş',
      wrong_product: 'lisans başka bir ürüne ait',
      expired: 'lisansın süresi dolmuş',
      not_yet_valid: 'lisans tarihi henüz gelmemiş (issuedAt gelecekte)',
      fingerprint_mismatch: 'lisans başka bir makineye kilitli (PROMETA_FINGERPRINT eşleşmiyor)',
    };
    fail(
      `Lisans doğrulanamadı — ${reasons[verification.reason ?? ''] ?? verification.reason}. Lisans KAYDEDİLMEDİ.`,
    );
  }

  const payload = verification.payload!;
  const file = parseLicenseFile(raw)!;

  // 2) license_store'a upsert (id=1)
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await pool.query(
      `INSERT INTO license_store (id, license_json, activated_at, activated_by)
         VALUES (1, $1::jsonb, NOW(), $2)
       ON CONFLICT (id) DO UPDATE
         SET license_json = EXCLUDED.license_json,
             activated_at = EXCLUDED.activated_at,
             activated_by = EXCLUDED.activated_by`,
      [JSON.stringify(file), 'license:activate script'],
    );
  } finally {
    await pool.end();
  }

  console.log('Lisans doğrulandı ve etkinleştirildi.');
  console.log(`  Lisans ID     : ${payload.licenseId}`);
  console.log(`  Müşteri       : ${payload.customer}`);
  console.log(
    `  Son geçerlilik: ${payload.validUntil} (kalan ${licenseDaysLeft(payload.validUntil)} gün)`,
  );
  console.log(`  Maks terminal : ${payload.maxTerminals}`);
  console.log(`  Parmak izi    : ${payload.fingerprint ?? '(kilitli değil)'}`);
  console.log('');
  console.log('Not: API sunucusu lisansı 60 sn içinde otomatik görür (cache).');
}

main().catch((err: unknown) => {
  console.error('Beklenmeyen hata:', err);
  process.exit(1);
});
