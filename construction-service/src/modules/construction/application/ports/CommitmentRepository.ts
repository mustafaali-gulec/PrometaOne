/**
 * CommitmentRepository — taahhüt kalıcılık portu (FAZ 7).
 * Concrete: infrastructure/persistence/PgCommitmentRepository.ts
 */
import type {
  Commitment,
  CommitmentSource,
  CommitmentStatus,
} from '../../domain/entities/Commitment.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';

export interface NewCommitmentInput {
  companyId: number;
  projectId: number;
  contractId: number | null;
  boqLineId: number | null;
  locationId: number | null;
  source: CommitmentSource;
  refNo: string;
  refLineNo: number;
  vendorId: number | null;
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  amount: number;
  deliveredAmount: number;
  currency: CurrencyCode;
  committedAt: string;
  note: string | null;
  createdBy: number | null;
}

export interface CommitmentFilter {
  projectId?: number | undefined;
  contractId?: number | undefined;
  boqLineId?: number | undefined;
  vendorId?: number | undefined;
  source?: CommitmentSource | undefined;
  status?: CommitmentStatus | undefined;
  /** true → yalnız open/partial (maruziyete girenler). */
  openOnly?: boolean | undefined;
  search?: string | undefined;
}

export interface ProjectCommitmentSummaryRow {
  projectId: number;
  commitmentCount: number;
  openCount: number;
  committedTotal: number;
  openCommitted: number;
  /** Poza bağlanmamış taahhüt — veri kalitesi göstergesi. */
  unlinkedCount: number;
  unlinkedAmount: number;
}

export interface ContractEvmRow {
  contractId: number;
  projectId: number;
  lineCount: number;
  bac: number;
  ev: number;
  ac: number;
  committedAmount: number;
  openCommitted: number;
  costExposure: number;
  budgetRemaining: number;
  /** EV/AC; AC 0 iken null. <1 = kazandığından çok harcıyor. */
  cpi: number | null;
  pctEarned: number | null;
  pctSpent: number | null;
  pctExposure: number | null;
}

export interface CommitmentRepository {
  insert(input: NewCommitmentInput): Promise<Commitment>;
  findById(id: number, companyId: number): Promise<Commitment | null>;
  /** Senkron anahtarıyla arama (source + refNo + refLineNo). */
  findByRef(
    companyId: number,
    source: CommitmentSource,
    refNo: string,
    refLineNo: number,
  ): Promise<Commitment | null>;
  list(companyId: number, filter?: CommitmentFilter): Promise<ReadonlyArray<Commitment>>;
  update(commitment: Commitment): Promise<Commitment>;
  projectSummary(companyId: number, projectId: number): Promise<ProjectCommitmentSummaryRow | null>;
  contractEvm(companyId: number, contractId: number): Promise<ContractEvmRow | null>;
  projectEvm(companyId: number, projectId: number): Promise<ReadonlyArray<ContractEvmRow>>;
}
