/**
 * CredentialCipher — entegratör erişim config'inin at-rest şifreleme portu.
 *
 * Domain/application katmanı şifreleme algoritmasını bilmez; yalnızca düz
 * `CredentialConfig` ile şifreli blob arasında gidip gelir. Concrete impl:
 * infrastructure/crypto/AesGcmCredentialCipher.ts (AES-256-GCM).
 */
import type { CredentialConfig } from '../../domain/entities/EInvoiceCredential.js';

/** DB'ye yazılan 3 parça: ciphertext + IV + auth tag. */
export interface EncryptedCredential {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
}

export interface CredentialCipher {
  encrypt(config: CredentialConfig): EncryptedCredential;
  decrypt(blob: EncryptedCredential): CredentialConfig;
}
