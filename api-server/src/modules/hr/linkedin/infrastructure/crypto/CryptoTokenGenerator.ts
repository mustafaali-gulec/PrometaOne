/**
 * CryptoTokenGenerator — node:crypto tabanlı URL-güvenli jeton üreteci.
 * Public besleme adresinin tek koruması bu jeton olduğu için kaynak
 * Math.random DEĞİL, kriptografik CSPRNG'dir.
 */
import { randomBytes } from 'node:crypto';

import type { TokenGenerator } from '../../application/ports/TokenGenerator.js';

export class CryptoTokenGenerator implements TokenGenerator {
  generate(byteLength = 24): string {
    return randomBytes(byteLength).toString('base64url');
  }
}
