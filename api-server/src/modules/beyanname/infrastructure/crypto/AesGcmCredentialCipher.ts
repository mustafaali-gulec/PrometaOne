/**
 * AesGcmCredentialCipher — CredentialCipher'in AES-256-GCM implementasyonu.
 *
 * Master key constructor'a enjekte edilir (test edilebilirlik); `fromEnv` ile
 * `EBEYAN_MASTER_KEY` (base64, 32 byte) — yoksa `EINVOICE_MASTER_KEY` — ortam
 * değişkeninden kurulur (e-Fatura ile aynı anahtar paylaşılabilir).
 *
 * - IV: 12 byte (GCM önerisi), her şifrelemede rastgele.
 * - Auth tag: 16 byte; decrypt'te doğrulanır (kurcalama → CredentialDecryptError).
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import type { BeyannameConfig } from '../../application/dto/BeyannameDtos.js';
import type {
  CredentialCipher,
  EncryptedCredential,
} from '../../application/ports/CredentialCipher.js';
import { CredentialDecryptError } from '../../domain/errors/BeyannameErrors.js';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const KEY_LEN = 32;

export class AesGcmCredentialCipher implements CredentialCipher {
  constructor(private readonly key: Buffer) {
    if (key.length !== KEY_LEN) {
      throw new Error(`AES anahtarı ${KEY_LEN} byte (256-bit) olmalı, ${key.length} byte verildi`);
    }
  }

  /**
   * `EBEYAN_MASTER_KEY` (base64, 32 byte) — yoksa `EINVOICE_MASTER_KEY` — ortam
   * değişkeninden kurar.
   * Oluşturma: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): AesGcmCredentialCipher {
    const raw = env.EBEYAN_MASTER_KEY ?? env.EINVOICE_MASTER_KEY;
    if (raw === undefined || raw === '') {
      throw new Error('EBEYAN_MASTER_KEY / EINVOICE_MASTER_KEY ortam değişkeni tanımlı değil');
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== KEY_LEN) {
      throw new Error('EBEYAN_MASTER_KEY 32 byte (256-bit, base64) olmalı');
    }
    return new AesGcmCredentialCipher(key);
  }

  encrypt(config: BeyannameConfig): EncryptedCredential {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const plaintext = Buffer.from(JSON.stringify(config), 'utf-8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { ciphertext, iv, tag };
  }

  decrypt(blob: EncryptedCredential): BeyannameConfig {
    try {
      const decipher = createDecipheriv(ALGO, this.key, blob.iv);
      decipher.setAuthTag(blob.tag);
      const plaintext = Buffer.concat([decipher.update(blob.ciphertext), decipher.final()]);
      return JSON.parse(plaintext.toString('utf-8')) as BeyannameConfig;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new CredentialDecryptError(reason);
    }
  }
}
