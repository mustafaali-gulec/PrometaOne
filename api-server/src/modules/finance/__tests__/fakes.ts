/**
 * Finance use-case testleri için in-memory fake repository'ler.
 *
 * Production Pg* repository'lerin sözleşmesini taklit eder; PR 6'da
 * testcontainers ile gerçek PG davranışı doğrulanır.
 */
import type {
  BankAccountRepository,
  KasaAccountRepository,
  KasaEntryRepository,
  NewBankAccountInput,
  NewKasaAccountInput,
  TransferRepository,
} from '../application/ports/CashRepositories.js';
import type {
  CategoryRepository,
  NewCategoryInput,
} from '../application/ports/CategoryRepository.js';
import type { CellRepository } from '../application/ports/CellRepository.js';
import type { Clock } from '../application/ports/Clock.js';
import type {
  FinanceTransactionalRepositories,
  FinanceUnitOfWork,
} from '../application/ports/FinanceUnitOfWork.js';
import type {
  InvoicePaymentRepository,
  InvoiceRepository,
} from '../application/ports/InvoiceRepositories.js';
import { BankAccount } from '../domain/entities/BankAccount.js';
import { Category } from '../domain/entities/Category.js';
import type { Cell } from '../domain/entities/Cell.js';
import type { Invoice } from '../domain/entities/Invoice.js';
import type { InvoicePayment } from '../domain/entities/InvoicePayment.js';
import { KasaAccount } from '../domain/entities/KasaAccount.js';
import type { KasaEntry } from '../domain/entities/KasaEntry.js';
import type { Transfer } from '../domain/entities/Transfer.js';
import type { CategorySection } from '../domain/valueObjects/CategorySection.js';
import type { FlowDirection } from '../domain/valueObjects/FlowDirection.js';
import { Money } from '../domain/valueObjects/Money.js';

export class FixedClock implements Clock {
  constructor(private readonly fixed: Date = new Date('2026-01-01T00:00:00Z')) {}
  now(): Date {
    return this.fixed;
  }
}

export class InMemoryCategoryRepository implements CategoryRepository {
  private seq = 0;
  private readonly store = new Map<number, Category>();

  async insert(input: NewCategoryInput): Promise<Category> {
    this.seq += 1;
    const now = new Date('2026-01-01T00:00:00Z');
    const c = Category.create({
      id: this.seq,
      companyId: input.companyId,
      section: input.section,
      name: input.name,
      sortOrder: input.sortOrder,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    this.store.set(c.id, c);
    return c;
  }

  async update(category: Category): Promise<void> {
    this.store.set(category.id, category);
  }

  async findById(id: number, companyId: number): Promise<Category | null> {
    const c = this.store.get(id);
    return c && c.companyId === companyId ? c : null;
  }

  async listByCompany(
    companyId: number,
    options?: { section?: CategorySection; includeArchived?: boolean },
  ): Promise<ReadonlyArray<Category>> {
    return [...this.store.values()].filter(
      (c) =>
        c.companyId === companyId &&
        (options?.section === undefined || c.section === options.section) &&
        (options?.includeArchived === true || c.active),
    );
  }

  async existsByName(
    companyId: number,
    section: CategorySection,
    name: string,
    excludeId?: number,
  ): Promise<boolean> {
    return [...this.store.values()].some(
      (c) =>
        c.companyId === companyId &&
        c.section === section &&
        c.name.toLowerCase() === name.toLowerCase() &&
        c.id !== excludeId,
    );
  }

  /** Test yardımcı — doğrudan kategori enjekte et. */
  _seed(category: Category): void {
    this.store.set(category.id, category);
    this.seq = Math.max(this.seq, category.id);
  }
}

export class InMemoryCellRepository implements CellRepository {
  private seq = 0;
  /** key: company:category:year:month */
  private readonly store = new Map<string, Cell>();

  private key(c: { companyId: number; categoryId: number; fy: number; m: number }): string {
    return `${c.companyId}:${c.categoryId}:${c.fy}:${c.m}`;
  }

  async upsert(cell: Cell): Promise<Cell> {
    const k = this.key({
      companyId: cell.companyId,
      categoryId: cell.categoryId,
      fy: cell.fiscalYear.value,
      m: cell.monthIdx.value,
    });
    const existing = this.store.get(k);
    let persisted = cell;
    if (cell.id === null) {
      if (existing !== undefined && existing.id !== null) {
        // Mevcut hücreyi güncelle — onun id'sini koru.
        persisted = cell.withId(existing.id);
      } else {
        this.seq += 1;
        persisted = cell.withId(this.seq);
      }
    }
    this.store.set(k, persisted);
    return persisted;
  }

  async bulkUpsert(cells: ReadonlyArray<Cell>): Promise<void> {
    for (const c of cells) {
      await this.upsert(c);
    }
  }

  async findByCompanyYear(companyId: number, fiscalYear: number): Promise<ReadonlyArray<Cell>> {
    return [...this.store.values()].filter(
      (c) => c.companyId === companyId && c.fiscalYear.value === fiscalYear,
    );
  }

  async findOne(
    companyId: number,
    categoryId: number,
    fiscalYear: number,
    monthIdx: number,
  ): Promise<Cell | null> {
    return this.store.get(`${companyId}:${categoryId}:${fiscalYear}:${monthIdx}`) ?? null;
  }

  __snapshot(): { store: Map<string, Cell>; seq: number } {
    return { store: new Map(this.store), seq: this.seq };
  }
  __restore(snap: { store: Map<string, Cell>; seq: number }): void {
    this.store.clear();
    for (const [k, v] of snap.store) this.store.set(k, v);
    this.seq = snap.seq;
  }
}

const NOW = new Date('2026-01-01T00:00:00Z');

export class InMemoryBankAccountRepository implements BankAccountRepository {
  private seq = 0;
  private readonly store = new Map<number, BankAccount>();

  async insert(input: NewBankAccountInput): Promise<BankAccount> {
    this.seq += 1;
    const a = BankAccount.create({
      id: this.seq,
      companyId: input.companyId,
      bankId: input.bankId,
      name: input.name,
      iban: input.iban,
      accountNo: input.accountNo,
      currency: input.currency,
      openingBalance: Money.fromMajor(input.openingBalanceMajor, input.currency),
      cashflowCatId: input.cashflowCatId,
      active: true,
      createdAt: NOW,
      updatedAt: NOW,
    });
    this.store.set(a.id, a);
    return a;
  }

  async update(account: BankAccount): Promise<void> {
    this.store.set(account.id, account);
  }

  async findById(id: number, companyId: number): Promise<BankAccount | null> {
    const a = this.store.get(id);
    return a && a.companyId === companyId ? a : null;
  }

  async listByCompany(
    companyId: number,
    options?: { includeArchived?: boolean },
  ): Promise<ReadonlyArray<BankAccount>> {
    return [...this.store.values()].filter(
      (a) => a.companyId === companyId && (options?.includeArchived === true || a.active),
    );
  }
}

export class InMemoryKasaAccountRepository implements KasaAccountRepository {
  private seq = 0;
  private readonly store = new Map<number, KasaAccount>();

  async insert(input: NewKasaAccountInput): Promise<KasaAccount> {
    this.seq += 1;
    const a = KasaAccount.create({
      id: this.seq,
      companyId: input.companyId,
      name: input.name,
      currency: input.currency,
      openingBalance: Money.fromMajor(input.openingBalanceMajor, input.currency),
      active: true,
      createdAt: NOW,
      updatedAt: NOW,
    });
    this.store.set(a.id, a);
    return a;
  }

  async update(account: KasaAccount): Promise<void> {
    this.store.set(account.id, account);
  }

  async findById(id: number, companyId: number): Promise<KasaAccount | null> {
    const a = this.store.get(id);
    return a && a.companyId === companyId ? a : null;
  }

  async listByCompany(
    companyId: number,
    options?: { includeArchived?: boolean },
  ): Promise<ReadonlyArray<KasaAccount>> {
    return [...this.store.values()].filter(
      (a) => a.companyId === companyId && (options?.includeArchived === true || a.active),
    );
  }
}

export class InMemoryKasaEntryRepository implements KasaEntryRepository {
  private seq = 0;
  private store: KasaEntry[] = [];

  async insert(entry: KasaEntry): Promise<KasaEntry> {
    this.seq += 1;
    const persisted = entry.withId(this.seq);
    this.store.push(persisted);
    return persisted;
  }

  async update(entry: KasaEntry): Promise<void> {
    this.store = this.store.map((e) => (e.id === entry.id ? entry : e));
  }

  async findById(id: number): Promise<KasaEntry | null> {
    return this.store.find((e) => e.id === id) ?? null;
  }

  async listByAccount(kasaAccountId: number): Promise<ReadonlyArray<KasaEntry>> {
    return this.store.filter((e) => e.kasaAccountId === kasaAccountId);
  }

  __snapshot(): { store: KasaEntry[]; seq: number } {
    return { store: [...this.store], seq: this.seq };
  }
  __restore(snap: { store: KasaEntry[]; seq: number }): void {
    this.store = [...snap.store];
    this.seq = snap.seq;
  }
}

export class InMemoryTransferRepository implements TransferRepository {
  private seq = 0;
  private store: Transfer[] = [];

  async insert(transfer: Transfer): Promise<Transfer> {
    this.seq += 1;
    const persisted = transfer.withId(this.seq);
    this.store.push(persisted);
    return persisted;
  }

  async update(transfer: Transfer): Promise<void> {
    this.store = this.store.map((t) => (t.id === transfer.id ? transfer : t));
  }

  async findById(id: number, companyId: number): Promise<Transfer | null> {
    return this.store.find((t) => t.id === id && t.companyId === companyId) ?? null;
  }

  async listByCompany(companyId: number): Promise<ReadonlyArray<Transfer>> {
    return this.store.filter((t) => t.companyId === companyId);
  }

  async listIncoming(
    companyId: number,
    toType: 'bank' | 'kasa',
    toId: number,
  ): Promise<ReadonlyArray<Transfer>> {
    return this.store.filter((t) => t.companyId === companyId && t.isTo(toType, toId));
  }

  async listOutgoing(
    companyId: number,
    fromType: 'bank' | 'kasa',
    fromId: number,
  ): Promise<ReadonlyArray<Transfer>> {
    return this.store.filter((t) => t.companyId === companyId && t.isFrom(fromType, fromId));
  }

  __snapshot(): { store: Transfer[]; seq: number } {
    return { store: [...this.store], seq: this.seq };
  }
  __restore(snap: { store: Transfer[]; seq: number }): void {
    this.store = [...snap.store];
    this.seq = snap.seq;
  }
}

export class InMemoryInvoiceRepository implements InvoiceRepository {
  private seq = 0;
  private readonly store = new Map<number, Invoice>();

  async insert(invoice: Invoice): Promise<Invoice> {
    this.seq += 1;
    const persisted = invoice.withId(this.seq);
    this.store.set(this.seq, persisted);
    return persisted;
  }

  async update(invoice: Invoice): Promise<void> {
    if (invoice.id !== null) {
      this.store.set(invoice.id, invoice);
    }
  }

  async findById(id: number, companyId: number): Promise<Invoice | null> {
    const inv = this.store.get(id);
    return inv && inv.companyId === companyId ? inv : null;
  }

  async listByCompany(
    companyId: number,
    options?: { type?: FlowDirection; openOnly?: boolean },
  ): Promise<ReadonlyArray<Invoice>> {
    return [...this.store.values()].filter(
      (inv) =>
        inv.companyId === companyId &&
        (options?.type === undefined || inv.type === options.type) &&
        (options?.openOnly !== true || inv.remaining().isPositive()),
    );
  }

  __snapshot(): { store: Map<number, Invoice>; seq: number } {
    return { store: new Map(this.store), seq: this.seq };
  }
  __restore(snap: { store: Map<number, Invoice>; seq: number }): void {
    this.store.clear();
    for (const [k, v] of snap.store) this.store.set(k, v);
    this.seq = snap.seq;
  }
}

/** snapshot/restore destekleyen fake repo arayüzü. */
interface Snapshotable {
  __snapshot(): unknown;
  __restore(snap: unknown): void;
}

/**
 * InMemoryFinanceUnitOfWork — gerçek PG transaction'ı simüle eder.
 * `fn` throw ederse snapshot'lanabilir repo'lar (cells, kasaEntries,
 * transfers, invoices) eski haline döndürülür (ROLLBACK). Category ve
 * invoicePayments commit-to-cells'te değişmediği için snapshot'lanmaz.
 *
 * Gerçek atomiklik PR 6'da PgFinanceUnitOfWork ile (BEGIN/COMMIT/ROLLBACK)
 * sağlanır; bu fake yalnız use-case'in atomik beklentiyle yazıldığını
 * doğrular (ADR-0006 ile aynı yaklaşım).
 */
export class InMemoryFinanceUnitOfWork implements FinanceUnitOfWork {
  private readonly snapshotable: Snapshotable[];

  constructor(private readonly repos: FinanceTransactionalRepositories) {
    this.snapshotable = [
      repos.cells as unknown as Snapshotable,
      repos.kasaEntries as unknown as Snapshotable,
      repos.transfers as unknown as Snapshotable,
      repos.invoices as unknown as Snapshotable,
    ];
  }

  async withTransaction<T>(
    fn: (repos: FinanceTransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    const snaps = this.snapshotable.map((r) => r.__snapshot());
    try {
      return await fn(this.repos);
    } catch (err) {
      // ROLLBACK simülasyonu
      this.snapshotable.forEach((r, i) => r.__restore(snaps[i]));
      throw err;
    }
  }
}

export class InMemoryInvoicePaymentRepository implements InvoicePaymentRepository {
  private seq = 0;
  private readonly store = new Map<number, InvoicePayment>();

  async insert(payment: InvoicePayment): Promise<InvoicePayment> {
    this.seq += 1;
    const persisted = payment.withId(this.seq);
    this.store.set(this.seq, persisted);
    return persisted;
  }

  async findById(id: number): Promise<InvoicePayment | null> {
    return this.store.get(id) ?? null;
  }

  async listByInvoice(invoiceId: number): Promise<ReadonlyArray<InvoicePayment>> {
    return [...this.store.values()].filter((p) => p.invoiceId === invoiceId);
  }

  async remove(id: number): Promise<void> {
    this.store.delete(id);
  }
}
