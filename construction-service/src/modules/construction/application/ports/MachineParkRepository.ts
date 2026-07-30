/**
 * MachineParkRepository — makine parkı kalıcılık portu (FAZ 9).
 * Concrete: infrastructure/persistence/PgMachineParkRepository.ts
 *
 * SF-6'nın minimal MachineRepository'sine DOKUNMAZ: park ekranı cs_machines'in
 * zenginleştirilmiş kolonlarını + sayaç günlüğünü + bakım tablolarını kendi
 * portu üzerinden okur/yazar; eski uçlar aynen çalışır.
 */
import type { MachineKind } from '../../domain/valueObjects/Labor.js';
import type {
  MaintenanceIntervalType,
  MeterType,
  RentalPeriod,
} from '../../domain/valueObjects/MachinePark.js';

/** cs_machines tam satırı (SF-6 alanları + Faz 9 park alanları). */
export interface MachineParkRow {
  id: number;
  companyId: number;
  code: string;
  name: string;
  kind: MachineKind;
  vendorId: number | null;
  hourlyCost: number;
  active: boolean;
  brand: string | null;
  model: string | null;
  modelYear: number | null;
  plateNo: string | null;
  chassisNo: string | null;
  engineNo: string | null;
  meterType: MeterType;
  currentMeter: number;
  purchaseDate: string | null;
  rentalStart: string | null;
  rentalEnd: string | null;
  rentalCost: number;
  rentalPeriod: RentalPeriod | null;
  warrantyUntil: string | null;
  warrantyMeter: number | null;
  parkNote: string | null;
}

export interface MachineParkDetailsUpdate {
  brand?: string | null | undefined;
  model?: string | null | undefined;
  modelYear?: number | null | undefined;
  plateNo?: string | null | undefined;
  chassisNo?: string | null | undefined;
  engineNo?: string | null | undefined;
  meterType?: MeterType | undefined;
  purchaseDate?: string | null | undefined;
  rentalStart?: string | null | undefined;
  rentalEnd?: string | null | undefined;
  rentalCost?: number | undefined;
  rentalPeriod?: RentalPeriod | null | undefined;
  warrantyUntil?: string | null | undefined;
  warrantyMeter?: number | null | undefined;
  parkNote?: string | null | undefined;
}

export interface MeterLogRow {
  id: number;
  machineId: number;
  readAt: string;
  meterValue: number;
  isReset: boolean;
  note: string | null;
  createdBy: number | null;
  createdAt: string;
}

export interface MaintenancePlanRow {
  id: number;
  machineId: number;
  name: string;
  intervalType: MaintenanceIntervalType;
  intervalValue: number;
  lastDoneMeter: number | null;
  lastDoneDate: string | null;
  note: string | null;
  active: boolean;
}

export interface NewMaintenancePlanInput {
  companyId: number;
  machineId: number;
  name: string;
  intervalType: MaintenanceIntervalType;
  intervalValue: number;
  lastDoneMeter: number | null;
  lastDoneDate: string | null;
  note: string | null;
  createdBy: number | null;
}

export interface MaintenanceRecordRow {
  id: number;
  machineId: number;
  planId: number | null;
  doneAt: string;
  meterAt: number | null;
  cost: number;
  description: string;
  vendorId: number | null;
  createdBy: number | null;
  createdAt: string;
}

export interface NewMaintenanceRecordInput {
  companyId: number;
  machineId: number;
  planId: number | null;
  doneAt: string;
  meterAt: number | null;
  cost: number;
  description: string;
  vendorId: number | null;
  createdBy: number | null;
}

export interface MachineParkRepository {
  findMachine(id: number, companyId: number): Promise<MachineParkRow | null>;
  listMachines(
    companyId: number,
    includeInactive?: boolean,
  ): Promise<ReadonlyArray<MachineParkRow>>;
  updateDetails(
    id: number,
    companyId: number,
    patch: MachineParkDetailsUpdate,
  ): Promise<MachineParkRow>;

  /**
   * Sayaç okuma + cs_machines.current_meter güncellemesi TEK transaction'da.
   * Aynı güne ikinci okuma üzerine yazar (upsert).
   */
  saveMeterReading(input: {
    companyId: number;
    machineId: number;
    readAt: string;
    meterValue: number;
    isReset: boolean;
    note: string | null;
    createdBy: number | null;
  }): Promise<MachineParkRow>;
  meterLog(machineId: number, companyId: number): Promise<ReadonlyArray<MeterLogRow>>;

  insertPlan(input: NewMaintenancePlanInput): Promise<MaintenancePlanRow>;
  findPlan(id: number, companyId: number): Promise<MaintenancePlanRow | null>;
  listPlans(machineId: number, companyId: number): Promise<ReadonlyArray<MaintenancePlanRow>>;
  updatePlan(
    id: number,
    companyId: number,
    patch: Partial<Omit<NewMaintenancePlanInput, 'companyId' | 'machineId' | 'createdBy'>>,
  ): Promise<MaintenancePlanRow>;
  deactivatePlan(id: number, companyId: number): Promise<void>;

  /** Kayıt + (plana bağlıysa) planın last_done_* güncellemesi TEK transaction'da. */
  insertRecord(input: NewMaintenanceRecordInput): Promise<MaintenanceRecordRow>;
  listRecords(machineId: number, companyId: number): Promise<ReadonlyArray<MaintenanceRecordRow>>;
}
