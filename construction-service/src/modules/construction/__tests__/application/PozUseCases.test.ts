/**
 * Poz katalog use-case testleri (node:test).
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  CreatePozUseCase,
  DeactivatePozUseCase,
  ListPozUseCase,
  UpdatePozUseCase,
} from '../../application/useCases/PozUseCases.js';
import { DuplicatePozError, PozNotFoundError } from '../../domain/errors/ConstructionErrors.js';
import { FixedClock, InMemoryPozCatalogRepository } from '../fakes.js';

describe('PozUseCases', () => {
  let repo: InMemoryPozCatalogRepository;
  let clock: FixedClock;

  beforeEach(() => {
    repo = new InMemoryPozCatalogRepository();
    clock = new FixedClock(new Date('2026-06-06T00:00:00.000Z'));
  });

  it('poz oluşturur ve listeler', async () => {
    const dto = await new CreatePozUseCase(repo).execute({
      companyId: 1,
      pozNo: 'Y.16.050/01',
      name: 'Beton C30',
      unit: 'm3',
      unitPrice: 2500,
    });
    assert.equal(dto.pozNo, 'Y.16.050/01');
    assert.equal(dto.unitPrice, 2500);
    const list = await new ListPozUseCase(repo).execute({ companyId: 1 });
    assert.equal(list.length, 1);
  });

  it('aynı poz no + yıl ikilemesini reddeder, farklı yıla izin verir', async () => {
    const uc = new CreatePozUseCase(repo);
    await uc.execute({ companyId: 1, pozNo: 'P-1', name: 'A', unit: 'ad', year: 2025 });
    await assert.rejects(
      () => uc.execute({ companyId: 1, pozNo: 'P-1', name: 'B', unit: 'ad', year: 2025 }),
      DuplicatePozError,
    );
    const ok = await uc.execute({ companyId: 1, pozNo: 'P-1', name: 'B', unit: 'ad', year: 2026 });
    assert.equal(ok.year, 2026);
  });

  it('günceller ve pasifleştirir', async () => {
    const created = await new CreatePozUseCase(repo).execute({
      companyId: 1,
      pozNo: 'P-1',
      name: 'A',
      unit: 'ad',
    });
    const updated = await new UpdatePozUseCase(repo, clock).execute({
      companyId: 1,
      pozId: created.id,
      unitPrice: 999.99,
    });
    assert.equal(updated.unitPrice, 999.99);
    const deact = await new DeactivatePozUseCase(repo, clock).execute({
      companyId: 1,
      pozId: created.id,
    });
    assert.equal(deact.active, false);
  });

  it('bulunmayan pozda PozNotFoundError', async () => {
    await assert.rejects(
      () => new UpdatePozUseCase(repo, clock).execute({ companyId: 1, pozId: 999 }),
      PozNotFoundError,
    );
  });
});
