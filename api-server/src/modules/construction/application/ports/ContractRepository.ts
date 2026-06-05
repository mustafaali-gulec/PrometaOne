/**
 * ContractRepository — sözleşme (+ ihale bilgisi) kalıcılık portu.
 * Concrete: infrastructure/persistence/PgContractRepository.ts
 */
import type { Contract, TenderInfoProps } from '../../domain/entities/Contract.js';
import type { ContractParty } from '../../domain/valueObjects/ContractParty.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';

export interface NewContractInput {
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
  tender: TenderInfoProps | null;
  createdBy: number | null;
}

export interface ListContractsOptions {
  projectId?: number;
  partyKind?: ContractParty;
  search?: string;
}

export interface ContractRepository {
  insert(input: NewContractInput): Promise<Contract>;
  update(contract: Contract): Promise<void>;
  findById(id: number, companyId: number): Promise<Contract | null>;
  listByCompany(
    companyId: number,
    options?: ListContractsOptions,
  ): Promise<ReadonlyArray<Contract>>;
  existsByNo(companyId: number, contractNo: string, excludeId?: number): Promise<boolean>;
}
