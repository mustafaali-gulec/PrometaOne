/**
 * FAZ 9 — Makine parkı testleri.
 *
 * Ağırlık: bakım vadesi / garanti / kiralama matematiği (saf VO) ve sayaç
 * kuralları (geriye gitmez; sıfırlama not ister; bakım kaydı planı ve sayacı
 * birlikte günceller). SQL katmanı smoke'ta canlı sınanır.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type {
  MachineParkDetailsUpdate,
  MachineParkRepository,
  MachineParkRow,
  MaintenancePlanRow,
  MaintenanceRecordRow,
  MeterLogRow,
  NewMaintenancePlanInput,
  NewMaintenanceRecordInput,
} from '../../application/ports/MachineParkRepository.js';
import {
  AddMaintenanceRecordUseCase,
  RecordMeterReadingUseCase,
} from '../../application/useCases/MachineParkUseCases.js';
import {
  ConstructionValidationError,
  MeterRollbackError,
} from '../../domain/errors/ConstructionErrors.js';
import {
  computeMaintenanceDue,
  computeWarrantyStatus,
  rentalDaysLeft,
} from '../../domain/valueObjects/MachinePark.js';
import { FixedClock } from '../fakes.js';

const NOW = new Date('2026-07-30T10:00:00.000Z');
const TODAY = '2026-07-30';

// ===== VADE MATEMATİĞİ ======================================================

describe('computeMaintenanceDue', () => {
  it('meter tipi: vade = son yapılan + aralık; kalan = vade − güncel', () => {
    const due = computeMaintenanceDue(
      { intervalType: 'meter', intervalValue: 250, lastDoneMeter: 1000, lastDoneDate: null },
      1180,
      TODAY,
    );
    assert.equal(due.nextDueMeter, 1250);
    assert.equal(due.remaining, 70);
    assert.equal(due.overdue, false);
  });

  it('meter tipi: vade geçmişse kalan NEGATİF ve overdue', () => {
    const due = computeMaintenanceDue(
      { intervalType: 'meter', intervalValue: 250, lastDoneMeter: 1000, lastDoneDate: null },
      1300,
      TODAY,
    );
    assert.equal(due.remaining, -50);
    assert.equal(due.overdue, true);
  });

  it('days tipi: vade tarihi ve kalan gün', () => {
    const due = computeMaintenanceDue(
      { intervalType: 'days', intervalValue: 180, lastDoneMeter: null, lastDoneDate: '2026-03-01' },
      0,
      TODAY,
    );
    assert.equal(due.nextDueDate, '2026-08-28');
    assert.equal(due.remaining, 29);
    assert.equal(due.overdue, false);
  });

  it('hiç bakım görmemiş planda vade HESAPLANMAZ (null — uydurma vade yok)', () => {
    const due = computeMaintenanceDue(
      { intervalType: 'meter', intervalValue: 250, lastDoneMeter: null, lastDoneDate: null },
      5000,
      TODAY,
    );
    assert.equal(due.remaining, null);
    assert.equal(due.overdue, null);
  });
});

describe('computeWarrantyStatus — iki sınırdan önce dolan biter', () => {
  it('tarih ve sayaç ikisi de içindeyse garanti sürer', () => {
    const w = computeWarrantyStatus('2027-01-01', 10_000, 8_000, TODAY);
    assert.equal(w.inWarranty, true);
    assert.equal(w.meterLeft, 2000);
  });

  it('tarih içinde ama sayaç aşılmışsa garanti BİTMİŞTİR', () => {
    const w = computeWarrantyStatus('2027-01-01', 10_000, 10_500, TODAY);
    assert.equal(w.inWarranty, false);
    assert.equal(w.meterLeft, -500);
  });

  it('sayaç içinde ama tarih geçmişse garanti BİTMİŞTİR', () => {
    const w = computeWarrantyStatus('2026-01-01', 100_000, 50_000, TODAY);
    assert.equal(w.inWarranty, false);
    assert.ok((w.daysLeft ?? 0) < 0);
  });

  it('tek sınır girilmişse yalnız o bakılır; hiçbiri yoksa BİLGİ YOK (null)', () => {
    assert.equal(computeWarrantyStatus('2027-01-01', null, 999_999, TODAY).inWarranty, true);
    assert.equal(computeWarrantyStatus(null, null, 0, TODAY).inWarranty, null);
  });
});

describe('rentalDaysLeft', () => {
  it('kalan gün; bilgi yoksa null; süre dolmuşsa negatif', () => {
    assert.equal(rentalDaysLeft('2026-08-09', TODAY), 10);
    assert.equal(rentalDaysLeft(null, TODAY), null);
    assert.equal(rentalDaysLeft('2026-07-20', TODAY), -10);
  });
});

// ===== SAYAÇ KURALLARI ======================================================

class FakeParkRepo implements MachineParkRepository {
  machine: MachineParkRow = {
    id: 1,
    companyId: 1,
    code: 'EKS-01',
    name: 'Ekskavatör',
    kind: 'owned',
    vendorId: null,
    hourlyCost: 100,
    active: true,
    brand: null,
    model: null,
    modelYear: null,
    plateNo: null,
    chassisNo: null,
    engineNo: null,
    meterType: 'hour',
    currentMeter: 1200,
    purchaseDate: null,
    rentalStart: null,
    rentalEnd: null,
    rentalCost: 0,
    rentalPeriod: null,
    warrantyUntil: null,
    warrantyMeter: null,
    parkNote: null,
  };
  plans: MaintenancePlanRow[] = [];
  records: MaintenanceRecordRow[] = [];
  meterReadings: { readAt: string; meterValue: number; isReset: boolean }[] = [];
  private seq = 100;

  findMachine(id: number): Promise<MachineParkRow | null> {
    return Promise.resolve(id === this.machine.id ? this.machine : null);
  }
  listMachines(): Promise<ReadonlyArray<MachineParkRow>> {
    return Promise.resolve([this.machine]);
  }
  updateDetails(
    _id: number,
    _companyId: number,
    patch: MachineParkDetailsUpdate,
  ): Promise<MachineParkRow> {
    this.machine = { ...this.machine, ...patch } as MachineParkRow;
    return Promise.resolve(this.machine);
  }
  saveMeterReading(input: {
    readAt: string;
    meterValue: number;
    isReset: boolean;
  }): Promise<MachineParkRow> {
    this.meterReadings.push({
      readAt: input.readAt,
      meterValue: input.meterValue,
      isReset: input.isReset,
    });
    this.machine = { ...this.machine, currentMeter: input.meterValue };
    return Promise.resolve(this.machine);
  }
  meterLog(): Promise<ReadonlyArray<MeterLogRow>> {
    return Promise.resolve([]);
  }
  insertPlan(input: NewMaintenancePlanInput): Promise<MaintenancePlanRow> {
    const p: MaintenancePlanRow = {
      id: this.seq++,
      machineId: input.machineId,
      name: input.name,
      intervalType: input.intervalType,
      intervalValue: input.intervalValue,
      lastDoneMeter: input.lastDoneMeter,
      lastDoneDate: input.lastDoneDate,
      note: input.note,
      active: true,
    };
    this.plans.push(p);
    return Promise.resolve(p);
  }
  findPlan(id: number): Promise<MaintenancePlanRow | null> {
    return Promise.resolve(this.plans.find((p) => p.id === id) ?? null);
  }
  listPlans(): Promise<ReadonlyArray<MaintenancePlanRow>> {
    return Promise.resolve(this.plans);
  }
  updatePlan(): Promise<MaintenancePlanRow> {
    return Promise.resolve(this.plans[0]!);
  }
  deactivatePlan(): Promise<void> {
    return Promise.resolve();
  }
  insertRecord(input: NewMaintenanceRecordInput): Promise<MaintenanceRecordRow> {
    const r: MaintenanceRecordRow = {
      id: this.seq++,
      machineId: input.machineId,
      planId: input.planId,
      doneAt: input.doneAt,
      meterAt: input.meterAt,
      cost: input.cost,
      description: input.description,
      vendorId: input.vendorId,
      createdBy: input.createdBy,
      createdAt: NOW.toISOString(),
    };
    this.records.push(r);
    // Gerçek repo plana bağlı kaydın izini transaction'da günceller — fake da öyle.
    if (input.planId !== null) {
      const p = this.plans.find((x) => x.id === input.planId);
      if (p) {
        p.lastDoneDate = input.doneAt;
        if (input.meterAt !== null) p.lastDoneMeter = input.meterAt;
      }
    }
    return Promise.resolve(r);
  }
  listRecords(): Promise<ReadonlyArray<MaintenanceRecordRow>> {
    return Promise.resolve(this.records);
  }
}

describe('RecordMeterReadingUseCase', () => {
  let repo: FakeParkRepo;
  let uc: RecordMeterReadingUseCase;

  beforeEach(() => {
    repo = new FakeParkRepo();
    uc = new RecordMeterReadingUseCase(repo, new FixedClock(NOW));
  });

  it('ileri okuma kabul edilir ve güncel sayaç ilerler', async () => {
    const dto = await uc.execute({ machineId: 1, companyId: 1, meterValue: 1250 });
    assert.equal(dto.currentMeter, 1250);
  });

  it('GERİYE OKUMA REDDEDİLİR (sessiz düşüş garanti/bakım hesabını bozar)', async () => {
    await assert.rejects(
      uc.execute({ machineId: 1, companyId: 1, meterValue: 1100 }),
      MeterRollbackError,
    );
  });

  it('sayaç değişimi: isReset + not ile geriye izin; notsuz sıfırlama 400', async () => {
    await assert.rejects(
      uc.execute({ machineId: 1, companyId: 1, meterValue: 0, isReset: true }),
      ConstructionValidationError,
    );
    const dto = await uc.execute({
      machineId: 1,
      companyId: 1,
      meterValue: 0,
      isReset: true,
      note: 'Sayaç değişti — yenisi sıfırdan başlıyor',
    });
    assert.equal(dto.currentMeter, 0);
    assert.equal(repo.meterReadings[0]!.isReset, true);
  });

  it('geleceğe okuma yazılamaz', async () => {
    await assert.rejects(
      uc.execute({ machineId: 1, companyId: 1, meterValue: 1300, readAt: '2026-08-05' }),
      ConstructionValidationError,
    );
  });
});

describe('AddMaintenanceRecordUseCase', () => {
  let repo: FakeParkRepo;
  let uc: AddMaintenanceRecordUseCase;

  beforeEach(() => {
    repo = new FakeParkRepo();
    uc = new AddMaintenanceRecordUseCase(
      repo,
      new RecordMeterReadingUseCase(repo, new FixedClock(NOW)),
      new FixedClock(NOW),
    );
  });

  it('plana bağlı kayıt planın izini VE sayacı birlikte günceller', async () => {
    const plan = await repo.insertPlan({
      companyId: 1,
      machineId: 1,
      name: 'Yağ değişimi',
      intervalType: 'meter',
      intervalValue: 250,
      lastDoneMeter: 1000,
      lastDoneDate: '2026-06-01',
      note: null,
      createdBy: null,
    });
    await uc.execute({
      machineId: 1,
      companyId: 1,
      planId: plan.id,
      meterAt: 1260,
      description: 'Yağ + filtre değişti',
    });
    assert.equal(repo.plans[0]!.lastDoneMeter, 1260);
    assert.equal(repo.plans[0]!.lastDoneDate, TODAY);
    assert.equal(repo.machine.currentMeter, 1260);
    // Bir sonraki vade artık 1510
    const due = computeMaintenanceDue(repo.plans[0]!, repo.machine.currentMeter, TODAY);
    assert.equal(due.nextDueMeter, 1510);
  });

  it('bakımda okunan sayaç da geriye gidemez', async () => {
    await assert.rejects(
      uc.execute({ machineId: 1, companyId: 1, meterAt: 900, description: 'arıza' }),
      MeterRollbackError,
    );
  });

  it('plansız (arıza) kayıt plan izine dokunmaz', async () => {
    const plan = await repo.insertPlan({
      companyId: 1,
      machineId: 1,
      name: 'Yağ değişimi',
      intervalType: 'meter',
      intervalValue: 250,
      lastDoneMeter: 1000,
      lastDoneDate: '2026-06-01',
      note: null,
      createdBy: null,
    });
    await uc.execute({ machineId: 1, companyId: 1, description: 'Hortum patladı', cost: 1500 });
    assert.equal(repo.plans[0]!.lastDoneMeter, 1000);
    assert.equal(plan.lastDoneDate, '2026-06-01');
  });
});
