/**
 * Proje use-case testleri (node:test runner — bkz package.json "test": tsx --test).
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  ChangeProjectStatusUseCase,
  CreateProjectUseCase,
  DeactivateProjectUseCase,
  ListProjectsUseCase,
  UpdateProjectUseCase,
} from '../../application/useCases/ProjectUseCases.js';
import {
  DuplicateProjectCodeError,
  InvalidStatusTransitionError,
  ProjectNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import { FixedClock, InMemoryProjectRepository } from '../fakes.js';

describe('ProjectUseCases', () => {
  let repo: InMemoryProjectRepository;
  let clock: FixedClock;

  beforeEach(() => {
    repo = new InMemoryProjectRepository();
    clock = new FixedClock(new Date('2026-06-06T00:00:00.000Z'));
  });

  it('kod verilmezse PRJ-NNN üretir ve varsayılanları uygular', async () => {
    const dto = await new CreateProjectUseCase(repo).execute({ companyId: 1, name: 'A Bloku' });
    assert.equal(dto.code, 'PRJ-001');
    assert.equal(dto.projectType, 'private');
    assert.equal(dto.status, 'planning');
    assert.equal(dto.currency, 'TRY');
    assert.equal(dto.active, true);
  });

  it('artan kod üretir (PRJ-002)', async () => {
    const uc = new CreateProjectUseCase(repo);
    await uc.execute({ companyId: 1, name: 'A' });
    const second = await uc.execute({ companyId: 1, name: 'B' });
    assert.equal(second.code, 'PRJ-002');
  });

  it('aynı kodu reddeder', async () => {
    const uc = new CreateProjectUseCase(repo);
    await uc.execute({ companyId: 1, name: 'A', code: 'PRJ-X' });
    await assert.rejects(
      () => uc.execute({ companyId: 1, name: 'B', code: 'PRJ-X' }),
      DuplicateProjectCodeError,
    );
  });

  it('ihaleli proje tipini ve bütçeyi kaydeder', async () => {
    const dto = await new CreateProjectUseCase(repo).execute({
      companyId: 1,
      name: 'Köprü',
      projectType: 'public_tender',
      budgetAmount: 1500000.5,
    });
    assert.equal(dto.projectType, 'public_tender');
    assert.equal(dto.budgetAmount, 1500000.5);
  });

  it('statüye göre listeler', async () => {
    const create = new CreateProjectUseCase(repo);
    const a = await create.execute({ companyId: 1, name: 'A' });
    await create.execute({ companyId: 1, name: 'B' });
    await new ChangeProjectStatusUseCase(repo, clock).execute({
      companyId: 1,
      projectId: a.id,
      status: 'active',
    });
    const active = await new ListProjectsUseCase(repo).execute({ companyId: 1, status: 'active' });
    assert.equal(active.length, 1);
    assert.equal(active[0]!.id, a.id);
  });

  it('geçerli statü geçişine izin verir, geçersizi reddeder', async () => {
    const dto = await new CreateProjectUseCase(repo).execute({ companyId: 1, name: 'A' });
    const status = new ChangeProjectStatusUseCase(repo, clock);
    const activated = await status.execute({ companyId: 1, projectId: dto.id, status: 'active' });
    assert.equal(activated.status, 'active');
    // planning → completed geçersiz (önce active olmalı); kapalıdan dönüş yok testi:
    await status.execute({ companyId: 1, projectId: dto.id, status: 'closed' });
    await assert.rejects(
      () => status.execute({ companyId: 1, projectId: dto.id, status: 'active' }),
      InvalidStatusTransitionError,
    );
  });

  it('günceller ve pasifleştirir', async () => {
    const dto = await new CreateProjectUseCase(repo).execute({ companyId: 1, name: 'A' });
    const updated = await new UpdateProjectUseCase(repo, clock).execute({
      companyId: 1,
      projectId: dto.id,
      name: 'A Güncel',
      location: 'İstanbul',
    });
    assert.equal(updated.name, 'A Güncel');
    assert.equal(updated.location, 'İstanbul');
    const deact = await new DeactivateProjectUseCase(repo, clock).execute({
      companyId: 1,
      projectId: dto.id,
    });
    assert.equal(deact.active, false);
  });

  it('bulunmayan projede ProjectNotFoundError', async () => {
    await assert.rejects(
      () => new UpdateProjectUseCase(repo, clock).execute({ companyId: 1, projectId: 999 }),
      ProjectNotFoundError,
    );
  });
});
