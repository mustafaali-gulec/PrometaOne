/**
 * Makine parkı use-case'leri (FAZ 9).
 *
 * SAYAÇ KURALI: okuma geriye gidemez — sessiz düşüş garanti ve bakım hesabını
 * bozar. Geriye gidişin tek meşru yolu SAYAÇ DEĞİŞİMİ/SIFIRLAMA: isReset=true
 * + zorunlu not. Geleceğe okuma yazılamaz (sayaç "oldu" bilgisidir).
 *
 * BAKIM KAYDI plana bağlıysa planın last_done_* alanlarını günceller — bir
 * sonraki vade oradan hesaplanır. Kayıtta sayaç verilmişse aynı işlemde sayaç
 * okuması olarak da işlenir (bakımda sayaç zaten okunur; iki ayrı giriş
 * istemek unutulan sayaç demektir).
 */
import {
  ConstructionValidationError,
  MachineNotFoundError,
  MaintenancePlanNotFoundError,
  MeterRollbackError,
} from '../../domain/errors/ConstructionErrors.js';
import {
  computeMaintenanceDue,
  computeWarrantyStatus,
  rentalDaysLeft,
  type MaintenanceDue,
  type MaintenanceIntervalType,
  type WarrantyStatus,
} from '../../domain/valueObjects/MachinePark.js';
import type { Clock } from '../ports/Clock.js';
import type {
  MachineParkDetailsUpdate,
  MachineParkRepository,
  MachineParkRow,
  MaintenancePlanRow,
  MaintenanceRecordRow,
  MeterLogRow,
} from '../ports/MachineParkRepository.js';

// ===== DTO ==================================================================

export interface MachineParkDto extends MachineParkRow {
  /** Garanti durumu (tarih VE sayaç sınırından hesaplanır). */
  warranty: WarrantyStatus;
  /** Kiralamada kalan gün; kiralama bilgisi yoksa null. */
  rentalDaysLeft: number | null;
  /** Aktif planlar arasında vadesi GEÇMİŞ olan sayısı. */
  overduePlanCount: number;
  /** Vadesi hesaplanamayan (hiç bakım görmemiş) plan sayısı. */
  plansWithoutBaseline: number;
}

export interface MaintenancePlanDto extends MaintenancePlanRow {
  due: MaintenanceDue;
}

export interface MachineMaintenanceDto {
  machine: MachineParkDto;
  plans: MaintenancePlanDto[];
  records: MaintenanceRecordRow[];
  meterLog: MeterLogRow[];
}

function toParkDto(
  row: MachineParkRow,
  plans: ReadonlyArray<MaintenancePlanRow>,
  today: string,
): MachineParkDto {
  const dues = plans
    .filter((p) => p.active)
    .map((p) => computeMaintenanceDue(p, row.currentMeter, today));
  return {
    ...row,
    warranty: computeWarrantyStatus(row.warrantyUntil, row.warrantyMeter, row.currentMeter, today),
    rentalDaysLeft: rentalDaysLeft(row.rentalEnd, today),
    overduePlanCount: dues.filter((d) => d.overdue === true).length,
    plansWithoutBaseline: dues.filter((d) => d.overdue === null).length,
  };
}

// ===== PARK LİSTESİ + DETAY GÜNCELLEME ======================================

export class ListMachineParkUseCase {
  constructor(
    private readonly park: MachineParkRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    companyId: number;
    includeInactive?: boolean | undefined;
  }): Promise<MachineParkDto[]> {
    const today = this.clock.now().toISOString().slice(0, 10);
    const machines = await this.park.listMachines(input.companyId, input.includeInactive ?? false);
    // Plan vadeleri liste rozetlerinde görünür — makine başına planlar okunur.
    // Park listesi onlarca makinedir, binlerce değil; N+1 burada kabul edilebilir
    // ve toplu sorgu karmaşıklığına değmez.
    const out: MachineParkDto[] = [];
    for (const m of machines) {
      const plans = await this.park.listPlans(m.id, input.companyId);
      out.push(toParkDto(m, plans, today));
    }
    return out;
  }
}

export class UpdateMachineParkDetailsUseCase {
  constructor(
    private readonly park: MachineParkRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: { machineId: number; companyId: number } & MachineParkDetailsUpdate,
  ): Promise<MachineParkDto> {
    const machine = await this.park.findMachine(input.machineId, input.companyId);
    if (!machine) throw new MachineNotFoundError(input.machineId);

    const rentalStart = input.rentalStart !== undefined ? input.rentalStart : machine.rentalStart;
    const rentalEnd = input.rentalEnd !== undefined ? input.rentalEnd : machine.rentalEnd;
    if (rentalStart !== null && rentalEnd !== null && rentalStart > rentalEnd) {
      throw new ConstructionValidationError('kiralama başlangıcı bitişten sonra olamaz');
    }

    const { machineId: _m, companyId: _c, ...patch } = input;
    const updated = await this.park.updateDetails(input.machineId, input.companyId, patch);
    const plans = await this.park.listPlans(input.machineId, input.companyId);
    return toParkDto(updated, plans, this.clock.now().toISOString().slice(0, 10));
  }
}

// ===== SAYAÇ ================================================================

export class RecordMeterReadingUseCase {
  constructor(
    private readonly park: MachineParkRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    machineId: number;
    companyId: number;
    meterValue: number;
    readAt?: string | undefined;
    /** Sayaç değişimi/sıfırlama — geriye gidişin tek meşru yolu; not zorunlu. */
    isReset?: boolean | undefined;
    note?: string | null | undefined;
    actorUserId?: number | null | undefined;
  }): Promise<MachineParkDto> {
    const machine = await this.park.findMachine(input.machineId, input.companyId);
    if (!machine) throw new MachineNotFoundError(input.machineId);

    const today = this.clock.now().toISOString().slice(0, 10);
    const readAt = input.readAt ?? today;
    if (readAt > today) {
      throw new ConstructionValidationError('sayaç okuması geleceğe yazılamaz');
    }
    if (input.meterValue < 0) {
      throw new ConstructionValidationError('sayaç değeri negatif olamaz');
    }

    const isReset = input.isReset === true;
    if (!isReset && input.meterValue < machine.currentMeter) {
      throw new MeterRollbackError(machine.currentMeter, input.meterValue);
    }
    if (isReset && (input.note === null || input.note === undefined || input.note.trim() === '')) {
      // Sıfırlamanın nedeni ize düşmek ZORUNDA: garanti/bakım hesabı bu kaydın
      // üstünden okunur, gerekçesiz sıfırlama sessiz düşüşten farksız olur.
      throw new ConstructionValidationError('sayaç değişimi/sıfırlama not gerektirir');
    }

    const updated = await this.park.saveMeterReading({
      companyId: input.companyId,
      machineId: input.machineId,
      readAt,
      meterValue: input.meterValue,
      isReset,
      note: input.note?.trim() || null,
      createdBy: input.actorUserId ?? null,
    });
    const plans = await this.park.listPlans(input.machineId, input.companyId);
    return toParkDto(updated, plans, today);
  }
}

// ===== BAKIM ================================================================

export class CreateMaintenancePlanUseCase {
  constructor(
    private readonly park: MachineParkRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    machineId: number;
    companyId: number;
    name: string;
    intervalType: MaintenanceIntervalType;
    intervalValue: number;
    /** Başlangıç izi: makine parka mevcut bakım geçmişiyle girer. */
    lastDoneMeter?: number | null | undefined;
    lastDoneDate?: string | null | undefined;
    note?: string | null | undefined;
    createdBy?: number | null | undefined;
  }): Promise<MaintenancePlanDto> {
    const machine = await this.park.findMachine(input.machineId, input.companyId);
    if (!machine) throw new MachineNotFoundError(input.machineId);
    if (input.name.trim() === '') {
      throw new ConstructionValidationError('bakım planı adı boş olamaz');
    }
    if (input.intervalValue <= 0) {
      throw new ConstructionValidationError('bakım aralığı pozitif olmalı');
    }

    const plan = await this.park.insertPlan({
      companyId: input.companyId,
      machineId: input.machineId,
      name: input.name.trim(),
      intervalType: input.intervalType,
      intervalValue: input.intervalValue,
      lastDoneMeter: input.lastDoneMeter ?? null,
      lastDoneDate: input.lastDoneDate ?? null,
      note: input.note?.trim() || null,
      createdBy: input.createdBy ?? null,
    });
    const today = this.clock.now().toISOString().slice(0, 10);
    return { ...plan, due: computeMaintenanceDue(plan, machine.currentMeter, today) };
  }
}

export class DeactivateMaintenancePlanUseCase {
  constructor(private readonly park: MachineParkRepository) {}

  async execute(input: { planId: number; companyId: number }): Promise<{ deleted: boolean }> {
    const plan = await this.park.findPlan(input.planId, input.companyId);
    if (!plan) throw new MaintenancePlanNotFoundError(input.planId);
    await this.park.deactivatePlan(input.planId, input.companyId);
    return { deleted: true };
  }
}

export class AddMaintenanceRecordUseCase {
  constructor(
    private readonly park: MachineParkRepository,
    private readonly meterReading: RecordMeterReadingUseCase,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    machineId: number;
    companyId: number;
    planId?: number | null | undefined;
    doneAt?: string | undefined;
    meterAt?: number | null | undefined;
    cost?: number | undefined;
    description: string;
    vendorId?: number | null | undefined;
    actorUserId?: number | null | undefined;
  }): Promise<MaintenanceRecordRow> {
    const machine = await this.park.findMachine(input.machineId, input.companyId);
    if (!machine) throw new MachineNotFoundError(input.machineId);
    if (input.description.trim() === '') {
      throw new ConstructionValidationError('bakım açıklaması boş olamaz');
    }
    const today = this.clock.now().toISOString().slice(0, 10);
    const doneAt = input.doneAt ?? today;
    if (doneAt > today) {
      throw new ConstructionValidationError('bakım kaydı geleceğe yazılamaz');
    }

    const planId = input.planId ?? null;
    if (planId !== null) {
      const plan = await this.park.findPlan(planId, input.companyId);
      if (!plan || plan.machineId !== input.machineId) {
        throw new MaintenancePlanNotFoundError(planId);
      }
    }

    // Bakımda okunan sayaç aynı işlemde sayaç günlüğüne de düşer — iki ayrı
    // giriş istemek unutulan sayaç demektir. Sayaç kuralları (geriye gitmez)
    // burada da aynen geçerli.
    if (input.meterAt !== null && input.meterAt !== undefined) {
      await this.meterReading.execute({
        machineId: input.machineId,
        companyId: input.companyId,
        meterValue: input.meterAt,
        readAt: doneAt,
        note: `bakım: ${input.description.trim()}`,
        actorUserId: input.actorUserId ?? null,
      });
    }

    return this.park.insertRecord({
      companyId: input.companyId,
      machineId: input.machineId,
      planId,
      doneAt,
      meterAt: input.meterAt ?? null,
      cost: input.cost ?? 0,
      description: input.description.trim(),
      vendorId: input.vendorId ?? null,
      createdBy: input.actorUserId ?? null,
    });
  }
}

export class GetMachineMaintenanceUseCase {
  constructor(
    private readonly park: MachineParkRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { machineId: number; companyId: number }): Promise<MachineMaintenanceDto> {
    const machine = await this.park.findMachine(input.machineId, input.companyId);
    if (!machine) throw new MachineNotFoundError(input.machineId);

    const today = this.clock.now().toISOString().slice(0, 10);
    const [plans, records, meterLog] = await Promise.all([
      this.park.listPlans(input.machineId, input.companyId),
      this.park.listRecords(input.machineId, input.companyId),
      this.park.meterLog(input.machineId, input.companyId),
    ]);
    return {
      machine: toParkDto(machine, plans, today),
      plans: plans.map((p) => ({
        ...p,
        due: computeMaintenanceDue(p, machine.currentMeter, today),
      })),
      records: [...records],
      meterLog: [...meterLog],
    };
  }
}
