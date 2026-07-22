/**
 * Beyanname modülü — DI kökü.
 *
 * registerBeyannameModule(pool) Pg repo + cipher + provider + service'leri wire
 * eder, Hono router döndürür. index.ts `/v1/beyanname` altına mount eder.
 *
 * AES master key EBEYAN_MASTER_KEY (yoksa EINVOICE_MASTER_KEY) env'den; yoksa
 * efemeral anahtar + uyarı (dev). Provider ortam'a göre seçilir: 'mock' →
 * MockEBeyanProvider (ağsız demo), 'test'/'prod' → GibEBeyanProvider.
 */
import { randomBytes } from 'node:crypto';

import type { Pool } from 'pg';

import type { BeyannameOrtam } from './application/dto/BeyannameDtos.js';
import type { EBeyanProvider } from './application/ports/EBeyanProvider.js';
import { BeyannameService } from './application/useCases/BeyannameService.js';
import { BeyannameCredentialService } from './application/useCases/CredentialUseCases.js';
import { AesGcmCredentialCipher } from './infrastructure/crypto/AesGcmCredentialCipher.js';
import { PgBeyannameCredentialRepository } from './infrastructure/persistence/PgBeyannameCredentialRepository.js';
import { PgBeyannameRepository } from './infrastructure/persistence/PgBeyannameRepository.js';
import { GibEBeyanProvider } from './infrastructure/provider/GibEBeyanProvider.js';
import { MockEBeyanProvider } from './infrastructure/provider/MockEBeyanProvider.js';
import { createBeyannameRouter, type BeyannameRouterDeps } from './presentation/routes.js';

function resolveCipher(): AesGcmCredentialCipher {
  try {
    return AesGcmCredentialCipher.fromEnv();
  } catch {
    console.warn(
      '[beyanname] EBEYAN_MASTER_KEY/EINVOICE_MASTER_KEY tanımsız — efemeral anahtar ' +
        'kullanılıyor (sadece dev). Production için 32 byte base64 anahtar tanımlayın.',
    );
    return new AesGcmCredentialCipher(randomBytes(32));
  }
}

export function registerBeyannameModule(pool: Pool): ReturnType<typeof createBeyannameRouter> {
  const cipher = resolveCipher();
  const gibProvider = new GibEBeyanProvider();
  const mockProvider = new MockEBeyanProvider();
  const providerFor = (ortam: BeyannameOrtam): EBeyanProvider =>
    ortam === 'mock' ? mockProvider : gibProvider;

  const credRepo = new PgBeyannameCredentialRepository(pool);
  const beyannameRepo = new PgBeyannameRepository(pool);

  const deps: BeyannameRouterDeps = {
    credentials: new BeyannameCredentialService(credRepo, cipher, providerFor),
    beyanname: new BeyannameService(beyannameRepo, credRepo, cipher, providerFor),
  };

  return createBeyannameRouter(deps);
}
