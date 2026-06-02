/**
 * In-memory test doubles for HR module repositories + ports.
 *
 * Hepsi gerçek repository sözleşmelerini honor eder — DB davranışını
 * (UNIQUE constraint, izolasyon, vb.) JS Map/Array ile taklit eder.
 *
 * Test'lerde kullanım:
 *   const ctx = makeFakeHrContext();
 *   const useCase = new CreateOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
 */
import type {
  ApplicationRepository,
  NewApplicationInput,
} from '../../application/ports/ApplicationRepository.js';
import type {
  ApplicationStageHistoryEntry,
  ApplicationStageHistoryRepository,
  NewApplicationStageHistoryInput,
} from '../../application/ports/ApplicationStageHistoryRepository.js';
import type { AuditEntry, AuditLogger } from '../../application/ports/AuditLogger.js';
import type {
  CandidateRepository,
  NewCandidateInput,
} from '../../application/ports/CandidateRepository.js';
import type { Clock } from '../../application/ports/Clock.js';
import type {
  DepartmentRepository,
  NewDepartmentInput,
} from '../../application/ports/DepartmentRepository.js';
import type {
  EmployeeRepository,
  NewEmployeeInput,
} from '../../application/ports/EmployeeRepository.js';
import type {
  NewOrgUnitInput,
  OrgUnitRepository,
} from '../../application/ports/OrgUnitRepository.js';
import type {
  NewPositionInput,
  PositionRepository,
} from '../../application/ports/PositionRepository.js';
import type {
  HrTransactionalRepositories,
  UnitOfWork,
} from '../../application/ports/UnitOfWork.js';
import type { HrUserSummary, UserLookupPort } from '../../application/ports/UserLookupPort.js';
import { Application } from '../../domain/entities/Application.js';
import { Candidate } from '../../domain/entities/Candidate.js';
import { Department } from '../../domain/entities/Department.js';
import { Employee } from '../../domain/entities/Employee.js';
import { OrgUnit } from '../../domain/entities/OrgUnit.js';
import { Position } from '../../domain/entities/Position.js';
import { DepartmentCode } from '../../domain/valueObjects/DepartmentCode.js';
import { EmployeeNumber } from '../../domain/valueObjects/EmployeeNumber.js';
import { HireDate } from '../../domain/valueObjects/HireDate.js';
import { OrgUnitCode } from '../../domain/valueObjects/OrgUnitCode.js';
import { PhoneNumber } from '../../domain/valueObjects/PhoneNumber.js';
import type { RecruitmentStage } from '../../domain/valueObjects/RecruitmentStage.js';
import { isTerminalStage } from '../../domain/valueObjects/RecruitmentStage.js';
import { TcKimlik } from '../../domain/valueObjects/TcKimlik.js';

// ============================================================================
// Clock — Date'leri test'in kontrolünde tut
// ============================================================================
export class FakeClock implements Clock {
  constructor(public current: Date = new Date('2026-05-21T09:00:00Z')) {}

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  set(date: Date): void {
    this.current = new Date(date);
  }
}

// ============================================================================
// AuditLogger — yapılan tüm log'ları RAM'de tut, test assert edebilsin
// ============================================================================
export class RecordingAuditLogger implements AuditLogger {
  public readonly entries: AuditEntry[] = [];

  async log(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }

  findByAction(action: string): AuditEntry[] {
    return this.entries.filter((e) => e.action === action);
  }

  clear(): void {
    this.entries.length = 0;
  }
}

// ============================================================================
// OrgUnitRepository fake
// ============================================================================
export class InMemoryOrgUnitRepository implements OrgUnitRepository {
  private readonly store = new Map<number, OrgUnit>();
  private nextId = 1;

  constructor(private readonly clock: Clock) {}

  async insert(input: NewOrgUnitInput): Promise<OrgUnit> {
    const id = this.nextId++;
    const now = this.clock.now();
    const unit = OrgUnit.create({
      id,
      companyId: input.companyId,
      parentId: input.parentId,
      name: input.name,
      code: input.code ? OrgUnitCode.create(input.code) : null,
      sortOrder: input.sortOrder,
      active: input.active,
      createdAt: now,
      updatedAt: now,
    });
    this.store.set(id, unit);
    return Promise.resolve(unit);
  }

  async update(unit: OrgUnit): Promise<void> {
    if (!this.store.has(unit.id)) {
      throw new Error(`InMemoryOrgUnitRepository: id=${unit.id} bulunamadı`);
    }
    this.store.set(unit.id, unit);
  }

  async findById(id: number, companyId: number): Promise<OrgUnit | null> {
    const u = this.store.get(id);
    if (!u || u.companyId !== companyId) return null;
    return u;
  }

  async listByCompany(
    companyId: number,
    options?: { includeInactive?: boolean },
  ): Promise<ReadonlyArray<OrgUnit>> {
    const includeInactive = options?.includeInactive ?? false;
    return [...this.store.values()].filter(
      (u) => u.companyId === companyId && (includeInactive || u.active),
    );
  }

  async hasChildren(unitId: number, companyId: number): Promise<boolean> {
    for (const u of this.store.values()) {
      if (u.companyId === companyId && u.parentId === unitId) return true;
    }
    return false;
  }

  /** Test yardımcısı — direkt instance ekleme (insert by-passing factory). */
  seed(unit: OrgUnit): void {
    this.store.set(unit.id, unit);
    if (unit.id >= this.nextId) this.nextId = unit.id + 1;
  }

  /** UoW snapshot/restore — fakes'in mevcut state'ini kopyalar. */
  __snapshot(): { store: Map<number, OrgUnit>; nextId: number } {
    return { store: new Map(this.store), nextId: this.nextId };
  }
  __restore(snap: { store: Map<number, OrgUnit>; nextId: number }): void {
    this.store.clear();
    for (const [k, v] of snap.store) this.store.set(k, v);
    this.nextId = snap.nextId;
  }
}

// ============================================================================
// DepartmentRepository fake
// ============================================================================
export class InMemoryDepartmentRepository implements DepartmentRepository {
  private readonly store = new Map<number, Department>();
  private nextId = 1;

  constructor(
    private readonly clock: Clock,
    /** İsteğe bağlı — employees repo verilirse aktif çalışan sayısı buradan okunur. */
    private readonly employees?: InMemoryEmployeeRepository,
  ) {}

  async insert(input: NewDepartmentInput): Promise<Department> {
    const id = this.nextId++;
    const now = this.clock.now();
    const dept = Department.create({
      id,
      companyId: input.companyId,
      orgUnitId: input.orgUnitId,
      name: input.name,
      code: input.code ? DepartmentCode.create(input.code) : null,
      managerEmployeeId: input.managerEmployeeId,
      active: input.active,
      createdAt: now,
      updatedAt: now,
    });
    this.store.set(id, dept);
    return Promise.resolve(dept);
  }

  async update(department: Department): Promise<void> {
    if (!this.store.has(department.id)) {
      throw new Error(`InMemoryDepartmentRepository: id=${department.id} bulunamadı`);
    }
    this.store.set(department.id, department);
  }

  async findById(id: number, companyId: number): Promise<Department | null> {
    const d = this.store.get(id);
    if (!d || d.companyId !== companyId) return null;
    return d;
  }

  async listByCompany(
    companyId: number,
    options?: { includeInactive?: boolean; orgUnitId?: number | null },
  ): Promise<ReadonlyArray<Department>> {
    const includeInactive = options?.includeInactive ?? false;
    return [...this.store.values()].filter((d) => {
      if (d.companyId !== companyId) return false;
      if (!includeInactive && !d.active) return false;
      if (options?.orgUnitId !== undefined && d.orgUnitId !== options.orgUnitId) {
        return false;
      }
      return true;
    });
  }

  async hasActiveEmployees(departmentId: number, companyId: number): Promise<boolean> {
    if (!this.employees) return false;
    const count = await this.employees.countActiveByDepartment(departmentId, companyId);
    return count > 0;
  }

  seed(dept: Department): void {
    this.store.set(dept.id, dept);
    if (dept.id >= this.nextId) this.nextId = dept.id + 1;
  }

  __snapshot(): { store: Map<number, Department>; nextId: number } {
    return { store: new Map(this.store), nextId: this.nextId };
  }
  __restore(snap: { store: Map<number, Department>; nextId: number }): void {
    this.store.clear();
    for (const [k, v] of snap.store) this.store.set(k, v);
    this.nextId = snap.nextId;
  }
}

// ============================================================================
// PositionRepository fake
// ============================================================================
export class InMemoryPositionRepository implements PositionRepository {
  private readonly store = new Map<number, Position>();
  private nextId = 1;

  constructor(
    private readonly clock: Clock,
    private readonly employees?: InMemoryEmployeeRepository,
  ) {}

  async insert(input: NewPositionInput): Promise<Position> {
    const id = this.nextId++;
    const now = this.clock.now();
    const p = Position.create({
      id,
      companyId: input.companyId,
      departmentId: input.departmentId,
      title: input.title,
      description: input.description,
      status: input.status,
      headcountTarget: input.headcountTarget,
      minSalary: input.minSalary,
      maxSalary: input.maxSalary,
      createdAt: now,
      updatedAt: now,
    });
    this.store.set(id, p);
    return Promise.resolve(p);
  }

  async update(position: Position): Promise<void> {
    if (!this.store.has(position.id)) {
      throw new Error(`InMemoryPositionRepository: id=${position.id} bulunamadı`);
    }
    this.store.set(position.id, position);
  }

  async findById(id: number, companyId: number): Promise<Position | null> {
    const p = this.store.get(id);
    if (!p || p.companyId !== companyId) return null;
    return p;
  }

  async listByCompany(
    companyId: number,
    options?: {
      status?: 'draft' | 'open' | 'closed';
      departmentId?: number | null;
    },
  ): Promise<ReadonlyArray<Position>> {
    return [...this.store.values()].filter((p) => {
      if (p.companyId !== companyId) return false;
      if (options?.status !== undefined && p.status !== options.status) return false;
      if (options?.departmentId !== undefined && p.departmentId !== options.departmentId) {
        return false;
      }
      return true;
    });
  }

  async hasActiveEmployees(positionId: number, companyId: number): Promise<boolean> {
    if (!this.employees) return false;
    const count = await this.employees.countActiveByPosition(positionId, companyId);
    return count > 0;
  }

  seed(p: Position): void {
    this.store.set(p.id, p);
    if (p.id >= this.nextId) this.nextId = p.id + 1;
  }

  __snapshot(): { store: Map<number, Position>; nextId: number } {
    return { store: new Map(this.store), nextId: this.nextId };
  }
  __restore(snap: { store: Map<number, Position>; nextId: number }): void {
    this.store.clear();
    for (const [k, v] of snap.store) this.store.set(k, v);
    this.nextId = snap.nextId;
  }
}

// ============================================================================
// EmployeeRepository fake
// ============================================================================
export class InMemoryEmployeeRepository implements EmployeeRepository {
  private readonly store = new Map<number, Employee>();
  private nextId = 1;

  constructor(private readonly clock: Clock) {}

  async insert(input: NewEmployeeInput): Promise<Employee> {
    // UNIQUE constraint taklidi: aynı (companyId, employeeNo) ikinci sefer fırlatır
    for (const e of this.store.values()) {
      if (e.companyId === input.companyId && e.employeeNo.value === input.employeeNo) {
        const err = new Error(
          `duplicate key value violates unique constraint "uq_employees_company_employee_no"`,
        );
        // PG benzeri davranış için kod ata
        (err as Error & { code?: string }).code = '23505';
        throw err;
      }
      if (input.userId !== null && e.companyId === input.companyId && e.userId === input.userId) {
        const err = new Error(`duplicate key value violates unique constraint "uq_employees_user"`);
        (err as Error & { code?: string }).code = '23505';
        throw err;
      }
    }

    const id = this.nextId++;
    const now = this.clock.now();
    const employeeNo = EmployeeNumber.create(input.employeeNo);
    const hireDate = HireDate.create(new Date(input.hireDate), now);

    const employee = Employee.create({
      id,
      companyId: input.companyId,
      userId: input.userId,
      departmentId: input.departmentId,
      positionId: input.positionId,
      employeeNo,
      firstName: input.firstName,
      lastName: input.lastName,
      tcKimlik: input.tcKimlik ? TcKimlik.create(input.tcKimlik) : null,
      email: input.email,
      phone: input.phone ? PhoneNumber.create(input.phone) : null,
      hireDate,
      terminationDate: null,
      status: input.status,
      employmentType: input.employmentType,
      sourceApplicationId: input.sourceApplicationId,
      createdAt: now,
      updatedAt: now,
    });
    this.store.set(id, employee);
    return employee;
  }

  async update(employee: Employee): Promise<void> {
    if (!this.store.has(employee.id)) {
      throw new Error(`InMemoryEmployeeRepository: id=${employee.id} bulunamadı`);
    }
    // user_id UNIQUE constraint kontrolü (own row hariç)
    if (employee.userId !== null) {
      for (const e of this.store.values()) {
        if (
          e.id !== employee.id &&
          e.companyId === employee.companyId &&
          e.userId === employee.userId
        ) {
          const err = new Error(
            `duplicate key value violates unique constraint "uq_employees_user"`,
          );
          (err as Error & { code?: string }).code = '23505';
          throw err;
        }
      }
    }
    this.store.set(employee.id, employee);
  }

  async findById(id: number, companyId: number): Promise<Employee | null> {
    const e = this.store.get(id);
    if (!e || e.companyId !== companyId) return null;
    return e;
  }

  async findByEmployeeNo(employeeNo: string, companyId: number): Promise<Employee | null> {
    for (const e of this.store.values()) {
      if (e.companyId === companyId && e.employeeNo.value === employeeNo) return e;
    }
    return null;
  }

  async findByUserId(userId: number, companyId: number): Promise<Employee | null> {
    for (const e of this.store.values()) {
      if (e.companyId === companyId && e.userId === userId) return e;
    }
    return null;
  }

  async listByCompany(
    companyId: number,
    options?: {
      status?: 'probation' | 'active' | 'on_leave' | 'terminated';
      departmentId?: number;
      positionId?: number;
      q?: string;
    },
  ): Promise<ReadonlyArray<Employee>> {
    const q = options?.q?.toLowerCase();
    return [...this.store.values()].filter((e) => {
      if (e.companyId !== companyId) return false;
      if (options?.status !== undefined && e.status !== options.status) return false;
      if (options?.departmentId !== undefined && e.departmentId !== options.departmentId) {
        return false;
      }
      if (options?.positionId !== undefined && e.positionId !== options.positionId) {
        return false;
      }
      if (q) {
        const hay = `${e.firstName} ${e.lastName} ${e.employeeNo.value}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  async countActiveByDepartment(departmentId: number, companyId: number): Promise<number> {
    let n = 0;
    for (const e of this.store.values()) {
      if (
        e.companyId === companyId &&
        e.departmentId === departmentId &&
        e.status !== 'terminated'
      ) {
        n += 1;
      }
    }
    return n;
  }

  async countActiveByPosition(positionId: number, companyId: number): Promise<number> {
    let n = 0;
    for (const e of this.store.values()) {
      if (e.companyId === companyId && e.positionId === positionId && e.status !== 'terminated') {
        n += 1;
      }
    }
    return n;
  }

  seed(e: Employee): void {
    this.store.set(e.id, e);
    if (e.id >= this.nextId) this.nextId = e.id + 1;
  }

  __snapshot(): { store: Map<number, Employee>; nextId: number } {
    return { store: new Map(this.store), nextId: this.nextId };
  }
  __restore(snap: { store: Map<number, Employee>; nextId: number }): void {
    this.store.clear();
    for (const [k, v] of snap.store) this.store.set(k, v);
    this.nextId = snap.nextId;
  }
}

// ============================================================================
// UserLookupPort fake — Auth modülünden gelen veri taklidi
// ============================================================================
export class InMemoryUserLookup implements UserLookupPort {
  private readonly users = new Map<number, HrUserSummary>();

  async findById(userId: number): Promise<HrUserSummary | null> {
    return this.users.get(userId) ?? null;
  }

  /** Test yardımcısı — kullanıcı ekle. */
  seed(user: HrUserSummary): void {
    this.users.set(user.id, user);
  }
}

// ============================================================================
// UnitOfWork fake — production semantiğini in-memory'de taklit eder
// ============================================================================
/**
 * InMemoryUnitOfWork — `UnitOfWork` portu için fake implementasyon.
 *
 * `withTransaction(fn)` her in-memory fake'in mevcut state'inin snapshot'ını
 * alır, `fn`'i çalıştırır. `fn` throw ederse snapshot'lar geri yüklenir
 * (rollback semantiği). Normal dönerse snapshot bırakılır (commit).
 *
 * Mevcut fake instance'ların referansını sarsın — yani `fn` içindeki
 * `repos.X` ile `ctx.X` aynı fake'i gösterir. Bu, tüm okumaların ister
 * uow içinden ister dışından yapılsın aynı veriyi görmesini sağlar.
 */
export class InMemoryUnitOfWork implements UnitOfWork {
  constructor(
    private readonly orgUnits: InMemoryOrgUnitRepository,
    private readonly departments: InMemoryDepartmentRepository,
    private readonly positions: InMemoryPositionRepository,
    private readonly employees: InMemoryEmployeeRepository,
    private readonly candidates: InMemoryCandidateRepository,
    private readonly applications: InMemoryApplicationRepository,
    private readonly applicationHistory: InMemoryApplicationStageHistoryRepository,
  ) {}

  async withTransaction<T>(fn: (repos: HrTransactionalRepositories) => Promise<T>): Promise<T> {
    const snap = {
      orgUnits: this.orgUnits.__snapshot(),
      departments: this.departments.__snapshot(),
      positions: this.positions.__snapshot(),
      employees: this.employees.__snapshot(),
      candidates: this.candidates.__snapshot(),
      applications: this.applications.__snapshot(),
      applicationHistory: this.applicationHistory.__snapshot(),
    };
    const repos: HrTransactionalRepositories = {
      orgUnits: this.orgUnits,
      departments: this.departments,
      positions: this.positions,
      employees: this.employees,
      candidates: this.candidates,
      applications: this.applications,
      applicationHistory: this.applicationHistory,
    };
    try {
      return await fn(repos);
    } catch (err) {
      this.orgUnits.__restore(snap.orgUnits);
      this.departments.__restore(snap.departments);
      this.positions.__restore(snap.positions);
      this.employees.__restore(snap.employees);
      this.candidates.__restore(snap.candidates);
      this.applications.__restore(snap.applications);
      this.applicationHistory.__restore(snap.applicationHistory);
      throw err;
    }
  }
}

// ============================================================================
// Yardımcı: hızlı bir HR test context'i kur
// ============================================================================
export interface FakeHrContext {
  clock: FakeClock;
  audit: RecordingAuditLogger;
  orgUnits: InMemoryOrgUnitRepository;
  departments: InMemoryDepartmentRepository;
  positions: InMemoryPositionRepository;
  employees: InMemoryEmployeeRepository;
  candidates: InMemoryCandidateRepository;
  applications: InMemoryApplicationRepository;
  stageHistory: InMemoryApplicationStageHistoryRepository;
  users: InMemoryUserLookup;
  uow: InMemoryUnitOfWork;
}

export function makeFakeHrContext(now?: Date): FakeHrContext {
  const clock = new FakeClock(now);
  const audit = new RecordingAuditLogger();
  const employees = new InMemoryEmployeeRepository(clock);
  const orgUnits = new InMemoryOrgUnitRepository(clock);
  const departments = new InMemoryDepartmentRepository(clock, employees);
  const positions = new InMemoryPositionRepository(clock, employees);
  const candidates = new InMemoryCandidateRepository(clock);
  const stageHistory = new InMemoryApplicationStageHistoryRepository();
  const applications = new InMemoryApplicationRepository(clock, stageHistory);
  const users = new InMemoryUserLookup();
  const uow = new InMemoryUnitOfWork(
    orgUnits,
    departments,
    positions,
    employees,
    candidates,
    applications,
    stageHistory,
  );
  return {
    clock,
    audit,
    orgUnits,
    departments,
    positions,
    employees,
    candidates,
    applications,
    stageHistory,
    users,
    uow,
  };
}

// ============================================================================
// CandidateRepository fake
// ============================================================================
export class InMemoryCandidateRepository implements CandidateRepository {
  private readonly store = new Map<number, Candidate>();
  private nextId = 1;

  constructor(private readonly clock: Clock) {}

  async insert(input: NewCandidateInput): Promise<Candidate> {
    const id = this.nextId++;
    const now = this.clock.now();
    const c = Candidate.create({
      id,
      companyId: input.companyId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone ? PhoneNumber.create(input.phone) : null,
      source: input.source,
      cvUrl: input.cvUrl,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    });
    this.store.set(id, c);
    return Promise.resolve(c);
  }

  async update(candidate: Candidate): Promise<void> {
    if (!this.store.has(candidate.id)) {
      throw new Error(`InMemoryCandidateRepository: id=${candidate.id} bulunamadı`);
    }
    this.store.set(candidate.id, candidate);
    return Promise.resolve();
  }

  async findById(id: number, companyId: number): Promise<Candidate | null> {
    const c = this.store.get(id);
    return Promise.resolve(c && c.companyId === companyId ? c : null);
  }

  async listByCompany(
    companyId: number,
    options?: {
      source?: 'referral' | 'linkedin' | 'jobboard' | 'direct' | 'agency' | 'other';
      q?: string;
    },
  ): Promise<ReadonlyArray<Candidate>> {
    const q = options?.q?.toLowerCase();
    return Promise.resolve(
      [...this.store.values()].filter((c) => {
        if (c.companyId !== companyId) return false;
        if (options?.source !== undefined && c.source !== options.source) return false;
        if (q) {
          const hay = `${c.firstName} ${c.lastName} ${c.email ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    );
  }

  async remove(id: number, companyId: number): Promise<void> {
    const c = this.store.get(id);
    if (c && c.companyId === companyId) {
      this.store.delete(id);
    }
    return Promise.resolve();
  }

  seed(c: Candidate): void {
    this.store.set(c.id, c);
    if (c.id >= this.nextId) this.nextId = c.id + 1;
  }

  __snapshot(): { store: Map<number, Candidate>; nextId: number } {
    return { store: new Map(this.store), nextId: this.nextId };
  }
  __restore(snap: { store: Map<number, Candidate>; nextId: number }): void {
    this.store.clear();
    for (const [k, v] of snap.store) this.store.set(k, v);
    this.nextId = snap.nextId;
  }
}

// ============================================================================
// ApplicationStageHistoryRepository fake
// ============================================================================
export class InMemoryApplicationStageHistoryRepository implements ApplicationStageHistoryRepository {
  private readonly entries: ApplicationStageHistoryEntry[] = [];
  private nextId = 1;

  async findByApplication(
    applicationId: number,
  ): Promise<ReadonlyArray<ApplicationStageHistoryEntry>> {
    return Promise.resolve(
      this.entries
        .filter((e) => e.applicationId === applicationId)
        .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime()),
    );
  }

  async record(input: NewApplicationStageHistoryInput): Promise<ApplicationStageHistoryEntry> {
    const entry: ApplicationStageHistoryEntry = {
      id: this.nextId++,
      applicationId: input.applicationId,
      fromStage: input.fromStage,
      toStage: input.toStage,
      changedBy: input.changedBy,
      changedAt: input.changedAt,
      note: input.note,
    };
    this.entries.push(entry);
    return Promise.resolve(entry);
  }

  __snapshot(): { entries: ApplicationStageHistoryEntry[]; nextId: number } {
    return { entries: [...this.entries], nextId: this.nextId };
  }
  __restore(snap: { entries: ApplicationStageHistoryEntry[]; nextId: number }): void {
    this.entries.length = 0;
    for (const e of snap.entries) this.entries.push(e);
    this.nextId = snap.nextId;
  }
}

// ============================================================================
// ApplicationRepository fake
// ============================================================================
export class InMemoryApplicationRepository implements ApplicationRepository {
  private readonly store = new Map<number, Application>();
  private nextId = 1;

  constructor(
    private readonly clock: Clock,
    private readonly stageHistory: InMemoryApplicationStageHistoryRepository,
  ) {}

  async insert(input: NewApplicationInput): Promise<Application> {
    // Partial unique constraint taklidi:
    //   bir (companyId, candidateId, positionId) kombinasyonu için aktif (terminal
    //   olmayan) bir kayıt zaten varsa hata fırlat.
    for (const a of this.store.values()) {
      if (
        a.companyId === input.companyId &&
        a.candidateId === input.candidateId &&
        a.positionId === input.positionId &&
        !isTerminalStage(a.stage)
      ) {
        const err = new Error(
          'duplicate key value violates unique constraint "uq_applications_active_unique"',
        );
        (err as Error & { code?: string }).code = '23505';
        throw err;
      }
    }

    const id = this.nextId++;
    const now = this.clock.now();
    const app = Application.create({
      id,
      companyId: input.companyId,
      candidateId: input.candidateId,
      positionId: input.positionId,
      stage: input.stage,
      stageChangedAt: now,
      stageChangedBy: input.stageChangedBy,
      rejectionReason: input.rejectionReason,
      salaryExpectation: input.salaryExpectation,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    });
    this.store.set(id, app);
    // Trigger taklidi: INSERT'te history kaydı
    await this.stageHistory.record({
      applicationId: id,
      fromStage: null,
      toStage: input.stage,
      changedBy: input.stageChangedBy,
      changedAt: now,
      note: null,
    });
    return app;
  }

  async update(application: Application): Promise<void> {
    const existing = this.store.get(application.id);
    if (!existing) {
      throw new Error(`InMemoryApplicationRepository: id=${application.id} bulunamadı`);
    }
    // Trigger taklidi: stage değişimi varsa history kaydı
    if (existing.stage !== application.stage) {
      await this.stageHistory.record({
        applicationId: application.id,
        fromStage: existing.stage,
        toStage: application.stage,
        changedBy: application.stageChangedBy,
        changedAt: application.stageChangedAt,
        note: null,
      });
    }
    this.store.set(application.id, application);
  }

  async findById(id: number, companyId: number): Promise<Application | null> {
    const a = this.store.get(id);
    return Promise.resolve(a && a.companyId === companyId ? a : null);
  }

  async listByCompany(
    companyId: number,
    options?: { positionId?: number; candidateId?: number; stage?: RecruitmentStage },
  ): Promise<ReadonlyArray<Application>> {
    return Promise.resolve(
      [...this.store.values()].filter((a) => {
        if (a.companyId !== companyId) return false;
        if (options?.positionId !== undefined && a.positionId !== options.positionId) return false;
        if (options?.candidateId !== undefined && a.candidateId !== options.candidateId)
          return false;
        if (options?.stage !== undefined && a.stage !== options.stage) return false;
        return true;
      }),
    );
  }

  async countByStage(
    companyId: number,
    options?: { positionId?: number },
  ): Promise<ReadonlyMap<RecruitmentStage, number>> {
    const counts = new Map<RecruitmentStage, number>();
    for (const a of this.store.values()) {
      if (a.companyId !== companyId) continue;
      if (options?.positionId !== undefined && a.positionId !== options.positionId) continue;
      counts.set(a.stage, (counts.get(a.stage) ?? 0) + 1);
    }
    return Promise.resolve(counts);
  }

  async hasActiveApplicationsForCandidate(
    candidateId: number,
    companyId: number,
  ): Promise<boolean> {
    for (const a of this.store.values()) {
      if (a.companyId === companyId && a.candidateId === candidateId && !isTerminalStage(a.stage)) {
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }

  seed(a: Application): void {
    this.store.set(a.id, a);
    if (a.id >= this.nextId) this.nextId = a.id + 1;
  }

  __snapshot(): { store: Map<number, Application>; nextId: number } {
    return { store: new Map(this.store), nextId: this.nextId };
  }
  __restore(snap: { store: Map<number, Application>; nextId: number }): void {
    this.store.clear();
    for (const [k, v] of snap.store) this.store.set(k, v);
    this.nextId = snap.nextId;
  }
}
