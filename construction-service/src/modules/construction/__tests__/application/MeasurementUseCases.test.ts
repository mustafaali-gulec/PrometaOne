/**
 * Yeşil Defter (metraj) + Ataşman use-case testleri (node:test).
 * Ataşman formülü → miktar hesabı, yeşil defter kümülatif senkronu, kümülatif özet.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { SaveBoqLinesUseCase } from '../../application/useCases/BoqUseCases.js';
import { CreateContractUseCase } from '../../application/useCases/ContractUseCases.js';
import {
  CreateAttachmentUseCase,
  CreateMeasurementUseCase,
  DeleteAttachmentUseCase,
  DeleteMeasurementUseCase,
  GetMeasurementSummaryUseCase,
  ListAttachmentsUseCase,
  ListMeasurementsUseCase,
  UpdateAttachmentUseCase,
  UpdateMeasurementUseCase,
} from '../../application/useCases/MeasurementUseCases.js';
import { CreateProjectUseCase } from '../../application/useCases/ProjectUseCases.js';
import {
  AttachmentNotFoundError,
  ConstructionValidationError,
  ContractNotFoundError,
  MeasurementNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import {
  FixedClock,
  InMemoryAttachmentRepository,
  InMemoryBoqRepository,
  InMemoryContractRepository,
  InMemoryMeasurementBookRepository,
  InMemoryProjectRepository,
} from '../fakes.js';

describe('MeasurementUseCases (Yeşil Defter + Ataşman)', () => {
  let measurements: InMemoryMeasurementBookRepository;
  let attachments: InMemoryAttachmentRepository;
  let boq: InMemoryBoqRepository;
  let contracts: InMemoryContractRepository;
  let projects: InMemoryProjectRepository;
  let clock: FixedClock;

  beforeEach(() => {
    measurements = new InMemoryMeasurementBookRepository();
    attachments = new InMemoryAttachmentRepository();
    boq = new InMemoryBoqRepository();
    contracts = new InMemoryContractRepository();
    projects = new InMemoryProjectRepository();
    clock = new FixedClock(new Date('2026-06-06T00:00:00.000Z'));
  });

  // Bir sözleşme + 2 keşif satırı kurar; ilk satırın id'sini döndürür.
  async function setup(): Promise<{ contractId: number; boqLineId: number; boqLineId2: number }> {
    const p = await new CreateProjectUseCase(projects).execute({ companyId: 1, name: 'P' });
    const c = await new CreateContractUseCase(contracts, projects, clock).execute({
      companyId: 1,
      projectId: p.id,
      partyKind: 'subcontractor',
      title: 'Kaba İnşaat',
    });
    const dto = await new SaveBoqLinesUseCase(boq, contracts).execute({
      companyId: 1,
      contractId: c.id,
      lines: [
        { description: 'Kazı', unit: 'm3', quantity: 100, unitPrice: 50 },
        { description: 'Beton', unit: 'm3', quantity: 40, unitPrice: 200 },
      ],
    });
    return { contractId: c.id, boqLineId: dto.lines[0]!.id, boqLineId2: dto.lines[1]!.id };
  }

  it('sözleşme yoksa ContractNotFoundError', async () => {
    await assert.rejects(
      () =>
        new CreateMeasurementUseCase(measurements, contracts, boq).execute({
          companyId: 1,
          contractId: 999,
          boqLineId: 1,
          createdBy: null,
        }),
      ContractNotFoundError,
    );
  });

  it('keşif satırı sözleşmeye ait değilse ConstructionValidationError', async () => {
    const { contractId } = await setup();
    await assert.rejects(
      () =>
        new CreateMeasurementUseCase(measurements, contracts, boq).execute({
          companyId: 1,
          contractId,
          boqLineId: 99999,
          createdBy: null,
        }),
      ConstructionValidationError,
    );
  });

  it('yeşil defter kaydı oluşturur ve listeler', async () => {
    const { contractId, boqLineId } = await setup();
    const m = await new CreateMeasurementUseCase(measurements, contracts, boq).execute({
      companyId: 1,
      contractId,
      boqLineId,
      measuredQty: 12.5,
      measuredAt: '2026-06-30',
      note: 'ilk dönem',
      createdBy: 7,
    });
    assert.equal(m.measuredQty, 12.5);
    assert.equal(m.boqLineId, boqLineId);

    const list = await new ListMeasurementsUseCase(measurements).execute({
      companyId: 1,
      contractId,
    });
    assert.equal(list.length, 1);
    assert.equal(list[0]!.note, 'ilk dönem');
  });

  it('ataşman boyutlardan miktarı hesaplar (a×b×c×n) ve yeşil defteri senkronlar', async () => {
    const { contractId, boqLineId } = await setup();
    const m = await new CreateMeasurementUseCase(measurements, contracts, boq).execute({
      companyId: 1,
      contractId,
      boqLineId,
      createdBy: null,
    });
    // 2.5 × 3 × 1 × 4 = 30
    const a = await new CreateAttachmentUseCase(attachments, measurements).execute({
      companyId: 1,
      measurementId: m.id,
      dimA: 2.5,
      dimB: 3,
      countN: 4,
      formula: '2.5*3*4',
    });
    assert.equal(a.resultQty, 30);
    // measured_qty ataşman toplamına eşitlenmeli
    const after = await measurements.findById(m.id, 1);
    assert.equal(after!.measuredQty, 30);
  });

  it('birden çok ataşman toplanır; silince yeniden hesaplanır', async () => {
    const { contractId, boqLineId } = await setup();
    const m = await new CreateMeasurementUseCase(measurements, contracts, boq).execute({
      companyId: 1,
      contractId,
      boqLineId,
      createdBy: null,
    });
    const create = new CreateAttachmentUseCase(attachments, measurements);
    await create.execute({ companyId: 1, measurementId: m.id, dimA: 10 }); // 10
    const a2 = await create.execute({ companyId: 1, measurementId: m.id, manualQty: 5.5 }); // 5.5 (boyut yok)
    assert.equal((await measurements.findById(m.id, 1))!.measuredQty, 15.5);

    await new DeleteAttachmentUseCase(attachments, measurements).execute({
      companyId: 1,
      attachmentId: a2.id,
    });
    assert.equal((await measurements.findById(m.id, 1))!.measuredQty, 10);

    const list = await new ListAttachmentsUseCase(attachments).execute({
      companyId: 1,
      measurementId: m.id,
    });
    assert.equal(list.length, 1);
  });

  it('ataşman güncellenince miktar ve yeşil defter yeniden hesaplanır', async () => {
    const { contractId, boqLineId } = await setup();
    const m = await new CreateMeasurementUseCase(measurements, contracts, boq).execute({
      companyId: 1,
      contractId,
      boqLineId,
      createdBy: null,
    });
    const a = await new CreateAttachmentUseCase(attachments, measurements).execute({
      companyId: 1,
      measurementId: m.id,
      dimA: 2,
      dimB: 2,
    }); // 4
    const upd = await new UpdateAttachmentUseCase(attachments, measurements).execute({
      companyId: 1,
      attachmentId: a.id,
      dimB: 5,
    }); // 2 × 5 = 10
    assert.equal(upd.resultQty, 10);
    assert.equal((await measurements.findById(m.id, 1))!.measuredQty, 10);
  });

  it('kümülatif özet keşif satırı bazında toplar', async () => {
    const { contractId, boqLineId, boqLineId2 } = await setup();
    const create = new CreateMeasurementUseCase(measurements, contracts, boq);
    await create.execute({ companyId: 1, contractId, boqLineId, measuredQty: 30, createdBy: null });
    await create.execute({ companyId: 1, contractId, boqLineId, measuredQty: 20, createdBy: null });
    await create.execute({
      companyId: 1,
      contractId,
      boqLineId: boqLineId2,
      measuredQty: 8,
      createdBy: null,
    });

    const summary = await new GetMeasurementSummaryUseCase(measurements, contracts).execute({
      companyId: 1,
      contractId,
    });
    const line1 = summary.find((s) => s.boqLineId === boqLineId);
    const line2 = summary.find((s) => s.boqLineId === boqLineId2);
    assert.equal(line1!.totalMeasured, 50);
    assert.equal(line2!.totalMeasured, 8);
  });

  it('olmayan kayıt güncelleme/silme NotFound fırlatır', async () => {
    await assert.rejects(
      () => new UpdateMeasurementUseCase(measurements).execute({ measurementId: 1, companyId: 1 }),
      MeasurementNotFoundError,
    );
    await assert.rejects(
      () => new DeleteMeasurementUseCase(measurements).execute({ measurementId: 1, companyId: 1 }),
      MeasurementNotFoundError,
    );
    await assert.rejects(
      () =>
        new UpdateAttachmentUseCase(attachments, measurements).execute({
          attachmentId: 1,
          companyId: 1,
        }),
      AttachmentNotFoundError,
    );
  });

  it('company izolasyonu: başka şirket kaydı görünmez', async () => {
    const { contractId, boqLineId } = await setup();
    await new CreateMeasurementUseCase(measurements, contracts, boq).execute({
      companyId: 1,
      contractId,
      boqLineId,
      measuredQty: 5,
      createdBy: null,
    });
    const otherCompany = await new ListMeasurementsUseCase(measurements).execute({
      companyId: 2,
      contractId,
    });
    assert.equal(otherCompany.length, 0);
  });
});
