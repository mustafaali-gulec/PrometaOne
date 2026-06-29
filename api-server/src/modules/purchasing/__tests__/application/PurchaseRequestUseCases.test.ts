/**
 * Satınalma talebi (PR) use-case testleri.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  ChangePrStatusUseCase,
  CreatePurchaseRequestUseCase,
  DeletePurchaseRequestUseCase,
  ListPurchaseRequestsUseCase,
} from '../../application/useCases/PurchaseRequestUseCases.js';
import {
  InvalidStatusTransitionError,
  PurchaseRequestNotFoundError,
} from '../../domain/errors/PurchasingErrors.js';
import { FixedClock, InMemoryPurchaseRequestRepository } from '../fakes.js';

describe('PurchaseRequestUseCases', () => {
  let repo: InMemoryPurchaseRequestRepository;
  let clock: FixedClock;

  beforeEach(() => {
    repo = new InMemoryPurchaseRequestRepository();
    clock = new FixedClock();
  });

  const items = [{ description: 'Laptop', quantity: 2, unitPrice: 15000 }];

  it('happy: PR-2026-0001 üretir, status draft, total hesaplanır', async () => {
    const uc = new CreatePurchaseRequestUseCase(repo, clock);
    const dto = await uc.execute({ companyId: 100, items });
    assert.equal(dto.prNo, 'PR-2026-0001');
    assert.equal(dto.status, 'draft');
    assert.equal(dto.totalAmount, 30000);
    assert.equal(dto.items.length, 1);
    assert.equal(dto.items[0]!.lineNo, 1);
  });

  it('happy: submit=true → pending_approval', async () => {
    const uc = new CreatePurchaseRequestUseCase(repo, clock);
    const dto = await uc.execute({ companyId: 100, items, submit: true });
    assert.equal(dto.status, 'pending_approval');
  });

  it('happy: ardışık numara PR-2026-0002', async () => {
    const uc = new CreatePurchaseRequestUseCase(repo, clock);
    await uc.execute({ companyId: 100, items });
    const second = await uc.execute({ companyId: 100, items });
    assert.equal(second.prNo, 'PR-2026-0002');
  });

  it('happy: status akışı pending_approval → approved', async () => {
    const create = new CreatePurchaseRequestUseCase(repo, clock);
    const pr = await create.execute({ companyId: 100, items, submit: true });
    const change = new ChangePrStatusUseCase(repo, clock);
    const dto = await change.execute({ companyId: 100, prId: pr.id, status: 'approved' });
    assert.equal(dto.status, 'approved');
  });

  it('edge: draft → approved geçersiz', async () => {
    const create = new CreatePurchaseRequestUseCase(repo, clock);
    const pr = await create.execute({ companyId: 100, items });
    const change = new ChangePrStatusUseCase(repo, clock);
    await assert.rejects(
      change.execute({ companyId: 100, prId: pr.id, status: 'approved' }),
      InvalidStatusTransitionError,
    );
  });

  it('edge: olmayan PR status değişimi → PurchaseRequestNotFoundError', async () => {
    const change = new ChangePrStatusUseCase(repo, clock);
    await assert.rejects(
      change.execute({ companyId: 100, prId: 999, status: 'approved' }),
      PurchaseRequestNotFoundError,
    );
  });

  it('happy: list status filtresi', async () => {
    const create = new CreatePurchaseRequestUseCase(repo, clock);
    await create.execute({ companyId: 100, items });
    await create.execute({ companyId: 100, items, submit: true });
    const list = new ListPurchaseRequestsUseCase(repo);
    assert.equal((await list.execute({ companyId: 100, status: 'draft' })).length, 1);
  });

  it('happy: delete talebi siler', async () => {
    const create = new CreatePurchaseRequestUseCase(repo, clock);
    const pr = await create.execute({ companyId: 100, items });
    const del = new DeletePurchaseRequestUseCase(repo);
    await del.execute({ companyId: 100, prId: pr.id });
    const list = new ListPurchaseRequestsUseCase(repo);
    assert.equal((await list.execute({ companyId: 100 })).length, 0);
  });

  it('edge: olmayan PR delete → PurchaseRequestNotFoundError', async () => {
    const del = new DeletePurchaseRequestUseCase(repo);
    await assert.rejects(del.execute({ companyId: 100, prId: 999 }), PurchaseRequestNotFoundError);
  });
});
