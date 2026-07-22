/**
 * ListKasaEntries / UpdateKasaEntry / DeleteKasaEntry use-case testleri —
 * şirket kapsamı (kasa_entries'te company kolonu yok, kasadan gelir; çapraz
 * tenant 404), hesap filtresi, kısmi güncelleme (committed durumu korunur),
 * kasa değişiminde para birimi hedef hesaptan, silme.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DeleteKasaEntryUseCase,
  ListKasaEntriesUseCase,
  RecordKasaEntryUseCase,
  UpdateKasaEntryUseCase,
} from '../../application/useCases/CashFlowUseCases.js';
import {
  KasaAccountNotFoundError,
  KasaEntryNotFoundError,
} from '../../domain/errors/FinanceErrors.js';
import {
  FixedClock,
  InMemoryKasaAccountRepository,
  InMemoryKasaEntryRepository,
} from '../fakes.js';

async function makeSut(): Promise<{
  accounts: InMemoryKasaAccountRepository;
  entries: InMemoryKasaEntryRepository;
  list: ListKasaEntriesUseCase;
  update: UpdateKasaEntryUseCase;
  del: DeleteKasaEntryUseCase;
  ids: { merkezTry: number; dovizEur: number; yabanci: number; e1: number; e2: number; e3: number };
}> {
  const accounts = new InMemoryKasaAccountRepository();
  const entries = new InMemoryKasaEntryRepository(accounts);
  const clock = new FixedClock();
  const record = new RecordKasaEntryUseCase(accounts, entries, clock);

  const merkezTry = await accounts.insert({
    companyId: 1,
    name: 'Merkez Kasa',
    currency: 'TRY',
    openingBalanceMajor: 0,
  });
  const dovizEur = await accounts.insert({
    companyId: 1,
    name: 'Döviz Kasa',
    currency: 'EUR',
    openingBalanceMajor: 0,
  });
  const yabanci = await accounts.insert({
    companyId: 2, // BAŞKA şirket
    name: 'Yabancı Kasa',
    currency: 'TRY',
    openingBalanceMajor: 0,
  });

  const e1 = await record.execute({
    companyId: 1,
    kasaAccountId: merkezTry.id,
    date: '2026-01-10',
    type: 'in',
    amount: 100,
    description: 'Tahsilat',
    category: 'Satış',
    actorUserId: 7,
  });
  const e2 = await record.execute({
    companyId: 1,
    kasaAccountId: dovizEur.id,
    date: '2026-01-11',
    type: 'out',
    amount: 50,
    actorUserId: 7,
  });
  const e3 = await record.execute({
    companyId: 2,
    kasaAccountId: yabanci.id,
    date: '2026-01-12',
    type: 'in',
    amount: 999,
    actorUserId: 7,
  });

  return {
    accounts,
    entries,
    list: new ListKasaEntriesUseCase(accounts, entries),
    update: new UpdateKasaEntryUseCase(accounts, entries, clock),
    del: new DeleteKasaEntryUseCase(accounts, entries),
    ids: {
      merkezTry: merkezTry.id,
      dovizEur: dovizEur.id,
      yabanci: yabanci.id,
      e1: e1.id!,
      e2: e2.id!,
      e3: e3.id!,
    },
  };
}

describe('ListKasaEntriesUseCase', () => {
  it('şirket-scoped liste: yalnız şirketin kasalarına bağlı hareketler döner', async () => {
    const { list, ids } = await makeSut();

    const res = await list.execute({ companyId: 1 });

    assert.deepEqual(res.map((e) => e.id).sort(), [ids.e1, ids.e2].sort());
    assert.equal(
      res.some((e) => e.id === ids.e3), // başka şirketin hareketi sızmaz
      false,
    );
  });

  it('kasaAccountId filtresi: yalnız o hesabın hareketleri; yabancı şirket hesabı → 404', async () => {
    const { list, ids } = await makeSut();

    const res = await list.execute({ companyId: 1, kasaAccountId: ids.merkezTry });
    assert.deepEqual(
      res.map((e) => e.id),
      [ids.e1],
    );

    await assert.rejects(
      () => list.execute({ companyId: 1, kasaAccountId: ids.yabanci }),
      KasaAccountNotFoundError,
    );
  });
});

describe('UpdateKasaEntryUseCase', () => {
  it('kısmi güncelleme: verilen alanlar değişir, verilmeyenler ve committed durumu korunur', async () => {
    const { update, entries, ids } = await makeSut();

    const dto = await update.execute({
      companyId: 1,
      entryId: ids.e1,
      amount: 250.5,
      description: 'Düzeltilmiş tahsilat',
    });

    assert.equal(dto.amount, '250.50');
    assert.equal(dto.description, 'Düzeltilmiş tahsilat');
    assert.equal(dto.date, '2026-01-10'); // değişmedi
    assert.equal(dto.type, 'in');
    assert.equal(dto.category, 'Satış');

    const stored = await entries.findById(ids.e1);
    assert.equal(stored!.amount.toDecimalString(), '250.50');
    assert.equal(stored!.committedToCells, false); // korunur
    assert.equal(stored!.createdBy, 7); // korunur
  });

  it('null ile temizleme: description/category/cashflowCatId null yapılabilir', async () => {
    const { update, ids } = await makeSut();

    const dto = await update.execute({
      companyId: 1,
      entryId: ids.e1,
      description: null,
      category: null,
      cashflowCatId: null,
    });

    assert.equal(dto.description, null);
    assert.equal(dto.category, null);
    assert.equal(dto.cashflowCatId, null);
  });

  it('kasa değişimi: hedef hesap şirkette doğrulanır; tutar hedef hesabın para biriminde', async () => {
    const { update, entries, ids } = await makeSut();

    const dto = await update.execute({
      companyId: 1,
      entryId: ids.e1,
      kasaAccountId: ids.dovizEur,
    });

    assert.equal(dto.kasaAccountId, ids.dovizEur);
    const stored = await entries.findById(ids.e1);
    assert.equal(stored!.amount.currency, 'EUR'); // hedef hesabın birimi

    // Yabancı şirketin kasasına taşınamaz.
    await assert.rejects(
      () => update.execute({ companyId: 1, entryId: ids.e2, kasaAccountId: ids.yabanci }),
      KasaAccountNotFoundError,
    );
  });

  it('çapraz-tenant: başka şirketin hareketi 404 (KasaEntryNotFoundError) — sızıntı yok', async () => {
    const { update, ids } = await makeSut();

    await assert.rejects(
      () => update.execute({ companyId: 1, entryId: ids.e3, amount: 1 }),
      KasaEntryNotFoundError,
    );
    await assert.rejects(
      () => update.execute({ companyId: 1, entryId: 9999, amount: 1 }),
      KasaEntryNotFoundError,
    );
  });
});

describe('DeleteKasaEntryUseCase', () => {
  it('happy: hareket silinir', async () => {
    const { del, entries, ids } = await makeSut();

    const res = await del.execute({ companyId: 1, entryId: ids.e1 });

    assert.deepEqual(res, { deleted: true });
    assert.equal(await entries.findById(ids.e1), null);
  });

  it('çapraz-tenant: başka şirketin hareketi silinemez (404), kayıt yerinde kalır', async () => {
    const { del, entries, ids } = await makeSut();

    await assert.rejects(
      () => del.execute({ companyId: 1, entryId: ids.e3 }),
      KasaEntryNotFoundError,
    );
    assert.notEqual(await entries.findById(ids.e3), null);
  });
});
