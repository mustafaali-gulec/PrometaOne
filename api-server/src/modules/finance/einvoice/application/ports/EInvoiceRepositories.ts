/**
 * E-Fatura kalıcılık portları (PR 5). Concrete: PR 6 Pg* repository'leri.
 */
import type { EInvoice } from '../../domain/entities/EInvoice.js';
import type { EInvoiceCredential } from '../../domain/entities/EInvoiceCredential.js';
import type { PartyMapping } from '../../domain/entities/PartyMapping.js';
import type { InvoiceDirection } from '../../domain/valueObjects/InvoiceDirection.js';
import type { ProviderType } from '../../domain/valueObjects/ProviderType.js';

import type { EncryptedCredential } from './CredentialCipher.js';

export interface EInvoiceRepository {
  /** (companyId, uuid) UNIQUE üzerinden idempotent ekleme/güncelleme. */
  upsert(einvoice: EInvoice): Promise<EInvoice>;
  update(einvoice: EInvoice): Promise<void>;
  findById(id: number, companyId: number): Promise<EInvoice | null>;
  findByUuid(companyId: number, uuid: string): Promise<EInvoice | null>;
  listByCompany(
    companyId: number,
    options?: { direction?: InvoiceDirection; pendingOnly?: boolean },
  ): Promise<ReadonlyArray<EInvoice>>;
}

export interface SaveCredentialInput {
  companyId: number;
  provider: ProviderType;
  encrypted: EncryptedCredential;
  autoSyncEnabled?: boolean;
  autoSyncCron?: string;
  createdBy?: number | null;
}

export interface EInvoiceCredentialRepository {
  save(input: SaveCredentialInput): Promise<EInvoiceCredential>;
  findByProvider(companyId: number, provider: ProviderType): Promise<EInvoiceCredential | null>;
  /** Şifreli config blob'u (decrypt use-case'te CredentialCipher ile). */
  getEncrypted(companyId: number, provider: ProviderType): Promise<EncryptedCredential | null>;
  update(credential: EInvoiceCredential): Promise<void>;
  remove(companyId: number, provider: ProviderType): Promise<void>;
}

export interface SyncLogRecord {
  companyId: number;
  provider: ProviderType;
  trigger: 'manual' | 'cron' | 'api' | 'webhook';
  startedAt: Date;
  finishedAt: Date | null;
  status: 'success' | 'partial' | 'error';
  incomingFetched: number;
  incomingNew: number;
  outgoingFetched: number;
  outgoingNew: number;
  errorsCount: number;
  errorMessage: string | null;
  triggeredBy: number | null;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface SyncLogRepository {
  record(log: SyncLogRecord): Promise<void>;
  listByCompany(companyId: number): Promise<ReadonlyArray<SyncLogRecord>>;
}

export interface PartyMappingRepository {
  findByVkn(companyId: number, vknTckn: string): Promise<PartyMapping | null>;
  upsert(mapping: PartyMapping): Promise<PartyMapping>;
  listByCompany(companyId: number): Promise<ReadonlyArray<PartyMapping>>;
}
