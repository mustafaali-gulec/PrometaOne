/**
 * Sözleşme use-case testleri (node:test).
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  CreateContractUseCase,
  ListContractsUseCase,
  UpdateContractUseCase,
} from '../../application/useCases/ContractUseCases.js';
import { CreateProjectUseCase } from '../../application/useCases/ProjectUseCases.js';
import {
  ContractNotFoundError,
  DuplicateContractNoError,
  ProjectNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import { FixedClock, InMemoryContractRepository, InMemoryProjectRepository } from '../fakes.js';

describe('ContractUseCases', () => {
  let contracts: InMemoryContractRepository;
  let projects: InMemoryProjectRepository;
  let clock: FixedClock;

  beforeEach(() => {
    contracts = new InMemoryContractRepository();
    projects = new InMemoryProjectRepository();
    clock = new FixedClock(new Date('2026-06-06T00:00:00.000Z'));
  });

  async function makeProject(): Promise<number> {
    const p = await new CreateProjectUseCase(projects).execute({ companyId: 1, name: 'Proje' });
    return p.id;
  }

  it('proje yoksa ProjectNotFoundError', async () => {
    await assert.rejects(
      () =>
        new CreateContractUseCase(contracts, projects, clock).execute({
          companyId: 1,
          projectId: 999,
          partyKind: 'employer',
          title: 'Yapım İşi',
        }),
      ProjectNotFoundError,
    );
  });

  it('sözleşme no verilmezse SZL-YYYY-NNNN üretir', async () => {
    const projectId = await makeProject();
    const dto = await new CreateContractUseCase(contracts, projects, clock).execute({
      companyId: 1,
      projectId,
      partyKind: 'employer',
      title: 'Yapım İşi',
      amount: 1000000,
    });
    assert.equal(dto.contractNo, 'SZL-2026-0001');
    assert.equal(dto.partyKind, 'employer');
    assert.equal(dto.amount, 1000000);
    assert.equal(dto.tender, null);
  });

  it('ihale bilgisini (tender) gömülü kaydeder', async () => {
    const projectId = await makeProject();
    const dto = await new CreateContractUseCase(contracts, projects, clock).execute({
      companyId: 1,
      projectId,
      partyKind: 'employer',
      title: 'KİK İşi',
      tender: { ikn: '2026/123456', procedure: 'açık', workIncreasePct: 10, perfBondPct: 6 },
    });
    assert.notEqual(dto.tender, null);
    assert.equal(dto.tender!.ikn, '2026/123456');
    assert.equal(dto.tender!.workIncreasePct, 10);
  });

  it('aynı sözleşme no reddedilir', async () => {
    const projectId = await makeProject();
    const uc = new CreateContractUseCase(contracts, projects, clock);
    await uc.execute({
      companyId: 1,
      projectId,
      partyKind: 'employer',
      title: 'X',
      contractNo: 'C-1',
    });
    await assert.rejects(
      () =>
        uc.execute({
          companyId: 1,
          projectId,
          partyKind: 'subcontractor',
          title: 'Y',
          contractNo: 'C-1',
        }),
      DuplicateContractNoError,
    );
  });

  it('partyKind ile listeler', async () => {
    const projectId = await makeProject();
    const uc = new CreateContractUseCase(contracts, projects, clock);
    await uc.execute({ companyId: 1, projectId, partyKind: 'employer', title: 'İşveren' });
    await uc.execute({ companyId: 1, projectId, partyKind: 'subcontractor', title: 'Taşeron' });
    const subs = await new ListContractsUseCase(contracts).execute({
      companyId: 1,
      partyKind: 'subcontractor',
    });
    assert.equal(subs.length, 1);
    assert.equal(subs[0]!.title, 'Taşeron');
  });

  it('günceller (tutar + tender ekleme)', async () => {
    const projectId = await makeProject();
    const created = await new CreateContractUseCase(contracts, projects, clock).execute({
      companyId: 1,
      projectId,
      partyKind: 'employer',
      title: 'X',
      amount: 100,
    });
    const updated = await new UpdateContractUseCase(contracts, clock).execute({
      companyId: 1,
      contractId: created.id,
      amount: 250.75,
      tender: { ikn: '2026/999' },
    });
    assert.equal(updated.amount, 250.75);
    assert.equal(updated.tender!.ikn, '2026/999');
  });

  it('bulunmayan sözleşmede ContractNotFoundError', async () => {
    await assert.rejects(
      () => new UpdateContractUseCase(contracts, clock).execute({ companyId: 1, contractId: 999 }),
      ContractNotFoundError,
    );
  });
});
