/**
 * Cash modülü kalıcılık portları (Faz 5 / PR 3).
 *
 * BankAccountRepository, KasaAccountRepository, KasaEntryRepository,
 * TransferRepository. Concrete: infrastructure/persistence/Pg*.ts (PR 6).
 */
import type { BankAccount } from '../../domain/entities/BankAccount.js';
import type { KasaAccount } from '../../domain/entities/KasaAccount.js';
import type { KasaEntry } from '../../domain/entities/KasaEntry.js';
import type { Transfer } from '../../domain/entities/Transfer.js';
import type { Currency } from '../../domain/valueObjects/Currency.js';

export interface NewBankAccountInput {
  companyId: number;
  bankId: number;
  name: string;
  iban: string | null;
  accountNo: string | null;
  currency: Currency;
  openingBalanceMajor: number;
  cashflowCatId: number | null;
}

export interface BankAccountRepository {
  insert(input: NewBankAccountInput): Promise<BankAccount>;
  update(account: BankAccount): Promise<void>;
  findById(id: number, companyId: number): Promise<BankAccount | null>;
  listByCompany(
    companyId: number,
    options?: { includeArchived?: boolean },
  ): Promise<ReadonlyArray<BankAccount>>;
}

export interface NewKasaAccountInput {
  companyId: number;
  name: string;
  currency: Currency;
  openingBalanceMajor: number;
}

export interface KasaAccountRepository {
  insert(input: NewKasaAccountInput): Promise<KasaAccount>;
  update(account: KasaAccount): Promise<void>;
  findById(id: number, companyId: number): Promise<KasaAccount | null>;
  listByCompany(
    companyId: number,
    options?: { includeArchived?: boolean },
  ): Promise<ReadonlyArray<KasaAccount>>;
}

export interface KasaEntryRepository {
  insert(entry: KasaEntry): Promise<KasaEntry>;
  update(entry: KasaEntry): Promise<void>;
  findById(id: number): Promise<KasaEntry | null>;
  /** Bir kasa hesabının tüm hareketleri (bakiye hesabı için). */
  listByAccount(kasaAccountId: number): Promise<ReadonlyArray<KasaEntry>>;
}

export interface TransferRepository {
  insert(transfer: Transfer): Promise<Transfer>;
  update(transfer: Transfer): Promise<void>;
  findById(id: number, companyId: number): Promise<Transfer | null>;
  listByCompany(companyId: number): Promise<ReadonlyArray<Transfer>>;
  /** Bir endpoint'e (bank/kasa + id) gelen transferler (toAmount). */
  listIncoming(
    companyId: number,
    toType: 'bank' | 'kasa',
    toId: number,
  ): Promise<ReadonlyArray<Transfer>>;
  /** Bir endpoint'ten giden transferler (fromAmount). */
  listOutgoing(
    companyId: number,
    fromType: 'bank' | 'kasa',
    fromId: number,
  ): Promise<ReadonlyArray<Transfer>>;
}
