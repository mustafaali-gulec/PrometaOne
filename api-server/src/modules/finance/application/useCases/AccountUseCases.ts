/**
 * Banka & kasa hesabı use-case'leri (Faz 5 / PR 3).
 */
import {
  BankAccountNotFoundError,
  KasaAccountNotFoundError,
} from '../../domain/errors/FinanceErrors.js';
import type { Currency } from '../../domain/valueObjects/Currency.js';
import {
  toBankAccountDto,
  toKasaAccountDto,
  type BankAccountDto,
  type KasaAccountDto,
} from '../dto/CashDtos.js';
import type { BankAccountRepository, KasaAccountRepository } from '../ports/CashRepositories.js';
import type { Clock } from '../ports/Clock.js';

export interface CreateBankAccountInput {
  companyId: number;
  bankId: number;
  name: string;
  iban?: string | null;
  accountNo?: string | null;
  currency: Currency;
  openingBalance?: number;
  cashflowCatId?: number | null;
}

export class CreateBankAccountUseCase {
  constructor(private readonly accounts: BankAccountRepository) {}

  async execute(input: CreateBankAccountInput): Promise<BankAccountDto> {
    const created = await this.accounts.insert({
      companyId: input.companyId,
      bankId: input.bankId,
      name: input.name.trim(),
      iban: input.iban ?? null,
      accountNo: input.accountNo ?? null,
      currency: input.currency,
      openingBalanceMajor: input.openingBalance ?? 0,
      cashflowCatId: input.cashflowCatId ?? null,
    });
    return toBankAccountDto(created);
  }
}

export class ArchiveBankAccountUseCase {
  constructor(
    private readonly accounts: BankAccountRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { companyId: number; accountId: number }): Promise<BankAccountDto> {
    const account = await this.accounts.findById(input.accountId, input.companyId);
    if (!account) {
      throw new BankAccountNotFoundError(input.accountId);
    }
    const archived = account.archive(this.clock.now());
    await this.accounts.update(archived);
    return toBankAccountDto(archived);
  }
}

export class ListBankAccountsUseCase {
  constructor(private readonly accounts: BankAccountRepository) {}

  async execute(input: {
    companyId: number;
    includeArchived?: boolean;
  }): Promise<BankAccountDto[]> {
    const list = await this.accounts.listByCompany(input.companyId, {
      ...(input.includeArchived !== undefined ? { includeArchived: input.includeArchived } : {}),
    });
    return list.map(toBankAccountDto);
  }
}

export interface CreateKasaAccountInput {
  companyId: number;
  name: string;
  currency: Currency;
  openingBalance?: number;
}

export class CreateKasaAccountUseCase {
  constructor(private readonly accounts: KasaAccountRepository) {}

  async execute(input: CreateKasaAccountInput): Promise<KasaAccountDto> {
    const created = await this.accounts.insert({
      companyId: input.companyId,
      name: input.name.trim(),
      currency: input.currency,
      openingBalanceMajor: input.openingBalance ?? 0,
    });
    return toKasaAccountDto(created);
  }
}

export class ArchiveKasaAccountUseCase {
  constructor(
    private readonly accounts: KasaAccountRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { companyId: number; accountId: number }): Promise<KasaAccountDto> {
    const account = await this.accounts.findById(input.accountId, input.companyId);
    if (!account) {
      throw new KasaAccountNotFoundError(input.accountId);
    }
    const archived = account.archive(this.clock.now());
    await this.accounts.update(archived);
    return toKasaAccountDto(archived);
  }
}

export class ListKasaAccountsUseCase {
  constructor(private readonly accounts: KasaAccountRepository) {}

  async execute(input: {
    companyId: number;
    includeArchived?: boolean;
  }): Promise<KasaAccountDto[]> {
    const list = await this.accounts.listByCompany(input.companyId, {
      ...(input.includeArchived !== undefined ? { includeArchived: input.includeArchived } : {}),
    });
    return list.map(toKasaAccountDto);
  }
}
