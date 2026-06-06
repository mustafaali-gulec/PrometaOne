/**
 * Construction modülü test fake'leri — in-memory repository'ler + sabit Clock.
 */
import type { BoqRepository, NewBoqLineInput } from '../application/ports/BoqRepository.js';
import type { Clock } from '../application/ports/Clock.js';
import type {
  ContractRepository,
  ListContractsOptions,
  NewContractInput,
} from '../application/ports/ContractRepository.js';
import type { DomainEvent, EventPublisher } from '../application/ports/EventPublisher.js';
import type {
  AdvanceRepository,
  CashMovementRepository,
  CategoryTotal,
  ExpenseRepository,
  NewAdvanceInput,
  NewCashMovementInput,
  NewExpenseInput,
} from '../application/ports/FinanceRepositories.js';
import type {
  MachineLogRepository,
  MachineRepository,
  NewMachineInput,
  NewMachineLogInput,
  NewPersonnelInput,
  NewTimesheetInput,
  PersonnelRepository,
  TimesheetRepository,
} from '../application/ports/LaborRepositories.js';
import type {
  MaterialRepository,
  MaterialRequestRepository,
  MreqStatusChange,
  NewMaterialInput,
  NewMaterialRequestInput,
  NewMaterialRequestLineInput,
  NewStockMovementInput,
  NewWarehouseInput,
  StockRepository,
  StockView,
  WarehouseRepository,
} from '../application/ports/MaterialRepositories.js';
import type {
  ListPozOptions,
  NewPozInput,
  PozCatalogRepository,
} from '../application/ports/PozCatalogRepository.js';
import type {
  BoqLineCumulative,
  HeaderTotals,
  NewDeductionInput,
  NewProgressInput,
  NewProgressLineInput,
  ProgressPaymentRepository,
  StatusChange,
} from '../application/ports/ProgressPaymentRepository.js';
import type {
  ListProjectsOptions,
  NewProjectInput,
  ProjectRepository,
} from '../application/ports/ProjectRepository.js';
import { Advance } from '../domain/entities/Advance.js';
import { BoqLine } from '../domain/entities/BoqLine.js';
import { CashMovement } from '../domain/entities/CashMovement.js';
import { Contract } from '../domain/entities/Contract.js';
import { Expense } from '../domain/entities/Expense.js';
import { Machine } from '../domain/entities/Machine.js';
import { MachineLog } from '../domain/entities/MachineLog.js';
import { Material } from '../domain/entities/Material.js';
import { MaterialRequest, type MaterialRequestProps } from '../domain/entities/MaterialRequest.js';
import { Personnel } from '../domain/entities/Personnel.js';
import { Poz } from '../domain/entities/Poz.js';
import {
  ProgressPayment,
  type DeductionData,
  type ProgressLineData,
  type ProgressPaymentProps,
} from '../domain/entities/ProgressPayment.js';
import { Project } from '../domain/entities/Project.js';
import { StockMovement } from '../domain/entities/StockMovement.js';
import { Timesheet } from '../domain/entities/Timesheet.js';
import { Warehouse } from '../domain/entities/Warehouse.js';
import type { ProgressKind } from '../domain/valueObjects/ProgressStatus.js';

export class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}
  now(): Date {
    return this.fixed;
  }
}

/** Testlerde event yayınını yutar; yayınlananları doğrulama için saklar. */
export class FakeEventPublisher implements EventPublisher {
  readonly events: DomainEvent[] = [];
  async publish(event: DomainEvent): Promise<void> {
    this.events.push(event);
  }
}

export class InMemoryProjectRepository implements ProjectRepository {
  private items: Project[] = [];
  private seq = 0;

  async insert(input: NewProjectInput): Promise<Project> {
    this.seq += 1;
    const now = new Date('2026-06-06T00:00:00.000Z');
    const project = Project.create({
      id: this.seq,
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      projectType: input.projectType,
      status: input.status,
      orgUnitId: input.orgUnitId,
      managerUserId: input.managerUserId,
      location: input.location,
      startDate: input.startDate,
      plannedEnd: input.plannedEnd,
      budgetAmount: input.budgetAmount,
      currency: input.currency,
      active: true,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });
    this.items.push(project);
    return project;
  }

  async update(project: Project): Promise<void> {
    const idx = this.items.findIndex(
      (p) => p.id === project.id && p.companyId === project.companyId,
    );
    if (idx >= 0) this.items[idx] = project;
  }

  async findById(id: number, companyId: number): Promise<Project | null> {
    return this.items.find((p) => p.id === id && p.companyId === companyId) ?? null;
  }

  async listByCompany(
    companyId: number,
    options?: ListProjectsOptions,
  ): Promise<ReadonlyArray<Project>> {
    return this.items.filter((p) => {
      if (p.companyId !== companyId) return false;
      if (options?.includeInactive !== true && !p.active) return false;
      if (options?.status && p.status !== options.status) return false;
      if (options?.projectType && p.projectType !== options.projectType) return false;
      return true;
    });
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    return this.items.some(
      (p) => p.companyId === companyId && p.code === code && p.id !== excludeId,
    );
  }
}

export class InMemoryContractRepository implements ContractRepository {
  private items: Contract[] = [];
  private seq = 0;

  async insert(input: NewContractInput): Promise<Contract> {
    this.seq += 1;
    const now = new Date('2026-06-06T00:00:00.000Z');
    const contract = Contract.create({
      id: this.seq,
      companyId: input.companyId,
      projectId: input.projectId,
      partyKind: input.partyKind,
      vendorId: input.vendorId,
      contractNo: input.contractNo,
      title: input.title,
      amount: input.amount,
      currency: input.currency,
      signDate: input.signDate,
      startDate: input.startDate,
      endDate: input.endDate,
      retentionPct: input.retentionPct,
      advancePct: input.advancePct,
      priceDiffOn: input.priceDiffOn,
      tender: input.tender,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });
    this.items.push(contract);
    return contract;
  }

  async update(contract: Contract): Promise<void> {
    const idx = this.items.findIndex(
      (c) => c.id === contract.id && c.companyId === contract.companyId,
    );
    if (idx >= 0) this.items[idx] = contract;
  }

  async findById(id: number, companyId: number): Promise<Contract | null> {
    return this.items.find((c) => c.id === id && c.companyId === companyId) ?? null;
  }

  async listByCompany(
    companyId: number,
    options?: ListContractsOptions,
  ): Promise<ReadonlyArray<Contract>> {
    return this.items.filter((c) => {
      if (c.companyId !== companyId) return false;
      if (options?.projectId !== undefined && c.projectId !== options.projectId) return false;
      if (options?.partyKind && c.partyKind !== options.partyKind) return false;
      return true;
    });
  }

  async existsByNo(companyId: number, contractNo: string, excludeId?: number): Promise<boolean> {
    return this.items.some(
      (c) => c.companyId === companyId && c.contractNo === contractNo && c.id !== excludeId,
    );
  }
}

export class InMemoryPozCatalogRepository implements PozCatalogRepository {
  private items: Poz[] = [];
  private seq = 0;

  async insert(input: NewPozInput): Promise<Poz> {
    this.seq += 1;
    const now = new Date('2026-06-06T00:00:00.000Z');
    const poz = Poz.create({
      id: this.seq,
      companyId: input.companyId,
      pozNo: input.pozNo,
      name: input.name,
      unit: input.unit,
      unitPrice: input.unitPrice,
      source: input.source,
      year: input.year,
      active: true,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });
    this.items.push(poz);
    return poz;
  }

  async update(poz: Poz): Promise<void> {
    const idx = this.items.findIndex((p) => p.id === poz.id && p.companyId === poz.companyId);
    if (idx >= 0) this.items[idx] = poz;
  }

  async findById(id: number, companyId: number): Promise<Poz | null> {
    return this.items.find((p) => p.id === id && p.companyId === companyId) ?? null;
  }

  async listByCompany(companyId: number, options?: ListPozOptions): Promise<ReadonlyArray<Poz>> {
    return this.items.filter((p) => {
      if (p.companyId !== companyId) return false;
      if (options?.includeInactive !== true && !p.active) return false;
      return true;
    });
  }

  async existsByPozNo(
    companyId: number,
    pozNo: string,
    year: number | null,
    excludeId?: number,
  ): Promise<boolean> {
    return this.items.some(
      (p) =>
        p.companyId === companyId && p.pozNo === pozNo && p.year === year && p.id !== excludeId,
    );
  }
}

export class InMemoryBoqRepository implements BoqRepository {
  private items: BoqLine[] = [];
  private seq = 0;

  async listLinesByContract(
    contractId: number,
    companyId: number,
  ): Promise<ReadonlyArray<BoqLine>> {
    return this.items
      .filter((l) => l.contractId === contractId && l.companyId === companyId)
      .sort((a, b) => a.lineNo - b.lineNo);
  }

  async replaceLines(
    contractId: number,
    companyId: number,
    lines: ReadonlyArray<NewBoqLineInput>,
  ): Promise<ReadonlyArray<BoqLine>> {
    this.items = this.items.filter(
      (l) => !(l.contractId === contractId && l.companyId === companyId),
    );
    const now = new Date('2026-06-06T00:00:00.000Z');
    const out: BoqLine[] = [];
    for (const l of lines) {
      this.seq += 1;
      const line = BoqLine.create({
        id: this.seq,
        companyId,
        contractId,
        groupId: l.groupId,
        pozId: l.pozId,
        lineNo: l.lineNo,
        pozNo: l.pozNo,
        description: l.description,
        unit: l.unit,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        amount: l.amount,
        pursantajPct: l.pursantajPct,
        createdAt: now,
        updatedAt: now,
      });
      this.items.push(line);
      out.push(line);
    }
    return out;
  }
}

interface HeaderState {
  props: Omit<ProgressPaymentProps, 'lines' | 'deductions'>;
}

export class InMemoryProgressPaymentRepository implements ProgressPaymentRepository {
  private headers = new Map<number, HeaderState>();
  private linesByPid = new Map<number, ProgressLineData[]>();
  private dedsByPid = new Map<number, DeductionData[]>();
  private seq = 0;
  private lineSeq = 0;
  private dedSeq = 0;
  private readonly now = new Date('2026-06-06T00:00:00.000Z');

  private build(id: number): ProgressPayment {
    const h = this.headers.get(id)!;
    return ProgressPayment.create({
      ...h.props,
      lines: (this.linesByPid.get(id) ?? []).map((l) => ({ ...l })),
      deductions: (this.dedsByPid.get(id) ?? []).map((d) => ({ ...d })),
    });
  }

  async insert(input: NewProgressInput): Promise<ProgressPayment> {
    this.seq += 1;
    const id = this.seq;
    this.headers.set(id, {
      props: {
        id,
        companyId: input.companyId,
        contractId: input.contractId,
        hakedisNo: input.hakedisNo,
        kind: input.kind,
        ptype: input.ptype,
        seqNo: input.seqNo,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        status: 'draft',
        grossThis: input.totals.grossThis,
        grossCumul: input.totals.grossCumul,
        priceDiff: input.totals.priceDiff,
        deductionsTot: input.totals.deductionsTot,
        netPayable: input.totals.netPayable,
        currency: input.currency,
        submittedAt: null,
        approvedAt: null,
        approvedBy: null,
        createdBy: input.createdBy,
        createdAt: this.now,
        updatedAt: this.now,
      },
    });
    this.linesByPid.set(id, this.toLineData(input.lines));
    this.dedsByPid.set(id, []);
    return this.build(id);
  }

  private toLineData(lines: ReadonlyArray<NewProgressLineInput>): ProgressLineData[] {
    return lines.map((l) => {
      this.lineSeq += 1;
      return { id: this.lineSeq, ...l };
    });
  }

  async findById(id: number, companyId: number): Promise<ProgressPayment | null> {
    const h = this.headers.get(id);
    if (!h || h.props.companyId !== companyId) return null;
    return this.build(id);
  }

  async listByContract(
    contractId: number,
    companyId: number,
    kind?: ProgressKind,
  ): Promise<ReadonlyArray<ProgressPayment>> {
    const out: ProgressPayment[] = [];
    for (const [id, h] of this.headers) {
      if (h.props.contractId !== contractId || h.props.companyId !== companyId) continue;
      if (kind !== undefined && h.props.kind !== kind) continue;
      out.push(this.build(id));
    }
    return out;
  }

  async countByContractKind(
    contractId: number,
    companyId: number,
    kind: ProgressKind,
  ): Promise<number> {
    let n = 0;
    for (const h of this.headers.values()) {
      if (
        h.props.contractId === contractId &&
        h.props.companyId === companyId &&
        h.props.kind === kind
      )
        n += 1;
    }
    return n;
  }

  async sumApprovedQtyByBoqLine(
    contractId: number,
    companyId: number,
    kind: ProgressKind,
  ): Promise<ReadonlyArray<BoqLineCumulative>> {
    const sums = new Map<number, number>();
    for (const [id, h] of this.headers) {
      if (h.props.contractId !== contractId || h.props.companyId !== companyId) continue;
      if (h.props.kind !== kind) continue;
      if (h.props.status !== 'approved' && h.props.status !== 'paid') continue;
      for (const l of this.linesByPid.get(id) ?? []) {
        sums.set(l.boqLineId, (sums.get(l.boqLineId) ?? 0) + l.thisQty);
      }
    }
    return Array.from(sums.entries()).map(([boqLineId, qty]) => ({ boqLineId, qty }));
  }

  async saveLines(
    progressId: number,
    companyId: number,
    lines: ReadonlyArray<NewProgressLineInput>,
    totals: HeaderTotals,
  ): Promise<ProgressPayment> {
    const h = this.headers.get(progressId);
    if (!h || h.props.companyId !== companyId) throw new Error('not found');
    this.linesByPid.set(progressId, this.toLineData(lines));
    h.props.grossThis = totals.grossThis;
    h.props.grossCumul = totals.grossCumul;
    h.props.netPayable = totals.netPayable;
    return this.build(progressId);
  }

  async saveDeductions(
    progressId: number,
    companyId: number,
    deductions: ReadonlyArray<NewDeductionInput>,
    totals: HeaderTotals,
  ): Promise<ProgressPayment> {
    const h = this.headers.get(progressId);
    if (!h || h.props.companyId !== companyId) throw new Error('not found');
    this.dedsByPid.set(
      progressId,
      deductions.map((d) => {
        this.dedSeq += 1;
        return { id: this.dedSeq, ...d };
      }),
    );
    h.props.priceDiff = totals.priceDiff;
    h.props.deductionsTot = totals.deductionsTot;
    h.props.netPayable = totals.netPayable;
    return this.build(progressId);
  }

  async changeStatus(
    progressId: number,
    companyId: number,
    change: StatusChange,
  ): Promise<ProgressPayment> {
    const h = this.headers.get(progressId);
    if (!h || h.props.companyId !== companyId) throw new Error('not found');
    h.props.status = change.toStatus;
    h.props.submittedAt = change.submittedAt;
    h.props.approvedAt = change.approvedAt;
    h.props.approvedBy = change.approvedBy;
    return this.build(progressId);
  }
}

const FNOW = new Date('2026-06-06T00:00:00.000Z');

export class InMemoryExpenseRepository implements ExpenseRepository {
  private items: Expense[] = [];
  private seq = 0;
  async insert(input: NewExpenseInput): Promise<Expense> {
    this.seq += 1;
    const e = Expense.create({ id: this.seq, ...input, createdAt: FNOW, updatedAt: FNOW });
    this.items.push(e);
    return e;
  }
  async update(e: Expense): Promise<void> {
    const i = this.items.findIndex((x) => x.id === e.id && x.companyId === e.companyId);
    if (i >= 0) this.items[i] = e;
  }
  async delete(id: number, companyId: number): Promise<boolean> {
    const before = this.items.length;
    this.items = this.items.filter((x) => !(x.id === id && x.companyId === companyId));
    return this.items.length < before;
  }
  async findById(id: number, companyId: number): Promise<Expense | null> {
    return this.items.find((x) => x.id === id && x.companyId === companyId) ?? null;
  }
  async listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<Expense>> {
    return this.items.filter((x) => x.projectId === projectId && x.companyId === companyId);
  }
  async sumByCategory(projectId: number, companyId: number): Promise<ReadonlyArray<CategoryTotal>> {
    const m = new Map<string, number>();
    for (const x of this.items) {
      if (x.projectId !== projectId || x.companyId !== companyId) continue;
      m.set(x.category, (m.get(x.category) ?? 0) + x.amount);
    }
    return Array.from(m.entries()).map(([category, amount]) => ({ category, amount }));
  }
}

export class InMemoryAdvanceRepository implements AdvanceRepository {
  private items: Advance[] = [];
  private seq = 0;
  async insert(input: NewAdvanceInput): Promise<Advance> {
    this.seq += 1;
    const a = Advance.create({ id: this.seq, ...input, createdAt: FNOW, updatedAt: FNOW });
    this.items.push(a);
    return a;
  }
  async update(a: Advance): Promise<void> {
    const i = this.items.findIndex((x) => x.id === a.id && x.companyId === a.companyId);
    if (i >= 0) this.items[i] = a;
  }
  async delete(id: number, companyId: number): Promise<boolean> {
    const before = this.items.length;
    this.items = this.items.filter((x) => !(x.id === id && x.companyId === companyId));
    return this.items.length < before;
  }
  async findById(id: number, companyId: number): Promise<Advance | null> {
    return this.items.find((x) => x.id === id && x.companyId === companyId) ?? null;
  }
  async listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<Advance>> {
    return this.items.filter((x) => x.projectId === projectId && x.companyId === companyId);
  }
}

export class InMemoryCashMovementRepository implements CashMovementRepository {
  private items: CashMovement[] = [];
  private seq = 0;
  async insert(input: NewCashMovementInput): Promise<CashMovement> {
    this.seq += 1;
    const m = CashMovement.create({ id: this.seq, ...input, createdAt: FNOW, updatedAt: FNOW });
    this.items.push(m);
    return m;
  }
  async update(m: CashMovement): Promise<void> {
    const i = this.items.findIndex((x) => x.id === m.id && x.companyId === m.companyId);
    if (i >= 0) this.items[i] = m;
  }
  async delete(id: number, companyId: number): Promise<boolean> {
    const before = this.items.length;
    this.items = this.items.filter((x) => !(x.id === id && x.companyId === companyId));
    return this.items.length < before;
  }
  async findById(id: number, companyId: number): Promise<CashMovement | null> {
    return this.items.find((x) => x.id === id && x.companyId === companyId) ?? null;
  }
  async listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<CashMovement>> {
    return this.items.filter((x) => x.projectId === projectId && x.companyId === companyId);
  }
}

export class InMemoryMaterialRepository implements MaterialRepository {
  private items: Material[] = [];
  private seq = 0;
  async insert(input: NewMaterialInput): Promise<Material> {
    this.seq += 1;
    const m = Material.create({
      id: this.seq,
      ...input,
      active: true,
      createdAt: FNOW,
      updatedAt: FNOW,
    });
    this.items.push(m);
    return m;
  }
  async update(m: Material): Promise<void> {
    const i = this.items.findIndex((x) => x.id === m.id && x.companyId === m.companyId);
    if (i >= 0) this.items[i] = m;
  }
  async findById(id: number, companyId: number): Promise<Material | null> {
    return this.items.find((x) => x.id === id && x.companyId === companyId) ?? null;
  }
  async listByCompany(
    companyId: number,
    includeInactive?: boolean,
  ): Promise<ReadonlyArray<Material>> {
    return this.items.filter(
      (x) => x.companyId === companyId && (includeInactive === true || x.active),
    );
  }
  async existsByCode(companyId: number, code: string): Promise<boolean> {
    return this.items.some((x) => x.companyId === companyId && x.code === code);
  }
}

export class InMemoryWarehouseRepository implements WarehouseRepository {
  private items: Warehouse[] = [];
  private seq = 0;
  async insert(input: NewWarehouseInput): Promise<Warehouse> {
    this.seq += 1;
    const w = Warehouse.create({
      id: this.seq,
      ...input,
      active: true,
      createdAt: FNOW,
      updatedAt: FNOW,
    });
    this.items.push(w);
    return w;
  }
  async update(w: Warehouse): Promise<void> {
    const i = this.items.findIndex((x) => x.id === w.id && x.companyId === w.companyId);
    if (i >= 0) this.items[i] = w;
  }
  async findById(id: number, companyId: number): Promise<Warehouse | null> {
    return this.items.find((x) => x.id === id && x.companyId === companyId) ?? null;
  }
  async listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<Warehouse>> {
    return this.items.filter((x) => x.projectId === projectId && x.companyId === companyId);
  }
  async existsByCode(companyId: number, code: string): Promise<boolean> {
    return this.items.some((x) => x.companyId === companyId && x.code === code);
  }
}

export class InMemoryStockRepository implements StockRepository {
  private movements: StockMovement[] = [];
  private stock = new Map<string, number>(); // `${wh}:${mat}` → qty
  private seq = 0;
  constructor(private readonly warehouses: InMemoryWarehouseRepository) {}

  private key(wh: number, mat: number): string {
    return `${String(wh)}:${String(mat)}`;
  }
  private delta(wh: number, mat: number, d: number): void {
    this.stock.set(this.key(wh, mat), (this.stock.get(this.key(wh, mat)) ?? 0) + d);
  }

  async recordMovement(input: NewStockMovementInput): Promise<StockMovement> {
    this.seq += 1;
    const m = StockMovement.create({ id: this.seq, ...input, createdAt: FNOW });
    this.movements.push(m);
    const incTo = input.kind === 'in' || input.kind === 'adjust' || input.kind === 'transfer';
    const decFrom = input.kind === 'out' || input.kind === 'waste' || input.kind === 'transfer';
    if (decFrom && input.fromWarehouse !== null)
      this.delta(input.fromWarehouse, input.materialId, -input.qty);
    if (incTo && input.toWarehouse !== null)
      this.delta(input.toWarehouse, input.materialId, input.qty);
    return m;
  }

  async listStockByProject(
    projectId: number,
    companyId: number,
  ): Promise<ReadonlyArray<StockView>> {
    const whs = await this.warehouses.listByProject(projectId, companyId);
    const out: StockView[] = [];
    for (const [key, qty] of this.stock) {
      const [whStr, matStr] = key.split(':');
      const whId = Number(whStr);
      if (!whs.some((w) => w.id === whId)) continue;
      out.push({
        warehouseId: whId,
        warehouseName: whs.find((w) => w.id === whId)?.name ?? '',
        materialId: Number(matStr),
        materialCode: '',
        materialName: '',
        unit: 'ad',
        qty,
      });
    }
    return out;
  }

  async listMovementsByProject(): Promise<ReadonlyArray<StockMovement>> {
    return this.movements;
  }
}

export class InMemoryMaterialRequestRepository implements MaterialRequestRepository {
  private headers = new Map<number, Omit<MaterialRequestProps, 'lines'>>();
  private linesByReq = new Map<number, MaterialRequestProps['lines'][number][]>();
  private seq = 0;
  private lineSeq = 0;

  private build(id: number): MaterialRequest {
    const h = this.headers.get(id)!;
    return MaterialRequest.create({
      ...h,
      lines: (this.linesByReq.get(id) ?? []).map((l) => ({ ...l })),
    });
  }
  private setLines(id: number, lines: ReadonlyArray<NewMaterialRequestLineInput>): void {
    this.linesByReq.set(
      id,
      lines.map((l) => {
        this.lineSeq += 1;
        return { id: this.lineSeq, materialId: l.materialId, qty: l.qty, note: l.note };
      }),
    );
  }

  async insert(input: NewMaterialRequestInput): Promise<MaterialRequest> {
    this.seq += 1;
    const id = this.seq;
    this.headers.set(id, {
      id,
      companyId: input.companyId,
      projectId: input.projectId,
      reqNo: input.reqNo,
      status: 'draft',
      neededBy: input.neededBy,
      note: input.note,
      requestedBy: input.requestedBy,
      approvedBy: null,
      createdAt: FNOW,
      updatedAt: FNOW,
    });
    this.setLines(id, input.lines);
    return this.build(id);
  }
  async findById(id: number, companyId: number): Promise<MaterialRequest | null> {
    const h = this.headers.get(id);
    if (!h || h.companyId !== companyId) return null;
    return this.build(id);
  }
  async listByProject(
    projectId: number,
    companyId: number,
  ): Promise<ReadonlyArray<MaterialRequest>> {
    const out: MaterialRequest[] = [];
    for (const [id, h] of this.headers) {
      if (h.projectId === projectId && h.companyId === companyId) out.push(this.build(id));
    }
    return out;
  }
  async countByProject(projectId: number, companyId: number): Promise<number> {
    let n = 0;
    for (const h of this.headers.values()) {
      if (h.projectId === projectId && h.companyId === companyId) n += 1;
    }
    return n;
  }
  async replaceLines(
    id: number,
    companyId: number,
    lines: ReadonlyArray<NewMaterialRequestLineInput>,
  ): Promise<MaterialRequest> {
    const h = this.headers.get(id);
    if (!h || h.companyId !== companyId) throw new Error('not found');
    this.setLines(id, lines);
    return this.build(id);
  }
  async changeStatus(
    id: number,
    companyId: number,
    change: MreqStatusChange,
  ): Promise<MaterialRequest> {
    const h = this.headers.get(id);
    if (!h || h.companyId !== companyId) throw new Error('not found');
    h.status = change.toStatus;
    h.approvedBy = change.approvedBy;
    return this.build(id);
  }
}

export class InMemoryPersonnelRepository implements PersonnelRepository {
  private items: Personnel[] = [];
  private seq = 0;
  async insert(input: NewPersonnelInput): Promise<Personnel> {
    this.seq += 1;
    const p = Personnel.create({
      id: this.seq,
      ...input,
      active: true,
      createdAt: FNOW,
      updatedAt: FNOW,
    });
    this.items.push(p);
    return p;
  }
  async update(p: Personnel): Promise<void> {
    const i = this.items.findIndex((x) => x.id === p.id && x.companyId === p.companyId);
    if (i >= 0) this.items[i] = p;
  }
  async findById(id: number, companyId: number): Promise<Personnel | null> {
    return this.items.find((x) => x.id === id && x.companyId === companyId) ?? null;
  }
  async listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<Personnel>> {
    return this.items.filter((x) => x.projectId === projectId && x.companyId === companyId);
  }
}

export class InMemoryTimesheetRepository implements TimesheetRepository {
  private items: Timesheet[] = [];
  private seq = 0;
  async upsert(input: NewTimesheetInput): Promise<Timesheet> {
    const idx = this.items.findIndex(
      (x) => x.personnelId === input.personnelId && x.workDate === input.workDate,
    );
    const id = idx >= 0 ? this.items[idx]!.id : ((this.seq += 1), this.seq);
    const ts = Timesheet.create({ id, ...input, createdAt: FNOW, updatedAt: FNOW });
    if (idx >= 0) this.items[idx] = ts;
    else this.items.push(ts);
    return ts;
  }
  async delete(id: number, companyId: number): Promise<boolean> {
    const before = this.items.length;
    this.items = this.items.filter((x) => !(x.id === id && x.companyId === companyId));
    return this.items.length < before;
  }
  async listByProject(): Promise<ReadonlyArray<Timesheet>> {
    return this.items;
  }
}

export class InMemoryMachineRepository implements MachineRepository {
  private items: Machine[] = [];
  private seq = 0;
  async insert(input: NewMachineInput): Promise<Machine> {
    this.seq += 1;
    const m = Machine.create({
      id: this.seq,
      ...input,
      active: true,
      createdAt: FNOW,
      updatedAt: FNOW,
    });
    this.items.push(m);
    return m;
  }
  async update(m: Machine): Promise<void> {
    const i = this.items.findIndex((x) => x.id === m.id && x.companyId === m.companyId);
    if (i >= 0) this.items[i] = m;
  }
  async findById(id: number, companyId: number): Promise<Machine | null> {
    return this.items.find((x) => x.id === id && x.companyId === companyId) ?? null;
  }
  async listByCompany(
    companyId: number,
    includeInactive?: boolean,
  ): Promise<ReadonlyArray<Machine>> {
    return this.items.filter(
      (x) => x.companyId === companyId && (includeInactive === true || x.active),
    );
  }
  async existsByCode(companyId: number, code: string): Promise<boolean> {
    return this.items.some((x) => x.companyId === companyId && x.code === code);
  }
}

export class InMemoryMachineLogRepository implements MachineLogRepository {
  private items: MachineLog[] = [];
  private seq = 0;
  async insert(input: NewMachineLogInput): Promise<MachineLog> {
    this.seq += 1;
    const l = MachineLog.create({ id: this.seq, ...input, createdAt: FNOW });
    this.items.push(l);
    return l;
  }
  async delete(id: number, companyId: number): Promise<boolean> {
    const before = this.items.length;
    this.items = this.items.filter((x) => !(x.id === id && x.companyId === companyId));
    return this.items.length < before;
  }
  async listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<MachineLog>> {
    return this.items.filter((x) => x.projectId === projectId && x.companyId === companyId);
  }
}
