/**
 * CredentialCipher — LinkedIn OAuth kimliğinin at-rest şifreleme portu.
 *
 * Domain/application katmanı algoritmayı bilmez; yalnızca düz
 * `LinkedInCredentialConfig` ile şifreli blob arasında gidip gelir.
 * Concrete impl: infrastructure/crypto/AesGcmCredentialCipher.ts (AES-256-GCM).
 */
import type { LinkedInCredentialConfig } from '../../domain/entities/LinkedInConnection.js';

/** DB'ye yazılan 3 parça: ciphertext + IV + auth tag. */
export interface EncryptedCredential {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
}

export interface CredentialCipher {
  encrypt(config: LinkedInCredentialConfig): EncryptedCredential;
  decrypt(blob: EncryptedCredential): LinkedInCredentialConfig;
}
