/**
 * Lisanslama (Licensing) modülü — Public API + DI.
 *
 * registerLicensingModule(pool) store + servis + router + guard'ı wire eder.
 * index.ts router'ı `/v1/license` altına mount eder ve licenseGuard'ı route
 * kayıtlarından ÖNCE `v1.use('*', ...)` olarak bağlar.
 *
 * Ed25519 imzalı license.lic doğrulaması yapılır (tools/license-generator ile
 * kesilir); public key publicKey.ts'te gömülüdür, LICENSE_PUBLIC_KEY_PEM env
 * ile override edilebilir. Makine kimliği PROMETA_FINGERPRINT env'inden gelir.
 */
import type { MiddlewareHandler } from 'hono';
import type { Hono } from 'hono';
import type { Pool } from 'pg';

import { config } from '../../config.js';

import { LicenseService } from './application/LicenseService.js';
import { PgLicenseStore } from './infrastructure/persistence/PgLicenseStore.js';
import { createLicenseGuard } from './presentation/licenseGuard.js';
import { createLicensingRouter } from './presentation/routes.js';
import { resolveLicensePublicKeyPem } from './publicKey.js';

export interface LicensingModule {
  router: Hono;
  licenseGuard: MiddlewareHandler;
}

export function registerLicensingModule(pool: Pool): LicensingModule {
  const store = new PgLicenseStore(pool);
  // Boş string (compose'daki ${PROMETA_FINGERPRINT:-} öndeğeri) = tanımsız.
  const machineFingerprint = config.PROMETA_FINGERPRINT?.trim() || null;
  const service = new LicenseService(
    store,
    resolveLicensePublicKeyPem(config.LICENSE_PUBLIC_KEY_PEM),
    machineFingerprint,
  );

  return {
    router: createLicensingRouter({ service, store, machineFingerprint }),
    licenseGuard: createLicenseGuard({ service, store }),
  };
}
