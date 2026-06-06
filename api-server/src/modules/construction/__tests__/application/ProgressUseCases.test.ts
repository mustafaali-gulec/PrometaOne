/**
 * Hakediş use-case testleri (node:test) — tohumlama, satır/kesinti hesabı,
 * durum makinesi, görev ayrılığı ve kümülatif devir.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { SaveBoqLinesUseCase } from '../../application/useCases/BoqUseCases.js';
import { CreateContractUseCase } from '../../application/useCases/ContractUseCases.js';
import {
  ChangeProgressStatusUseCase,
  CreateProgressPaymentUseCase,
  SaveDeductionsUseCase,
  SaveProgressLinesUseCase,
} from '../../application/useCases/ProgressUseCases.js';
import { CreateProjectUseCase } from '../../application/useCases/ProjectUseCases.js';
import {
  ConstructionValidationError,
  InvalidStatusTransitionError,
  ProgressNotEditableError,
} from '../../domain/errors/ConstructionErrors.js';
import {
  FixedClock,
  InMemoryBoqRepository,
  InMemoryContractRepository,
  InMemoryProgressPaymentRepository,
  InMemoryProjectRepository,
} from '../fakes.js';

describe('ProgressUseCases (Hakediş)', () => {
  let progress: InMemoryProgressPaymentRepository;
  let boq: InMemoryBoqRepository;
  let contracts: InMemoryContractRepository;
  let projects: InMemoryProjectRepository;
  let clock: FixedClock;

  beforeEach(() => {
    progress = new InMemoryProgressPaymentRepository();
    boq = new InMemoryBoqRepository();
    contracts = new InMemoryContractRepository();
    projects = new InMemoryProjectRepository();
    clock = new FixedClock(new Date('2026-06-06T00:00:00.000Z'));
  });

  async function setup(): Promise<{ contractId: number; boqLineIds: number[] }> {
    const p = await new CreateProjectUseCase(projects).execute({ companyId: 1, name: 'P' });
    const c = await new CreateContractUseCase(contracts, projects, clock).execute({
      companyId: 1,
      projectId: p.id,
      partyKind: 'employer',
      title: 'Yapım',
    });
    const dto = await new SaveBoqLinesUseCase(boq, contracts).execute({
      companyId: 1,
      contractId: c.id,
      lines: [
        { description: 'Kazı', unit: 'm3', quantity: 100, unitPrice: 10 }, // birim 10
        { description: 'Beton', unit: 'm3', quantity: 50, unitPrice: 100 }, // birim 100
      ],
    });
    return { contractId: c.id, boqLineIds: dto.lines.map((l) => l.id) };
  }

  it('keşif yoksa hakediş açılamaz', async () => {
    const p = await new CreateProjectUseCase(projects).execute({ companyId: 1, name: 'P' });
    const c = await new CreateContractUseCase(contracts, projects, clock).execute({
      companyId: 1,
      projectId: p.id,
      partyKind: 'employer',
      title: 'Yapım',
    });
    await assert.rejects(
      () =>
        new CreateProgressPaymentUseCase(progress, contracts, boq, clock).execute({
          companyId: 1,
          contractId: c.id,
          kind: 'employer',
        }),
      ConstructionValidationError,
    );
  });

  it('hakediş keşiften tohumlanır (HAK-YYYY-0001, satırlar prevQty=0)', async () => {
    const { contractId } = await setup();
    const dto = await new CreateProgressPaymentUseCase(progress, contracts, boq, clock).execute({
      companyId: 1,
      contractId,
      kind: 'employer',
    });
    assert.equal(dto.hakedisNo, 'HAK-2026-0001');
    assert.equal(dto.seqNo, 1);
    assert.equal(dto.status, 'draft');
    assert.equal(dto.lines.length, 2);
    assert.equal(dto.lines[0]!.prevQty, 0);
    assert.equal(dto.grossThis, 0);
  });

  it('bu dönem miktarları girilince tutar+net hesaplanır', async () => {
    const { contractId, boqLineIds } = await setup();
    const created = await new CreateProgressPaymentUseCase(progress, contracts, boq, clock).execute(
      {
        companyId: 1,
        contractId,
        kind: 'employer',
      },
    );
    const dto = await new SaveProgressLinesUseCase(progress).execute({
      companyId: 1,
      progressId: created.id,
      quantities: [
        { boqLineId: boqLineIds[0]!, thisQty: 40 }, // 40*10 = 400
        { boqLineId: boqLineIds[1]!, thisQty: 2 }, // 2*100 = 200
      ],
    });
    assert.equal(dto.grossThis, 600);
    assert.equal(dto.netPayable, 600);
    const l0 = dto.lines.find((l) => l.boqLineId === boqLineIds[0]);
    assert.equal(l0!.thisAmount, 400);
    assert.equal(l0!.cumulQty, 40);
  });

  it('kesinti + fiyat farkı net ödenecekleri etkiler', async () => {
    const { contractId, boqLineIds } = await setup();
    const created = await new CreateProgressPaymentUseCase(progress, contracts, boq, clock).execute(
      {
        companyId: 1,
        contractId,
        kind: 'employer',
      },
    );
    await new SaveProgressLinesUseCase(progress).execute({
      companyId: 1,
      progressId: created.id,
      quantities: [{ boqLineId: boqLineIds[0]!, thisQty: 100 }], // 1000
    });
    const dto = await new SaveDeductionsUseCase(progress).execute({
      companyId: 1,
      progressId: created.id,
      priceDiff: 50,
      deductions: [
        { kind: 'retention', amount: 100 }, // -100
        { kind: 'advance_offset', amount: 200 }, // -200
      ],
    });
    // 1000 + 50 - 300 = 750
    assert.equal(dto.grossThis, 1000);
    assert.equal(dto.priceDiff, 50);
    assert.equal(dto.deductionsTot, 300);
    assert.equal(dto.netPayable, 750);
  });

  it('durum makinesi: draft→submitted→approved; geçersiz geçiş reddedilir', async () => {
    const { contractId } = await setup();
    const created = await new CreateProgressPaymentUseCase(progress, contracts, boq, clock).execute(
      {
        companyId: 1,
        contractId,
        kind: 'employer',
      },
    );
    const status = new ChangeProgressStatusUseCase(progress, clock);
    // draft → approved doğrudan geçersiz
    await assert.rejects(
      () => status.execute({ companyId: 1, progressId: created.id, status: 'approved' }),
      InvalidStatusTransitionError,
    );
    const sub = await status.execute({ companyId: 1, progressId: created.id, status: 'submitted' });
    assert.equal(sub.status, 'submitted');
    assert.ok(sub.submittedAt !== null);
    const app = await status.execute({
      companyId: 1,
      progressId: created.id,
      status: 'approved',
      actorUserId: 7,
    });
    assert.equal(app.status, 'approved');
    assert.equal(app.approvedBy, 7);
  });

  it('submitted hakediş düzenlenemez', async () => {
    const { contractId, boqLineIds } = await setup();
    const created = await new CreateProgressPaymentUseCase(progress, contracts, boq, clock).execute(
      {
        companyId: 1,
        contractId,
        kind: 'employer',
      },
    );
    await new ChangeProgressStatusUseCase(progress, clock).execute({
      companyId: 1,
      progressId: created.id,
      status: 'submitted',
    });
    await assert.rejects(
      () =>
        new SaveProgressLinesUseCase(progress).execute({
          companyId: 1,
          progressId: created.id,
          quantities: [{ boqLineId: boqLineIds[0]!, thisQty: 5 }],
        }),
      ProgressNotEditableError,
    );
  });

  it('onaylı hakedişin kümülatifi sonraki hakedişe devreder (prevQty)', async () => {
    const { contractId, boqLineIds } = await setup();
    const create = new CreateProgressPaymentUseCase(progress, contracts, boq, clock);
    const status = new ChangeProgressStatusUseCase(progress, clock);
    const first = await create.execute({ companyId: 1, contractId, kind: 'employer' });
    await new SaveProgressLinesUseCase(progress).execute({
      companyId: 1,
      progressId: first.id,
      quantities: [{ boqLineId: boqLineIds[0]!, thisQty: 30 }],
    });
    await status.execute({ companyId: 1, progressId: first.id, status: 'submitted' });
    await status.execute({
      companyId: 1,
      progressId: first.id,
      status: 'approved',
      actorUserId: 1,
    });

    const second = await create.execute({ companyId: 1, contractId, kind: 'employer' });
    assert.equal(second.seqNo, 2);
    assert.equal(second.hakedisNo, 'HAK-2026-0002');
    const l0 = second.lines.find((l) => l.boqLineId === boqLineIds[0]);
    assert.equal(l0!.prevQty, 30); // önceki onaylı kümülatif
  });
});
