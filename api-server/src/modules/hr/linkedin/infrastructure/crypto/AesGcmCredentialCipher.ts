/**
 * AesGcmCredentialCipher — LinkedIn OAuth kimliğinin AES-256-GCM şifrelemesi.
 *
 * einvoice/beyanname ile aynı kalıp. Master key sırayla aranır:
 *   HR_LINKEDIN_MASTER_KEY → EINVOICE_MASTER_KEY
 * İkisi de yoksa çağıran taraf (index.ts) efemeral anahtara düşer ve uyarır.
 *
 * DİKKAT: Anahtar değişirse kayıtlı token'lar çözülemez — kullanıcı LinkedIn
 * bağlantısını yeniden yetkilendirmek zorunda kalır.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import type {
  CredentialCipher,
  EncryptedCredential,
} from '../../application/ports/CredentialCipher.js';
import type { LinkedInCredentialConfig } from '../../domain/entities/LinkedInConnection.js';
import { LinkedInCredentialDecryptError } from '../../domain/errors/LinkedInErrors.js';

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
   * Ortam değişkeninden kurar. Oluşturma:
   *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): AesGcmCredentialCipher {
    const raw = env.HR_LINKEDIN_MASTER_KEY ?? env.EINVOICE_MASTER_KEY;
    if (raw === undefined || raw === '') {
      throw new Error('HR_LINKEDIN_MASTER_KEY / EINVOICE_MASTER_KEY tanımlı değil');
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== KEY_LEN) {
      throw new Error('LinkedIn master key 32 byte (256-bit, base64) olmalı');
    }
    return new AesGcmCredentialCipher(key);
  }

  encrypt(config: LinkedInCredentialConfig): EncryptedCredential {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const plaintext = Buffer.from(JSON.stringify(config), 'utf-8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return { ciphertext, iv, tag: cipher.getAuthTag() };
  }

  decrypt(blob: EncryptedCredential): LinkedInCredentialConfig {
    try {
      const decipher = createDecipheriv(ALGO, this.key, blob.iv);
      decipher.setAuthTag(blob.tag);
      const plaintext = Buffer.concat([decipher.update(blob.ciphertext), decipher.final()]);
      return JSON.parse(plaintext.toString('utf-8')) as LinkedInCredentialConfig;
    } catch (err) {
      throw new LinkedInCredentialDecryptError(err instanceof Error ? err.message : String(err));
    }
  }
}
