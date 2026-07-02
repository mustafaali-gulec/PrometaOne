/**
 * Gider Kartı use-case testleri.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  BulkUpsertExpenseCardsUseCase,
  CreateExpenseCardUseCase,
  DeactivateExpenseCardUseCase,
  DeleteExpenseCardUseCase,
  ListExpenseCardsUseCase,
  UpdateExpenseCardUseCase,
} from '../application/useCases/ExpenseCardUseCases.js';
import {
  DuplicateExpenseCardCodeError,
  ExpenseCardNotFoundError,
} from '../domain/errors/ExpenseErrors.js';

import { FixedClock, InMemoryExpenseCardRepository } from './fakes.js';

describe('ExpenseCardUseCases', () => {
  let repo: InMemoryExpenseCardRepository;
  let clock: FixedClock;

  beforeEach(() => {
    repo = new InMemoryExpenseCardRepository();
    clock = new FixedClock();
  });

  it('happy: kod verilmezse → GK0001, direction default out', async () => {
    const uc = new CreateExpenseCardUseCase(repo);
    const dto = await uc.execute({ companyId: 100, name: 'Kira' });
    assert.equal(dto.code, 'GK0001');
    assert.equal(dto.direction, 'out');
    assert.equal(dto.category, '');
    assert.ok(dto.active);
  });

  it('happy: ardışık kodlar artar (GK0002)', async () => {
    const uc = new CreateExpenseCardUseCase(repo);
    await uc.execute({ companyId: 100, name: 'A' });
    const b = await uc.execute({ companyId: 100, name: 'B' });
    assert.equal(b.code, 'GK0002');
  });

  it('happy: açık kod + kategori + direction in', async () => {
    const uc = new CreateExpenseCardUseCase(repo);
    const dto = await uc.execute({
      companyId: 100,
      name: 'Hasılat',
      code: 'HAS01',
      category: 'GELIR',
      direction: 'in',
    });
    assert.equal(dto.code, 'HAS01');
    assert.equal(dto.category, 'GELIR');
    assert.equal(dto.direction, 'in');
  });

  it('edge: aynı kod → DuplicateExpenseCardCodeError', async () => {
    const uc = new CreateExpenseCardUseCase(repo);
    await uc.execute({ companyId: 100, name: 'A', code: 'GK0001' });
    await assert.rejects(
      uc.execute({ companyId: 100, name: 'B', code: 'GK0001' }),
      DuplicateExpenseCardCodeError,
    );
  });

  it('happy: list active/inactive/search', async () => {
    const create = new CreateExpenseCardUseCase(repo);
    await create.execute({ companyId: 100, name: 'Kira Gideri', category: 'SABIT' });
    await create.execute({ companyId: 100, name: 'Elektrik', category: 'FATURA' });
    const list = new ListExpenseCardsUseCase(repo);

    assert.equal((await list.execute({ companyId: 100 })).length, 2);
    // search isim
    const byName = await list.execute({ companyId: 100, search: 'kira' });
    assert.equal(byName.length, 1);
    assert.equal(byName[0]!.name, 'Kira Gideri');
    // search kategori
    const byCat = await list.execute({ companyId: 100, search: 'fatura' });
    assert.equal(byCat.length, 1);
    assert.equal(byCat[0]!.name, 'Elektrik');
  });

  it('happy: update isim + kategori + direction', async () => {
    const create = new CreateExpenseCardUseCase(repo);
    const c = await create.execute({ companyId: 100, name: 'Eski' });
    const update = new UpdateExpenseCardUseCase(repo, clock);
    const dto = await update.execute({
      companyId: 100,
      cardId: c.id,
      name: 'Yeni',
      category: 'KATEGORI',
      direction: 'in',
    });
    assert.equal(dto.name, 'Yeni');
    assert.equal(dto.category, 'KATEGORI');
    assert.equal(dto.direction, 'in');
  });

  it('happy: attributes create + partial update round-trip', async () => {
    const create = new CreateExpenseCardUseCase(repo);
    const c = await create.execute({
      companyId: 100,
      name: 'Kira',
      attributes: { kdvRate: 20, paymentMethod: 'transfer', monthlyBudget: 5000 },
    });
    assert.equal(c.attributes.kdvRate, 20);
    assert.equal(c.attributes.paymentMethod, 'transfer');
    assert.equal(c.attributes.monthlyBudget, 5000);

    const update = new UpdateExpenseCardUseCase(repo, clock);
    const upd = await update.execute({
      companyId: 100,
      cardId: c.id,
      attributes: { kdvRate: 10, taxDeductible: true },
    });
    // attributes tümüyle değiştirilir (merge değil) — yeni obje yazılır.
    assert.equal(upd.attributes.kdvRate, 10);
    assert.equal(upd.attributes.taxDeductible, true);
    assert.equal(upd.attributes.paymentMethod, undefined);
    // dokunulmayan alanlar korunur
    assert.equal(upd.name, 'Kira');
  });

  it('happy: attributes verilmezse boş obje', async () => {
    const create = new CreateExpenseCardUseCase(repo);
    const c = await create.execute({ companyId: 100, name: 'X' });
    assert.deepEqual(c.attributes, {});
  });

  it('edge: olmayan kart update → ExpenseCardNotFoundError', async () => {
    const update = new UpdateExpenseCardUseCase(repo, clock);
    await assert.rejects(
      update.execute({ companyId: 100, cardId: 999, name: 'X' }),
      ExpenseCardNotFoundError,
    );
  });

  it('edge: multi-tenant — başka şirketin kartına erişemez', async () => {
    const create = new CreateExpenseCardUseCase(repo);
    const c = await create.execute({ companyId: 100, name: 'X' });
    const update = new UpdateExpenseCardUseCase(repo, clock);
    await assert.rejects(
      update.execute({ companyId: 200, cardId: c.id, name: 'Y' }),
      ExpenseCardNotFoundError,
    );
  });

  it('happy: deactivate sonrası default listede görünmez', async () => {
    const create = new CreateExpenseCardUseCase(repo);
    const c = await create.execute({ companyId: 100, name: 'X' });
    const deact = new DeactivateExpenseCardUseCase(repo, clock);
    await deact.execute({ companyId: 100, cardId: c.id });
    const list = new ListExpenseCardsUseCase(repo);
    assert.equal((await list.execute({ companyId: 100 })).length, 0);
    assert.equal((await list.execute({ companyId: 100, includeInactive: true })).length, 1);
  });

  describe('Delete (kalıcı)', () => {
    it('happy: kart tamamen silinir (includeInactive listesinde de yok)', async () => {
      const create = new CreateExpenseCardUseCase(repo);
      const c = await create.execute({ companyId: 100, name: 'Silinecek' });
      const del = new DeleteExpenseCardUseCase(repo);
      await del.execute({ companyId: 100, cardId: c.id });
      const list = new ListExpenseCardsUseCase(repo);
      assert.equal((await list.execute({ companyId: 100, includeInactive: true })).length, 0);
    });

    it('edge: olmayan kart → ExpenseCardNotFoundError', async () => {
      const del = new DeleteExpenseCardUseCase(repo);
      await assert.rejects(del.execute({ companyId: 100, cardId: 999 }), ExpenseCardNotFoundError);
    });

    it('edge: multi-tenant — başka şirketin kartı silinemez', async () => {
      const create = new CreateExpenseCardUseCase(repo);
      const c = await create.execute({ companyId: 100, name: 'X' });
      const del = new DeleteExpenseCardUseCase(repo);
      await assert.rejects(del.execute({ companyId: 200, cardId: c.id }), ExpenseCardNotFoundError);
      const list = new ListExpenseCardsUseCase(repo);
      assert.equal((await list.execute({ companyId: 100 })).length, 1);
    });

    it('happy: pasif kart da (işlemsizse) silinebilir', async () => {
      const create = new CreateExpenseCardUseCase(repo);
      const c = await create.execute({ companyId: 100, name: 'Pasif' });
      await new DeactivateExpenseCardUseCase(repo, clock).execute({
        companyId: 100,
        cardId: c.id,
      });
      await new DeleteExpenseCardUseCase(repo).execute({ companyId: 100, cardId: c.id });
      const list = new ListExpenseCardsUseCase(repo);
      assert.equal((await list.execute({ companyId: 100, includeInactive: true })).length, 0);
    });
  });

  describe('BulkUpsert', () => {
    it('match by code', async () => {
      const create = new CreateExpenseCardUseCase(repo);
      await create.execute({ companyId: 100, name: 'Kira', code: 'GK0001' });
      const bulk = new BulkUpsertExpenseCardsUseCase(repo);
      const res = await bulk.execute({
        companyId: 100,
        cards: [{ code: 'GK0001', name: 'Farklı İsim' }],
      });
      assert.equal(res.matched, 1);
      assert.equal(res.created, 0);
      assert.equal(res.cards.length, 1);
      assert.equal(res.cards[0]!.code, 'GK0001');
    });

    it('match by name (case-insensitive + trim)', async () => {
      const create = new CreateExpenseCardUseCase(repo);
      const existing = await create.execute({ companyId: 100, name: 'İşletme Gideri' });
      const bulk = new BulkUpsertExpenseCardsUseCase(repo);
      const res = await bulk.execute({
        companyId: 100,
        cards: [{ name: '  işletme gideri  ' }],
      });
      assert.equal(res.matched, 1);
      assert.equal(res.created, 0);
      assert.equal(res.cards[0]!.id, existing.id);
    });

    it('create new (auto code)', async () => {
      const bulk = new BulkUpsertExpenseCardsUseCase(repo);
      const res = await bulk.execute({
        companyId: 100,
        cards: [{ name: 'Yeni Kart', category: 'KAT' }],
      });
      assert.equal(res.created, 1);
      assert.equal(res.matched, 0);
      assert.equal(res.cards[0]!.code, 'GK0001');
      assert.equal(res.cards[0]!.category, 'KAT');
    });

    it('mixed: bir eşleşme + bir yeni', async () => {
      const create = new CreateExpenseCardUseCase(repo);
      await create.execute({ companyId: 100, name: 'Kira' });
      const bulk = new BulkUpsertExpenseCardsUseCase(repo);
      const res = await bulk.execute({
        companyId: 100,
        cards: [{ name: 'kira' }, { name: 'Yeni Gider', category: 'YENI' }],
      });
      assert.equal(res.matched, 1);
      assert.equal(res.created, 1);
      assert.equal(res.cards.length, 2);
    });

    it('boş kategorili karta gelen kategoriyi doldurur', async () => {
      const create = new CreateExpenseCardUseCase(repo);
      await create.execute({ companyId: 100, name: 'Kira' }); // category=''
      const bulk = new BulkUpsertExpenseCardsUseCase(repo);
      const res = await bulk.execute({
        companyId: 100,
        cards: [{ name: 'Kira', category: 'SABIT GIDER' }],
      });
      assert.equal(res.matched, 1);
      assert.equal(res.cards[0]!.category, 'SABIT GIDER');
    });
  });
});
