/**
 * Sözleşme use-case'leri.
 *
 * CreateContract sözleşme no verilmezse `SZL-YYYY-NNNN` üretir, proje varlığını
 * doğrular ve (varsa) ihale bilgisini birlikte kaydeder. Gömülü tender 1-1.
 */
import type { TenderInfoProps } from '../../domain/entities/Contract.js';
import {
  ContractNotFoundError,
  DuplicateContractNoError,
  ProjectNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import type { ContractParty } from '../../domain/valueObjects/ContractParty.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import { round2 } from '../../domain/valueObjects/Currency.js';
import { toContractDto, type ContractDto } from '../dto/ContractDtos.js';
import type { Clock } from '../ports/Clock.js';
import type { ContractRepository, ListContractsOptions } from '../ports/ContractRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';

export interface TenderInfoInput {
  ikn?: string | null | undefined;
  procedure?: string | null | undefined;
  approxCost?: number | null | undefined;
  tenderDate?: string | null | undefined;
  workIncreasePct?: number | undefined;
  perfBondPct?: number | undefined;
  notes?: string | null | undefined;
}

function toTenderProps(input: TenderInfoInput | null | undefined): TenderInfoProps | null {
  if (input === null || input === undefined) return null;
  return {
    ikn: input.ikn ?? null,
    procedure: input.procedure ?? null,
    approxCost:
      input.approxCost !== undefined && input.approxCost !== null ? round2(input.approxCost) : null,
    tenderDate: input.tenderDate ?? null,
    workIncreasePct: input.workIncreasePct ?? 0,
    perfBondPct: input.perfBondPct ?? 0,
    notes: input.notes ?? null,
  };
}

async function nextContractNo(
  contracts: ContractRepository,
  companyId: number,
  year: number,
): Promise<string> {
  const prefix = `SZL-${year}-`;
  const existing = await contracts.listByCompany(companyId);
  let max = 0;
  for (const c of existing) {
    if (!c.contractNo.startsWith(prefix)) continue;
    const n = parseInt(c.contractNo.slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export interface CreateContractInput {
  companyId: number;
  projectId: number;
  partyKind: ContractParty;
  vendorId?: number | null | undefined;
  contractNo?: string | undefined;
  title: string;
  amount?: number | undefined;
  currency?: CurrencyCode | undefined;
  signDate?: string | null | undefined;
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
  retentionPct?: number | undefined;
  advancePct?: number | undefined;
  priceDiffOn?: boolean | undefined;
  tender?: TenderInfoInput | null | undefined;
  createdBy?: number | null | undefined;
}

export class CreateContractUseCase {
  constructor(
    private readonly contracts: ContractRepository,
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateContractInput): Promise<ContractDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);

    const year = this.clock.now().getFullYear();
    const contractNo =
      input.contractNo?.trim() || (await nextContractNo(this.contracts, input.companyId, year));

    if (await this.contracts.existsByNo(input.companyId, contractNo)) {
      throw new DuplicateContractNoError(contractNo);
    }

    const created = await this.contracts.insert({
      companyId: input.companyId,
      projectId: input.projectId,
      partyKind: input.partyKind,
      vendorId: input.vendorId ?? null,
      contractNo,
      title: input.title.trim(),
      amount: round2(input.amount ?? 0),
      currency: input.currency ?? 'TRY',
      signDate: input.signDate ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      retentionPct: input.retentionPct ?? 0,
      advancePct: input.advancePct ?? 0,
      priceDiffOn: input.priceDiffOn ?? false,
      tender: toTenderProps(input.tender),
      createdBy: input.createdBy ?? null,
    });
    return toContractDto(created);
  }
}

export interface ListContractsInput {
  companyId: number;
  projectId?: number;
  partyKind?: ContractParty;
  search?: string;
}

export class ListContractsUseCase {
  constructor(private readonly contracts: ContractRepository) {}

  async execute(input: ListContractsInput): Promise<ContractDto[]> {
    const options: ListContractsOptions = {};
    if (input.projectId !== undefined) options.projectId = input.projectId;
    if (input.partyKind !== undefined) options.partyKind = input.partyKind;
    if (input.search !== undefined) options.search = input.search;
    const list = await this.contracts.listByCompany(input.companyId, options);
    return list.map(toContractDto);
  }
}

export interface UpdateContractInput {
  companyId: number;
  contractId: number;
  title?: string | undefined;
  vendorId?: number | null | undefined;
  amount?: number | undefined;
  currency?: CurrencyCode | undefined;
  signDate?: string | null | undefined;
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
  retentionPct?: number | undefined;
  advancePct?: number | undefined;
  priceDiffOn?: boolean | undefined;
  tender?: TenderInfoInput | null | undefined;
}

export class UpdateContractUseCase {
  constructor(
    private readonly contracts: ContractRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateContractInput): Promise<ContractDto> {
    const contract = await this.contracts.findById(input.contractId, input.companyId);
    if (!contract) throw new ContractNotFoundError(input.contractId);
    const updated = contract.update(
      {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.vendorId !== undefined ? { vendorId: input.vendorId } : {}),
        ...(input.amount !== undefined ? { amount: round2(input.amount) } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.signDate !== undefined ? { signDate: input.signDate } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
        ...(input.retentionPct !== undefined ? { retentionPct: input.retentionPct } : {}),
        ...(input.advancePct !== undefined ? { advancePct: input.advancePct } : {}),
        ...(input.priceDiffOn !== undefined ? { priceDiffOn: input.priceDiffOn } : {}),
        ...(input.tender !== undefined ? { tender: toTenderProps(input.tender) } : {}),
      },
      this.clock.now(),
    );
    await this.contracts.update(updated);
    return toContractDto(updated);
  }
}
