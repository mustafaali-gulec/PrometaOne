/**
 * Cash DTO'ları — Money daima decimal string olarak serileşir.
 */
import type { BankAccount } from '../../domain/entities/BankAccount.js';
import type { KasaAccount } from '../../domain/entities/KasaAccount.js';
import type { KasaEntry } from '../../domain/entities/KasaEntry.js';
import type { Transfer } from '../../domain/entities/Transfer.js';
import type { Currency } from '../../domain/valueObjects/Currency.js';
import type { EndpointType } from '../../domain/valueObjects/EndpointType.js';
import type { FlowDirection } from '../../domain/valueObjects/FlowDirection.js';
import type { Money } from '../../domain/valueObjects/Money.js';

export interface BankAccountDto {
  id: number;
  companyId: number;
  bankId: number;
  name: string;
  iban: string | null;
  accountNo: string | null;
  currency: Currency;
  openingBalance: string;
  cashflowCatId: number | null;
  active: boolean;
}

export function toBankAccountDto(a: BankAccount): BankAccountDto {
  return a.toJSON();
}

export interface KasaAccountDto {
  id: number;
  companyId: number;
  name: string;
  currency: Currency;
  openingBalance: string;
  active: boolean;
}

export function toKasaAccountDto(a: KasaAccount): KasaAccountDto {
  return a.toJSON();
}

export interface KasaEntryDto {
  id: number | null;
  kasaAccountId: number;
  date: string;
  type: FlowDirection;
  amount: string;
  description: string | null;
  category: string | null;
  cashflowCatId: number | null;
  committedToCells: boolean;
}

export function toKasaEntryDto(e: KasaEntry): KasaEntryDto {
  return e.toJSON();
}

export interface TransferDto {
  id: number | null;
  companyId: number;
  date: string;
  fromType: EndpointType;
  fromId: number;
  toType: EndpointType;
  toId: number;
  fromAmount: string;
  toAmount: string;
  description: string | null;
  committedToCells: boolean;
}

export function toTransferDto(t: Transfer): TransferDto {
  return t.toJSON();
}

export interface CashPositionDto {
  endpointType: EndpointType;
  accountId: number;
  name: string;
  currency: Currency;
  openingBalance: string;
  currentBalance: string;
}

export function toCashPositionDto(params: {
  endpointType: EndpointType;
  accountId: number;
  name: string;
  currency: Currency;
  openingBalance: Money;
  currentBalance: Money;
}): CashPositionDto {
  return {
    endpointType: params.endpointType,
    accountId: params.accountId,
    name: params.name,
    currency: params.currency,
    openingBalance: params.openingBalance.toDecimalString(),
    currentBalance: params.currentBalance.toDecimalString(),
  };
}
