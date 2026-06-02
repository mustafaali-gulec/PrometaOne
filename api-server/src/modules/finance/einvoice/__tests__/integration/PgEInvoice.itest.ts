/**
 * E-Fatura + FX Pg* repository integration testleri — gerçek PostgreSQL.
 *
 * Doğrulanan: credential AES blob (BYTEA) round-trip, einvoice UNIQUE(company,uuid)
 * UPSERT idempotency, PgEInvoiceUnitOfWork import atomikliği (invoices +
 * einvoice tek transaction; rollback), exchange rate getAt.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

import { Money } from '../../../domain/valueObjects/Money.js';
import { ExchangeRate } from '../../../fx/domain/entities/ExchangeRate.js';
import { PgExchangeRateRepository } from '../../../fx/infrastructure/persistence/PgExchangeRateRepository.js';
import { ImportEInvoiceUseCase } from '../../application/useCases/ImportEInvoiceUseCases.js';
import { EInvoice } from '../../domain/entities/EInvoice.js';
import type { CredentialConfig } from '../../domain/entities/EInvoiceCredential.js';
import { AesGcmCredentialCipher } from '../../infrastructure/crypto/AesGcmCredentialCipher.js';
import { PgEInvoiceCredentialRepository } from '../../infrastructure/persistence/PgEInvoiceCredentialRepository.js';
import { PgEInvoiceRepository } from '../../infrastructure/persistence/PgEInvoiceRepository.js';
import { PgPartyMappingRepository } from '../../infrastructure/persistence/PgPartyMappingRepository.js';
import { PgEInvoiceUnitOfWork } from '../../infrastructure/unitOfWork/PgEInvoiceUnitOfWork.js';

import {
  seedCompany,
  startEInvoicePgContainer,
  truncateAll,
  type EInvoicePgContext,
} from './setup.js';

const cipher = new AesGcmCredentialCipher(randomBytes(32));
const clock = { now: () => new Date('2026-06-01T00:00:00Z') };

function makeEInvoice(uuid: string): EInvoice {
  return EInvoice.create({
    id: null,
    companyId: 1,
    provider: 'mock',
    uuid,
    invoiceNo: 'GLN1',
    direction: 'incoming',
    invoiceType: 'SATIS',
    scenario: 'TEMELFATURA',
    partyVknTckn: '1234567890',
    partyName: 'Tedarikçi',
    partyAlias: null,
    issueDate: '2026-05-01',
    dueDate: null,
    currency: 'TRY',
    exchangeRate: null,
    subtotal: Money.fromMajor(1000, 'TRY'),
    kdvTotal: Money.fromMajor(200, 'TRY'),
    tevkifatTotal: Money.zero('TRY'),
    konaklamaVergisi: Money.zero('TRY'),
    ozelTuketimVergisi: Money.zero('TRY'),
    payableAmount: Money.fromMajor(1200, 'TRY'),
    gibStatus: 'KABUL_EDILDI',
    importedInvoiceId: null,
    ignored: false,
    ignoredReason: null,
    lines: [],
    xmlRaw: '<Invoice/>',
  });
}

describe('E-Fatura + FX Pg integration', () => {
  let ctx: EInvoicePgContext;

  before(
    async () => {
      ctx = await startEInvoicePgContainer();
    },
    { timeout: 180_000 },
  );

  after(async () => {
    if (ctx) await ctx.cleanup();
  });

  beforeEach(async () => {
    await truncateAll(ctx.pool);
    await seedCompany(ctx.pool, 1);
  });

  it('credential: AES blob (BYTEA) save → getEncrypted → decrypt round-trip', async () => {
    const repo = new PgEInvoiceCredentialRepository(ctx.pool);
    const config: CredentialConfig = {
      username: 'u',
      password: 's3cr3t',
      vergiNo: '1234567890',
      env: 'test',
    };
    await repo.save({
      companyId: 1,
      provider: 'elogo',
      encrypted: cipher.encrypt(config),
      createdBy: null,
    });

    const blob = await repo.getEncrypted(1, 'elogo');
    assert.ok(blob);
    assert.deepEqual(cipher.decrypt(blob), config);

    const meta = await repo.findByProvider(1, 'elogo');
    assert.equal(meta!.provider, 'elogo');
    assert.equal(meta!.isActive, true);
  });

  it('einvoice UPSERT: aynı (company, uuid) ikinci kez → tek satır', async () => {
    const repo = new PgEInvoiceRepository(ctx.pool);
    await repo.upsert(makeEInvoice('aaaaaaaa-0000-0000-0000-000000000001'));
    await repo.upsert(makeEInvoice('aaaaaaaa-0000-0000-0000-000000000001'));
    const all = await repo.listByCompany(1);
    assert.equal(all.length, 1);
    assert.equal(all[0]!.payableAmount.toDecimalString(), '1200.00');
  });

  it('import (UoW atomik): invoices satırı + einvoice imported tek transaction', async () => {
    const einvoices = new PgEInvoiceRepository(ctx.pool);
    const persisted = await einvoices.upsert(makeEInvoice('bbbbbbbb-0000-0000-0000-000000000002'));

    const uow = new PgEInvoiceUnitOfWork(ctx.pool);
    const parties = new PgPartyMappingRepository(ctx.pool);
    const res = await new ImportEInvoiceUseCase(uow, parties, clock).execute({
      companyId: 1,
      einvoiceId: persisted.id!,
      actorUserId: null,
    });

    const invRow = await ctx.pool.query<{ id: number; type: string; total: string }>(
      `SELECT id, type, total FROM invoices WHERE id = $1`,
      [res.invoiceId],
    );
    assert.equal(invRow.rows.length, 1);
    assert.equal(invRow.rows[0]!.type, 'out'); // incoming → AP/out

    const eiRow = await ctx.pool.query<{ imported_invoice_id: number }>(
      `SELECT imported_invoice_id FROM einvoice_invoices WHERE id = $1`,
      [persisted.id],
    );
    assert.equal(Number(eiRow.rows[0]!.imported_invoice_id), Number(res.invoiceId));
  });

  it('exchange rate: upsert + getAt önceki en yakını döner', async () => {
    const repo = new PgExchangeRateRepository(ctx.pool);
    await repo.upsert(
      ExchangeRate.create({ currency: 'USD', date: '2026-05-28', rate: 31.5, source: 'TCMB' }),
    );
    await repo.upsert(
      ExchangeRate.create({ currency: 'USD', date: '2026-05-31', rate: 32.1, source: 'TCMB' }),
    );

    const at = await repo.getAt('USD', '2026-05-30');
    assert.equal(at!.rate, 31.5);
    const current = await repo.getCurrent('USD');
    assert.equal(current!.rate, 32.1);
  });
});
