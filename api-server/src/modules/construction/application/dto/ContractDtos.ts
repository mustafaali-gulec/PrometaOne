/**
 * Contract DTO'ları — REST sınırında kullanılan düz tipler (gömülü tender).
 */
import type { Contract, TenderInfoProps } from '../../domain/entities/Contract.js';
import type { ContractParty } from '../../domain/valueObjects/ContractParty.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';

export interface TenderInfoDto {
  ikn: string | null;
  procedure: string | null;
  approxCost: number | null;
  tenderDate: string | null;
  workIncreasePct: number;
  perfBondPct: number;
  notes: string | null;
}

export interface ContractDto {
  id: number;
  companyId: number;
  projectId: number;
  partyKind: ContractParty;
  vendorId: number | null;
  contractNo: string;
  title: string;
  amount: number;
  currency: CurrencyCode;
  signDate: string | null;
  startDate: string | null;
  endDate: string | null;
  retentionPct: number;
  advancePct: number;
  priceDiffOn: boolean;
  tender: TenderInfoDto | null;
  createdAt: string;
  updatedAt: string;
}

function toTenderDto(t: TenderInfoProps | null): TenderInfoDto | null {
  if (t === null) return null;
  return {
    ikn: t.ikn,
    procedure: t.procedure,
    approxCost: t.approxCost,
    tenderDate: t.tenderDate,
    workIncreasePct: t.workIncreasePct,
    perfBondPct: t.perfBondPct,
    notes: t.notes,
  };
}

export function toContractDto(c: Contract): ContractDto {
  const j = c.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    projectId: j.projectId,
    partyKind: j.partyKind,
    vendorId: j.vendorId,
    contractNo: j.contractNo,
    title: j.title,
    amount: j.amount,
    currency: j.currency,
    signDate: j.signDate,
    startDate: j.startDate,
    endDate: j.endDate,
    retentionPct: j.retentionPct,
    advancePct: j.advancePct,
    priceDiffOn: j.priceDiffOn,
    tender: toTenderDto(j.tender),
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}
