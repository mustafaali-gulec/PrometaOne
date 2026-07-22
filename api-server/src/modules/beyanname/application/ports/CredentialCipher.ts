/**
 * CredentialCipher — e-Beyan entegrasyon config'inin at-rest şifreleme portu.
 *
 * Domain/application katmanı algoritmayı bilmez; yalnızca düz `BeyannameConfig`
 * ile şifreli blob arasında gidip gelir. Concrete impl:
 * infrastructure/crypto/AesGcmCredentialCipher.ts (AES-256-GCM).
 */
import type { BeyannameConfig } from '../dto/BeyannameDtos.js';

/** DB'ye yazılan 3 parça: ciphertext + IV + auth tag. */
export interface EncryptedCredential {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
}

export interface CredentialCipher {
  encrypt(config: BeyannameConfig): EncryptedCredential;
  decrypt(blob: EncryptedCredential): BeyannameConfig;
}
