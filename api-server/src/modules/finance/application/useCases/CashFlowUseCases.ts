/**
 * Nakit akış use-case'leri (Faz 5 / PR 3):
 * RecordKasaEntry, CreateTransfer, GetCashPosition, ListTransfers
 * + kasa yazma-cutover'ı için ListKasaEntries / UpdateKasaEntry /
 *   DeleteKasaEntry (FE düzenleme/silme akışı).
 */
import { KasaEntry } from '../../domain/entities/KasaEntry.js';
import { Transfer } from '../../domain/entities/Transfer.js';
import {
  KasaAccountNotFoundError,
  KasaEntryNotFoundError,
  TransferEndpointNotFoundError,
} from '../../domain/errors/FinanceErrors.js';
import { CashPositionCalculator } from '../../domain/services/CashPositionCalculator.js';
import type { Currency } from '../../domain/valueObjects/Currency.js';
import type { EndpointType } from '../../domain/valueObjects/EndpointType.js';
import type { FlowDirection } from '../../domain/valueObjects/FlowDirection.js';
import { Money } from '../../domain/valueObjects/Money.js';
import {
  toCashPositionDto,
  toKasaEntryDto,
  toTransferDto,
  type CashPositionDto,
  type KasaEntryDto,
  type TransferDto,
} from '../dto/CashDtos.js';
import type {
  BankAccountRepository,
  KasaAccountRepository,
  KasaEntryRepository,
  TransferRepository,
} from '../ports/CashRepositories.js';
import type { Clock } from '../ports/Clock.js';

export interface RecordKasaEntryInput {
  companyId: number;
  kasaAccountId: number;
  date: string;
  type: FlowDirection;
  /** Pozitif major tutar (yön `type` ile). */
  amount: number;
  description?: string | null;
  category?: string | null;
  cashflowCatId?: number | null;
  actorUserId: number | null;
}

export class RecordKasaEntryUseCase {
  constructor(
    private readonly kasaAccounts: KasaAccountRepository,
    private readonly entries: KasaEntryRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RecordKasaEntryInput): Promise<KasaEntryDto> {
    const account = await this.kasaAccounts.findById(input.kasaAccountId, input.companyId);
    if (!account) {
      throw new KasaAccountNotFoundError(input.kasaAccountId);
    }
    const now = this.clock.now();
    const entry = KasaEntry.create({
      id: null,
      kasaAccountId: input.kasaAccountId,
      date: input.date,
      type: input.type,
      amount: Money.fromMajor(input.amount, account.currency),
      description: input.description ?? null,
      category: input.category ?? null,
      cashflowCatId: input.cashflowCatId ?? null,
      committedToCells: false,
      committedAt: null,
      createdBy: input.actorUserId,
      createdAt: now,
      updatedAt: now,
    });
    const persisted = await this.entries.insert(entry);
    return toKasaEntryDto(persisted);
  }
}

export interface ListKasaEntriesInput {
  companyId: number;
  /** Verilirse yalnız bu kasa hesabının hareketleri (şirket doğrulanır). */
  kasaAccountId?: number;
}

export class ListKasaEntriesUseCase {
  constructor(
    private readonly kasaAccounts: KasaAccountRepository,
    private readonly entries: KasaEntryRepository,
  ) {}

  async execute(input: ListKasaEntriesInput): Promise<KasaEntryDto[]> {
    if (input.kasaAccountId !== undefined) {
      const account = await this.kasaAccounts.findById(input.kasaAccountId, input.companyId);
      if (!account) {
        throw new KasaAccountNotFoundError(input.kasaAccountId);
      }
      const list = await this.entries.listByAccount(input.kasaAccountId);
      return list.map(toKasaEntryDto);
    }
    const list = await this.entries.listByCompany(input.companyId);
    return list.map(toKasaEntryDto);
  }
}

export interface UpdateKasaEntryInput {
  companyId: number;
  entryId: number;
  /** undefined = değişmez; null = temizle (description/category/cashflowCatId). */
  kasaAccountId?: number;
  date?: string;
  type?: FlowDirection;
  amount?: number;
  description?: string | null;
  category?: string | null;
  cashflowCatId?: number | null;
}

export class UpdateKasaEntryUseCase {
  constructor(
    private readonly kasaAccounts: KasaAccountRepository,
    private readonly entries: KasaEntryRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateKasaEntryInput): Promise<KasaEntryDto> {
    const entry = await this.entries.findById(input.entryId);
    if (!entry) {
      throw new KasaEntryNotFoundError(input.entryId);
    }
    // Şirket kapsamı: hareketin kasası bu şirkette değilse 404 (çapraz-tenant
    // sızıntısı olmasın — kasa_entries'te company kolonu yok, kasadan gelir).
    const currentAccount = await this.kasaAccounts.findById(entry.kasaAccountId, input.companyId);
    if (!currentAccount) {
      throw new KasaEntryNotFoundError(input.entryId);
    }

    let account = currentAccount;
    if (input.kasaAccountId !== undefined && input.kasaAccountId !== entry.kasaAccountId) {
      const target = await this.kasaAccounts.findById(input.kasaAccountId, input.companyId);
      if (!target) {
        throw new KasaAccountNotFoundError(input.kasaAccountId);
      }
      account = target;
    }

    const amountMajor = input.amount !== undefined ? input.amount : entry.amount.toMajor();
    const updated = KasaEntry.create({
      id: entry.id,
      kasaAccountId: account.id,
      date: input.date ?? entry.date,
      type: input.type ?? entry.type,
      // Tutar hedef kasanın para biriminde (kasa değişince birim de değişir).
      amount: Money.fromMajor(amountMajor, account.currency),
      description: input.description !== undefined ? input.description : entry.description,
      category: input.category !== undefined ? input.category : entry.category,
      cashflowCatId: input.cashflowCatId !== undefined ? input.cashflowCatId : entry.cashflowCatId,
      committedToCells: entry.committedToCells,
      committedAt: entry.committedAt,
      createdBy: entry.createdBy,
      createdAt: this.clock.now(),
      updatedAt: this.clock.now(),
    });
    await this.entries.update(updated);
    return toKasaEntryDto(updated);
  }
}

export interface DeleteKasaEntryInput {
  companyId: number;
  entryId: number;
}

export class DeleteKasaEntryUseCase {
  constructor(
    private readonly kasaAccounts: KasaAccountRepository,
    private readonly entries: KasaEntryRepository,
  ) {}

  async execute(input: DeleteKasaEntryInput): Promise<{ deleted: true }> {
    const entry = await this.entries.findById(input.entryId);
    if (!entry) {
      throw new KasaEntryNotFoundError(input.entryId);
    }
    const account = await this.kasaAccounts.findById(entry.kasaAccountId, input.companyId);
    if (!account) {
      throw new KasaEntryNotFoundError(input.entryId); // çapraz-tenant → 404
    }
    await this.entries.delete(input.entryId);
    return { deleted: true };
  }
}

export interface CreateTransferInput {
  companyId: number;
  date: string;
  fromType: EndpointType;
  fromId: number;
  toType: EndpointType;
  toId: number;
  fromAmount: number;
  toAmount: number;
  fromCurrency: Currency;
  toCurrency: Currency;
  description?: string | null;
  cashflowCatId?: number | null;
  actorUserId: number | null;
}

export class CreateTransferUseCase {
  constructor(
    private readonly bankAccounts: BankAccountRepository,
    private readonly kasaAccounts: KasaAccountRepository,
    private readonly transfers: TransferRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateTransferInput): Promise<TransferDto> {
    // Her iki uç noktanın da aynı şirkette var olduğunu doğrula.
    await this.assertEndpointExists(input.companyId, input.fromType, input.fromId);
    await this.assertEndpointExists(input.companyId, input.toType, input.toId);

    const now = this.clock.now();
    // Transfer.create aynı-hesap ve pozitif-tutar invariant'larını uygular.
    const transfer = Transfer.create({
      id: null,
      companyId: input.companyId,
      date: input.date,
      fromType: input.fromType,
      fromId: input.fromId,
      toType: input.toType,
      toId: input.toId,
      fromAmount: Money.fromMajor(input.fromAmount, input.fromCurrency),
      toAmount: Money.fromMajor(input.toAmount, input.toCurrency),
      description: input.description ?? null,
      cashflowCatId: input.cashflowCatId ?? null,
      committedToCells: false,
      committedAt: null,
      createdBy: input.actorUserId,
      createdAt: now,
      updatedAt: now,
    });
    const persisted = await this.transfers.insert(transfer);
    return toTransferDto(persisted);
  }

  private async assertEndpointExists(
    companyId: number,
    type: EndpointType,
    id: number,
  ): Promise<void> {
    const found =
      type === 'bank'
        ? await this.bankAccounts.findById(id, companyId)
        : await this.kasaAccounts.findById(id, companyId);
    if (!found) {
      throw new TransferEndpointNotFoundError(type, id);
    }
  }
}

export class ListTransfersUseCase {
  constructor(private readonly transfers: TransferRepository) {}

  async execute(input: { companyId: number }): Promise<TransferDto[]> {
    const list = await this.transfers.listByCompany(input.companyId);
    return list.map(toTransferDto);
  }
}

export interface GetCashPositionInput {
  companyId: number;
  endpointType: EndpointType;
  accountId: number;
}

export class GetCashPositionUseCase {
  constructor(
    private readonly bankAccounts: BankAccountRepository,
    private readonly kasaAccounts: KasaAccountRepository,
    private readonly entries: KasaEntryRepository,
    private readonly transfers: TransferRepository,
  ) {}

  async execute(input: GetCashPositionInput): Promise<CashPositionDto> {
    const { companyId, endpointType, accountId } = input;

    let currency: Currency;
    let openingBalance: Money;
    let name: string;
    let kasaEntries: Awaited<ReturnType<KasaEntryRepository['listByAccount']>> = [];

    if (endpointType === 'bank') {
      const account = await this.bankAccounts.findById(accountId, companyId);
      if (!account) {
        throw new TransferEndpointNotFoundError('bank', accountId);
      }
      currency = account.currency;
      openingBalance = account.openingBalance;
      name = account.name;
    } else {
      const account = await this.kasaAccounts.findById(accountId, companyId);
      if (!account) {
        throw new TransferEndpointNotFoundError('kasa', accountId);
      }
      currency = account.currency;
      openingBalance = account.openingBalance;
      name = account.name;
      kasaEntries = await this.entries.listByAccount(accountId);
    }

    const [incoming, outgoing] = await Promise.all([
      this.transfers.listIncoming(companyId, endpointType, accountId),
      this.transfers.listOutgoing(companyId, endpointType, accountId),
    ]);

    const currentBalance = CashPositionCalculator.compute({
      currency,
      openingBalance,
      kasaEntries,
      incomingTransfers: incoming,
      outgoingTransfers: outgoing,
    });

    return toCashPositionDto({
      endpointType,
      accountId,
      name,
      currency,
      openingBalance,
      currentBalance,
    });
  }
}
