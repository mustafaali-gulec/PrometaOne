/**
 * E-Fatura application use-case testleri (PR 5): credential, sync, import, ignore,
 * list, party-mapping + UoW atomik rollback.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { beforeEach, describe, it } from 'node:test';

import { InMemoryInvoiceRepository } from '../../../__tests__/fakes.js';
import { Invoice } from '../../../domain/entities/Invoice.js';
import { KdvRate } from '../../../domain/valueObjects/KdvRate.js';
import { Money } from '../../../domain/valueObjects/Money.js';
import {
  DeleteCredentialUseCase,
  SaveCredentialUseCase,
  TestConnectionUseCase,
} from '../../application/useCases/CredentialUseCases.js';
import {
  IgnoreEInvoiceUseCase,
  ImportEInvoiceUseCase,
  ListEInvoicesUseCase,
} from '../../application/useCases/ImportEInvoiceUseCases.js';
import { MapPartyUseCase } from '../../application/useCases/PartyMappingUseCases.js';
import { SyncEInvoicesUseCase } from '../../application/useCases/SyncEInvoicesUseCase.js';
import type { CredentialConfig } from '../../domain/entities/EInvoiceCredential.js';
import {
  EInvoiceAlreadyImportedError,
  EInvoiceCredentialNotFoundError,
  EInvoiceNotFoundError,
} from '../../domain/errors/EInvoiceErrors.js';
import { AesGcmCredentialCipher } from '../../infrastructure/crypto/AesGcmCredentialCipher.js';
import { MockProvider } from '../../infrastructure/provider/MockProvider.js';
import {
  FakeEInvoiceUnitOfWork,
  FixedClock,
  InMemoryEInvoiceCredentialRepository,
  InMemoryEInvoiceRepository,
  InMemoryPartyMappingRepository,
  InMemorySyncLogRepository,
} from '../einvoiceFakes.js';

const cipher = new AesGcmCredentialCipher(randomBytes(32));
const config: CredentialConfig = {
  username: 'u',
  password: 'p',
  vergiNo: '1234567890',
  env: 'test',
};
const range = { dateFrom: '2026-01-01', dateTo: '2026-12-31' };

describe('Credential use-cases', () => {
  it('Save → getEncrypted decrypt round-trip + Test → ok', async () => {
    const creds = new InMemoryEInvoiceCredentialRepository();
    await new SaveCredentialUseCase(creds, cipher).execute({
      companyId: 100,
      provider: 'mock',
      config,
      actorUserId: 1,
    });

    const test = new TestConnectionUseCase(creds, cipher, MockProvider.demo());
    const result = await test.execute({ companyId: 100, provider: 'mock' });
    assert.equal(result.ok, true);
  });

  it('Test: kimlik yoksa EInvoiceCredentialNotFoundError', async () => {
    const creds = new InMemoryEInvoiceCredentialRepository();
    await assert.rejects(
      new TestConnectionUseCase(creds, cipher, MockProvider.demo()).execute({
        companyId: 100,
        provider: 'mock',
      }),
      EInvoiceCredentialNotFoundError,
    );
  });

  it('Delete: kimlik silinir', async () => {
    const creds = new InMemoryEInvoiceCredentialRepository();
    await new SaveCredentialUseCase(creds, cipher).execute({
      companyId: 100,
      provider: 'mock',
      config,
      actorUserId: null,
    });
    await new DeleteCredentialUseCase(creds).execute({ companyId: 100, provider: 'mock' });
    assert.equal(await creds.findByProvider(100, 'mock'), null);
  });
});

describe('SyncEInvoicesUseCase', () => {
  let creds: InMemoryEInvoiceCredentialRepository;
  let einvoices: InMemoryEInvoiceRepository;
  let syncLog: InMemorySyncLogRepository;

  beforeEach(async () => {
    creds = new InMemoryEInvoiceCredentialRepository();
    einvoices = new InMemoryEInvoiceRepository();
    syncLog = new InMemorySyncLogRepository();
    await new SaveCredentialUseCase(creds, cipher).execute({
      companyId: 100,
      provider: 'mock',
      config,
      actorUserId: 1,
    });
  });

  it("provider faturalarını cache'e yazar, yeni sayısı + log", async () => {
    const uc = new SyncEInvoicesUseCase(
      creds,
      cipher,
      MockProvider.demo(),
      einvoices,
      syncLog,
      new FixedClock(),
    );
    const res = await uc.execute({ companyId: 100, provider: 'mock', ...range, actorUserId: 1 });

    assert.equal(res.incomingNew, 1);
    assert.equal(res.outgoingNew, 1);
    assert.equal(res.status, 'success');
    assert.equal((await einvoices.listByCompany(100)).length, 2);
    assert.equal((await syncLog.listByCompany(100)).length, 1);
  });

  it('idempotent: ikinci sync 0 yeni (UNIQUE company,uuid)', async () => {
    const uc = new SyncEInvoicesUseCase(
      creds,
      cipher,
      MockProvider.demo(),
      einvoices,
      syncLog,
      new FixedClock(),
    );
    await uc.execute({ companyId: 100, provider: 'mock', ...range, actorUserId: 1 });
    const res2 = await uc.execute({ companyId: 100, provider: 'mock', ...range, actorUserId: 1 });
    assert.equal(res2.incomingNew, 0);
    assert.equal(res2.outgoingNew, 0);
    assert.equal((await einvoices.listByCompany(100)).length, 2); // çift kayıt yok
  });

  it('kimlik yoksa EInvoiceCredentialNotFoundError', async () => {
    const empty = new InMemoryEInvoiceCredentialRepository();
    const uc = new SyncEInvoicesUseCase(
      empty,
      cipher,
      MockProvider.demo(),
      einvoices,
      syncLog,
      new FixedClock(),
    );
    await assert.rejects(
      uc.execute({ companyId: 100, provider: 'mock', ...range, actorUserId: 1 }),
      EInvoiceCredentialNotFoundError,
    );
  });
});

describe('Import / Ignore / List', () => {
  let einvoices: InMemoryEInvoiceRepository;
  let invoices: InMemoryInvoiceRepository;
  let parties: InMemoryPartyMappingRepository;
  let uow: FakeEInvoiceUnitOfWork;

  beforeEach(async () => {
    einvoices = new InMemoryEInvoiceRepository();
    invoices = new InMemoryInvoiceRepository();
    parties = new InMemoryPartyMappingRepository();
    uow = new FakeEInvoiceUnitOfWork(einvoices, invoices);
    // sync ile 2 fatura cache'e yaz
    const creds = new InMemoryEInvoiceCredentialRepository();
    await new SaveCredentialUseCase(creds, cipher).execute({
      companyId: 100,
      provider: 'mock',
      config,
      actorUserId: 1,
    });
    await new SyncEInvoicesUseCase(
      creds,
      cipher,
      MockProvider.demo(),
      einvoices,
      new InMemorySyncLogRepository(),
      new FixedClock(),
    ).execute({ companyId: 100, provider: 'mock', ...range, actorUserId: 1 });
  });

  it('Import: invoice oluşur + einvoice imported (atomik)', async () => {
    const pending = await einvoices.listByCompany(100, { pendingOnly: true });
    const target = pending[0]!;
    const uc = new ImportEInvoiceUseCase(uow, parties, new FixedClock());
    const res = await uc.execute({ companyId: 100, einvoiceId: target.id!, actorUserId: 7 });

    assert.ok(res.invoiceId > 0);
    const invoice = await invoices.findById(res.invoiceId, 100);
    assert.ok(invoice);
    const reloaded = await einvoices.findById(target.id!, 100);
    assert.equal(reloaded!.isImported, true);
  });

  it('Import: party mapping cashflowCatId faturaya aktarılır', async () => {
    const incoming = (await einvoices.listByCompany(100, { direction: 'incoming' }))[0]!;
    await new MapPartyUseCase(parties).execute({
      companyId: 100,
      vknTckn: incoming.partyVknTckn!,
      cashflowCatId: 42,
    });
    const res = await new ImportEInvoiceUseCase(uow, parties, new FixedClock()).execute({
      companyId: 100,
      einvoiceId: incoming.id!,
      actorUserId: null,
    });
    const invoice = await invoices.findById(res.invoiceId, 100);
    assert.equal(invoice!.cashflowCatId, 42);
  });

  it('Import: zaten imported → EInvoiceAlreadyImportedError', async () => {
    const target = (await einvoices.listByCompany(100, { pendingOnly: true }))[0]!;
    const uc = new ImportEInvoiceUseCase(uow, parties, new FixedClock());
    await uc.execute({ companyId: 100, einvoiceId: target.id!, actorUserId: null });
    await assert.rejects(
      uc.execute({ companyId: 100, einvoiceId: target.id!, actorUserId: null }),
      EInvoiceAlreadyImportedError,
    );
  });

  it('Import: olmayan id → EInvoiceNotFoundError', async () => {
    await assert.rejects(
      new ImportEInvoiceUseCase(uow, parties, new FixedClock()).execute({
        companyId: 100,
        einvoiceId: 9999,
        actorUserId: null,
      }),
      EInvoiceNotFoundError,
    );
  });

  it('Ignore: ignored işaretlenir, pending listede görünmez', async () => {
    const target = (await einvoices.listByCompany(100, { pendingOnly: true }))[0]!;
    await new IgnoreEInvoiceUseCase(einvoices).execute({
      companyId: 100,
      einvoiceId: target.id!,
      reason: 'mükerrer',
    });
    const pending = await einvoices.listByCompany(100, { pendingOnly: true });
    assert.equal(
      pending.find((e) => e.id === target.id),
      undefined,
    );
  });

  it('List: direction filtresi', async () => {
    const incoming = await new ListEInvoicesUseCase(einvoices).execute({
      companyId: 100,
      direction: 'incoming',
    });
    assert.equal(incoming.length, 1);
    assert.equal(incoming[0]!.direction, 'incoming');
  });
});

describe('FakeEInvoiceUnitOfWork rollback', () => {
  it('fn throw ederse einvoice + invoice yazımları geri sarılır', async () => {
    const einvoices = new InMemoryEInvoiceRepository();
    const invoices = new InMemoryInvoiceRepository();
    const uow = new FakeEInvoiceUnitOfWork(einvoices, invoices);

    await assert.rejects(
      uow.withTransaction(async (repos) => {
        await repos.invoices.insert(
          Invoice.create({
            id: null,
            companyId: 100,
            type: 'in',
            invoiceNo: null,
            counterparty: 'X',
            issueDate: null,
            dueDate: '2026-01-01',
            currency: 'TRY',
            subtotal: Money.fromMajor(100, 'TRY'),
            kdvRate: KdvRate.create(0.2),
            kdv: Money.fromMajor(20, 'TRY'),
            total: Money.fromMajor(120, 'TRY'),
            paidAmount: Money.zero('TRY'),
            cashflowCatId: null,
            committedToCells: false,
            committedAt: null,
            note: null,
            createdBy: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        );
        throw new Error('boom');
      }),
      /boom/,
    );

    assert.equal((await invoices.listByCompany(100)).length, 0); // rollback
  });
});
