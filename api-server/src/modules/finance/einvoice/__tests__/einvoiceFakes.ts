/**
 * E-Fatura use-case testleri için in-memory fake'ler + FixedClock + fake UoW.
 *
 * UoW fake'i InMemoryInvoiceRepository (finance fakes) + InMemoryEInvoiceRepository
 * snapshot/restore ile atomik rollback'i taklit eder (InMemoryFinanceUnitOfWork
 * deseni).
 */
import type { InMemoryInvoiceRepository } from '../../__tests__/fakes.js';
import type { Clock } from '../../application/ports/Clock.js';
import type { EncryptedCredential } from '../application/ports/CredentialCipher.js';
import type {
  EInvoiceCredentialRepository,
  EInvoiceRepository,
  PartyMappingRepository,
  SaveCredentialInput,
  SyncLogRecord,
  SyncLogRepository,
} from '../application/ports/EInvoiceRepositories.js';
import type {
  EInvoiceTransactionalRepositories,
  EInvoiceUnitOfWork,
} from '../application/ports/EInvoiceUnitOfWork.js';
import type { EInvoice } from '../domain/entities/EInvoice.js';
import { EInvoiceCredential } from '../domain/entities/EInvoiceCredential.js';
import type { PartyMapping } from '../domain/entities/PartyMapping.js';
import type { InvoiceDirection } from '../domain/valueObjects/InvoiceDirection.js';
import type { ProviderType } from '../domain/valueObjects/ProviderType.js';

export class FixedClock implements Clock {
  constructor(private readonly fixed: Date = new Date('2026-06-01T00:00:00Z')) {}
  now(): Date {
    return this.fixed;
  }
}

export class InMemoryEInvoiceRepository implements EInvoiceRepository {
  private seq = 0;
  private store = new Map<number, EInvoice>();

  upsert(einvoice: EInvoice): Promise<EInvoice> {
    // (companyId, uuid) idempotency
    const existing = [...this.store.values()].find(
      (e) => e.companyId === einvoice.companyId && e.uuid === einvoice.uuid,
    );
    if (existing && existing.id !== null) {
      const updated = einvoice.withId(existing.id);
      this.store.set(existing.id, updated);
      return Promise.resolve(updated);
    }
    this.seq += 1;
    const withId = einvoice.withId(this.seq);
    this.store.set(this.seq, withId);
    return Promise.resolve(withId);
  }

  update(einvoice: EInvoice): Promise<void> {
    if (einvoice.id !== null) this.store.set(einvoice.id, einvoice);
    return Promise.resolve();
  }

  findById(id: number, companyId: number): Promise<EInvoice | null> {
    const e = this.store.get(id);
    return Promise.resolve(e && e.companyId === companyId ? e : null);
  }

  findByUuid(companyId: number, uuid: string): Promise<EInvoice | null> {
    const e = [...this.store.values()].find((x) => x.companyId === companyId && x.uuid === uuid);
    return Promise.resolve(e ?? null);
  }

  listByCompany(
    companyId: number,
    options?: { direction?: InvoiceDirection; pendingOnly?: boolean },
  ): Promise<ReadonlyArray<EInvoice>> {
    let list = [...this.store.values()].filter((e) => e.companyId === companyId);
    if (options?.direction !== undefined) {
      list = list.filter((e) => e.direction === options.direction);
    }
    if (options?.pendingOnly === true) {
      list = list.filter((e) => !e.isImported && !e.isIgnored);
    }
    return Promise.resolve(list);
  }

  __snapshot(): { store: Map<number, EInvoice>; seq: number } {
    return { store: new Map(this.store), seq: this.seq };
  }
  __restore(snap: { store: Map<number, EInvoice>; seq: number }): void {
    this.store = new Map(snap.store);
    this.seq = snap.seq;
  }
}

export class InMemoryEInvoiceCredentialRepository implements EInvoiceCredentialRepository {
  private seq = 0;
  private readonly store = new Map<
    string,
    { credential: EInvoiceCredential; encrypted: EncryptedCredential }
  >();

  private key(companyId: number, provider: ProviderType): string {
    return `${companyId}|${provider}`;
  }

  save(input: SaveCredentialInput): Promise<EInvoiceCredential> {
    this.seq += 1;
    const now = new Date('2026-06-01T00:00:00Z');
    const credential = EInvoiceCredential.create({
      id: this.seq,
      companyId: input.companyId,
      provider: input.provider,
      isActive: true,
      autoSyncEnabled: input.autoSyncEnabled ?? false,
      autoSyncCron: input.autoSyncCron ?? '0 6 * * *',
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncMessage: null,
      lastSyncIncoming: 0,
      lastSyncOutgoing: 0,
      createdAt: now,
      updatedAt: now,
    });
    this.store.set(this.key(input.companyId, input.provider), {
      credential,
      encrypted: input.encrypted,
    });
    return Promise.resolve(credential);
  }

  findByProvider(companyId: number, provider: ProviderType): Promise<EInvoiceCredential | null> {
    return Promise.resolve(this.store.get(this.key(companyId, provider))?.credential ?? null);
  }

  getEncrypted(companyId: number, provider: ProviderType): Promise<EncryptedCredential | null> {
    return Promise.resolve(this.store.get(this.key(companyId, provider))?.encrypted ?? null);
  }

  update(credential: EInvoiceCredential): Promise<void> {
    const entry = this.store.get(this.key(credential.companyId, credential.provider));
    if (entry) entry.credential = credential;
    return Promise.resolve();
  }

  remove(companyId: number, provider: ProviderType): Promise<void> {
    this.store.delete(this.key(companyId, provider));
    return Promise.resolve();
  }
}

export class InMemorySyncLogRepository implements SyncLogRepository {
  readonly logs: SyncLogRecord[] = [];
  record(log: SyncLogRecord): Promise<void> {
    this.logs.push(log);
    return Promise.resolve();
  }
  listByCompany(companyId: number): Promise<ReadonlyArray<SyncLogRecord>> {
    return Promise.resolve(this.logs.filter((l) => l.companyId === companyId));
  }
}

export class InMemoryPartyMappingRepository implements PartyMappingRepository {
  private seq = 0;
  private readonly store = new Map<string, PartyMapping>();

  private key(companyId: number, vkn: string): string {
    return `${companyId}|${vkn}`;
  }

  findByVkn(companyId: number, vknTckn: string): Promise<PartyMapping | null> {
    return Promise.resolve(this.store.get(this.key(companyId, vknTckn)) ?? null);
  }

  upsert(mapping: PartyMapping): Promise<PartyMapping> {
    const withId = mapping.id !== null ? mapping : mapping.withId((this.seq += 1));
    this.store.set(this.key(withId.companyId, withId.vknTckn), withId);
    return Promise.resolve(withId);
  }

  listByCompany(companyId: number): Promise<ReadonlyArray<PartyMapping>> {
    return Promise.resolve([...this.store.values()].filter((m) => m.companyId === companyId));
  }
}

/** Snapshot/restore ile atomik rollback taklit eden fake UoW. */
export class FakeEInvoiceUnitOfWork implements EInvoiceUnitOfWork {
  constructor(
    private readonly einvoices: InMemoryEInvoiceRepository,
    private readonly invoices: InMemoryInvoiceRepository,
  ) {}

  async withTransaction<T>(
    fn: (repos: EInvoiceTransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    const snapE = this.einvoices.__snapshot();
    const snapI = this.invoices.__snapshot();
    try {
      return await fn({ einvoices: this.einvoices, invoices: this.invoices });
    } catch (err) {
      this.einvoices.__restore(snapE);
      this.invoices.__restore(snapI);
      throw err;
    }
  }
}
