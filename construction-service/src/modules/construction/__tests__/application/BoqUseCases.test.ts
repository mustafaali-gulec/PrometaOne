/**
 * Keşif (BoQ) use-case + pursantaj testleri (node:test).
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { GetBoqUseCase, SaveBoqLinesUseCase } from '../../application/useCases/BoqUseCases.js';
import { CreateContractUseCase } from '../../application/useCases/ContractUseCases.js';
import { CreateProjectUseCase } from '../../application/useCases/ProjectUseCases.js';
import { ContractNotFoundError } from '../../domain/errors/ConstructionErrors.js';
import { computePursantajPct } from '../../domain/valueObjects/Pursantaj.js';
import {
  FixedClock,
  InMemoryBoqRepository,
  InMemoryContractRepository,
  InMemoryProjectRepository,
} from '../fakes.js';

describe('computePursantajPct', () => {
  it('tutarları 100 üzerinden normalize eder', () => {
    assert.deepEqual(computePursantajPct([100, 300]), [25, 75]);
  });
  it('toplam 0 ise tüm oranlar 0', () => {
    assert.deepEqual(computePursantajPct([0, 0]), [0, 0]);
  });
  it('oranların toplamı ~100', () => {
    const p = computePursantajPct([1, 1, 1]);
    const sum = p.reduce((s, x) => s + x, 0);
    assert.ok(Math.abs(sum - 100) < 1e-3);
  });
});

describe('BoqUseCases', () => {
  let boq: InMemoryBoqRepository;
  let contracts: InMemoryContractRepository;
  let projects: InMemoryProjectRepository;
  let clock: FixedClock;

  beforeEach(() => {
    boq = new InMemoryBoqRepository();
    contracts = new InMemoryContractRepository();
    projects = new InMemoryProjectRepository();
    clock = new FixedClock(new Date('2026-06-06T00:00:00.000Z'));
  });

  async function makeContract(): Promise<number> {
    const p = await new CreateProjectUseCase(projects).execute({ companyId: 1, name: 'P' });
    const c = await new CreateContractUseCase(contracts, projects, clock).execute({
      companyId: 1,
      projectId: p.id,
      partyKind: 'employer',
      title: 'Yapım',
    });
    return c.id;
  }

  it('sözleşme yoksa ContractNotFoundError', async () => {
    await assert.rejects(
      () =>
        new SaveBoqLinesUseCase(boq, contracts).execute({
          companyId: 1,
          contractId: 999,
          lines: [{ description: 'X' }],
        }),
      ContractNotFoundError,
    );
  });

  it('keşif satırlarını kaydeder, amount ve pursantaj hesaplar', async () => {
    const contractId = await makeContract();
    const dto = await new SaveBoqLinesUseCase(boq, contracts).execute({
      companyId: 1,
      contractId,
      lines: [
        { description: 'Kazı', unit: 'm3', quantity: 10, unitPrice: 10 }, // 100
        { description: 'Beton', unit: 'm3', quantity: 3, unitPrice: 100 }, // 300
      ],
    });
    assert.equal(dto.lines.length, 2);
    assert.equal(dto.totalAmount, 400);
    assert.equal(dto.lines[0]!.amount, 100);
    assert.equal(dto.lines[0]!.pursantajPct, 25);
    assert.equal(dto.lines[1]!.pursantajPct, 75);
    assert.ok(Math.abs(dto.pursantajTotal - 100) < 1e-3);
    assert.equal(dto.lines[0]!.lineNo, 1);
    assert.equal(dto.lines[1]!.lineNo, 2);
  });

  it('yeniden kaydetme önceki satırları değiştirir (replace)', async () => {
    const contractId = await makeContract();
    const save = new SaveBoqLinesUseCase(boq, contracts);
    await save.execute({
      companyId: 1,
      contractId,
      lines: [{ description: 'A', quantity: 1, unitPrice: 1 }],
    });
    await save.execute({
      companyId: 1,
      contractId,
      lines: [
        { description: 'B', quantity: 2, unitPrice: 2 },
        { description: 'C', quantity: 1, unitPrice: 1 },
      ],
    });
    const got = await new GetBoqUseCase(boq, contracts).execute({ companyId: 1, contractId });
    assert.equal(got.lines.length, 2);
    assert.equal(got.lines[0]!.description, 'B');
  });

  it('GetBoq boş keşifte sıfır toplam döner', async () => {
    const contractId = await makeContract();
    const dto = await new GetBoqUseCase(boq, contracts).execute({ companyId: 1, contractId });
    assert.equal(dto.lines.length, 0);
    assert.equal(dto.totalAmount, 0);
  });
});
