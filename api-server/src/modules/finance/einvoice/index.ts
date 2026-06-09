/**
 * E-Fatura + FX modülü — DI (Faz 6 / PR 6).
 *
 * registerEInvoiceModule(pool) tüm Pg repo + use-case'leri wire eder, Hono
 * router döndürür. app.ts `/v1/finance` altına (finance ile aynı prefix) mount eder.
 *
 * AES master key EINVOICE_MASTER_KEY env'den; yoksa efemeral anahtar + uyarı
 * (dev). Provider varsayılan ELogoProvider; 'mock' kayıtları için de SOAP
 * çağrısı yapılmaz (Mock ayrı testlerde kullanılır).
 */
import { randomBytes } from 'node:crypto';

import type { Pool } from 'pg';

import { SystemClock } from '../application/ports/Clock.js';
import {
  FetchAndStoreRatesUseCase,
  GetCurrentRatesUseCase,
  GetRateAtUseCase,
} from '../fx/application/useCases/RateUseCases.js';
import {
  CreateRevaluationUseCase,
  ListRevaluationsUseCase,
  PostRevaluationUseCase,
} from '../fx/application/useCases/RevaluationUseCases.js';
import { PgExchangeRateRepository } from '../fx/infrastructure/persistence/PgExchangeRateRepository.js';
import { PgRevaluationRepository } from '../fx/infrastructure/persistence/PgRevaluationRepository.js';
import { TcmbRateProvider } from '../fx/infrastructure/rates/TcmbRateProvider.js';

import {
  DeleteCredentialUseCase,
  SaveCredentialUseCase,
  TestConnectionUseCase,
} from './application/useCases/CredentialUseCases.js';
import {
  IgnoreEInvoiceUseCase,
  ImportEInvoiceFromFileUseCase,
  ImportEInvoiceUseCase,
  ListEInvoicesUseCase,
} from './application/useCases/ImportEInvoiceUseCases.js';
import {
  ListUnmappedPartiesUseCase,
  MapPartyUseCase,
} from './application/useCases/PartyMappingUseCases.js';
import { SyncEInvoicesUseCase } from './application/useCases/SyncEInvoicesUseCase.js';
import { AesGcmCredentialCipher } from './infrastructure/crypto/AesGcmCredentialCipher.js';
import { PgEInvoiceCredentialRepository } from './infrastructure/persistence/PgEInvoiceCredentialRepository.js';
import { PgEInvoiceRepository } from './infrastructure/persistence/PgEInvoiceRepository.js';
import { PgPartyMappingRepository } from './infrastructure/persistence/PgPartyMappingRepository.js';
import { PgSyncLogRepository } from './infrastructure/persistence/PgSyncLogRepository.js';
import { ELogoProvider } from './infrastructure/provider/ELogoProvider.js';
import { PgEInvoiceUnitOfWork } from './infrastructure/unitOfWork/PgEInvoiceUnitOfWork.js';
import { createEInvoiceRouter, type EInvoiceRouterDeps } from './presentation/routes.js';

function resolveCipher(): AesGcmCredentialCipher {
  try {
    return AesGcmCredentialCipher.fromEnv();
  } catch {
    console.warn(
      '[einvoice] EINVOICE_MASTER_KEY tanımsız — efemeral anahtar kullanılıyor (sadece dev). ' +
        'Production için 32 byte base64 anahtar tanımlayın.',
    );
    return new AesGcmCredentialCipher(randomBytes(32));
  }
}

export function registerEInvoiceModule(pool: Pool): ReturnType<typeof createEInvoiceRouter> {
  const clock = SystemClock;
  const cipher = resolveCipher();
  const provider = new ELogoProvider();

  // Repos
  const einvoices = new PgEInvoiceRepository(pool);
  const credentials = new PgEInvoiceCredentialRepository(pool);
  const syncLog = new PgSyncLogRepository(pool);
  const parties = new PgPartyMappingRepository(pool);
  const rates = new PgExchangeRateRepository(pool);
  const revaluations = new PgRevaluationRepository(pool);
  const uow = new PgEInvoiceUnitOfWork(pool);
  const rateProvider = new TcmbRateProvider({
    ...(process.env.TCMB_API_KEY !== undefined ? { apiKey: process.env.TCMB_API_KEY } : {}),
  });

  const deps: EInvoiceRouterDeps = {
    listEInvoices: new ListEInvoicesUseCase(einvoices),
    syncEInvoices: new SyncEInvoicesUseCase(
      credentials,
      cipher,
      provider,
      einvoices,
      syncLog,
      clock,
    ),
    importEInvoice: new ImportEInvoiceUseCase(uow, parties, clock),
    importEInvoiceFromFile: new ImportEInvoiceFromFileUseCase(einvoices),
    ignoreEInvoice: new IgnoreEInvoiceUseCase(einvoices),
    saveCredential: new SaveCredentialUseCase(credentials, cipher),
    testConnection: new TestConnectionUseCase(credentials, cipher, provider),
    deleteCredential: new DeleteCredentialUseCase(credentials),
    mapParty: new MapPartyUseCase(parties),
    listUnmappedParties: new ListUnmappedPartiesUseCase(einvoices, parties),
    syncLog,
    fetchAndStoreRates: new FetchAndStoreRatesUseCase(rateProvider, rates, clock),
    getCurrentRates: new GetCurrentRatesUseCase(rates),
    getRateAt: new GetRateAtUseCase(rates),
    createRevaluation: new CreateRevaluationUseCase(revaluations, rates, clock),
    postRevaluation: new PostRevaluationUseCase(revaluations, clock),
    listRevaluations: new ListRevaluationsUseCase(revaluations),
  };

  return createEInvoiceRouter(deps);
}
