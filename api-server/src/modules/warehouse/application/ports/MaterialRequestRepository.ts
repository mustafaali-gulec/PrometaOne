/**
 * MaterialRequestRepository — Malzeme Talep kalıcılık portu.
 * Concrete: infrastructure/persistence/PgMaterialRequestRepository.ts.
 */
import type {
  MaterialRequest,
  MaterialRequestItem,
} from '../../domain/entities/MaterialRequest.js';
import type { MaterialRequestStatus } from '../../domain/valueObjects/AuxStatuses.js';

export interface NewMaterialRequestInput {
  companyId: number;
  no: string;
  date: string;
  requesterUnit: string | null;
  requester: string | null;
  requestedWarehouseId: number | null;
  validityDays: number | null;
  status: MaterialRequestStatus;
  items: ReadonlyArray<MaterialRequestItem>;
  note: string | null;
  rejectReason: string | null;
}

export interface MaterialRequestRepository {
  insert(input: NewMaterialRequestInput): Promise<MaterialRequest>;
  update(request: MaterialRequest): Promise<void>;
  findById(id: number, companyId: number): Promise<MaterialRequest | null>;
  listByCompany(
    companyId: number,
    options?: { status?: MaterialRequestStatus },
  ): Promise<ReadonlyArray<MaterialRequest>>;
  /** Belge no üretmek için yıl bazında bir sonraki sıra. */
  nextSequence(companyId: number, year: number): Promise<number>;
}
