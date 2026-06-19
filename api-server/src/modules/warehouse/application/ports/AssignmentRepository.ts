/**
 * AssignmentRepository — Zimmet kalıcılık portu.
 * Concrete: infrastructure/persistence/PgAssignmentRepository.ts.
 */
import type { Assignment, AssignmentItem } from '../../domain/entities/Assignment.js';
import type { AssignmentStatus } from '../../domain/valueObjects/AuxStatuses.js';

export interface NewAssignmentInput {
  companyId: number;
  no: string;
  date: string;
  person: string | null;
  birim: string | null;
  status: AssignmentStatus;
  items: ReadonlyArray<AssignmentItem>;
  note: string | null;
}

export interface AssignmentRepository {
  insert(input: NewAssignmentInput): Promise<Assignment>;
  update(assignment: Assignment): Promise<void>;
  findById(id: number, companyId: number): Promise<Assignment | null>;
  listByCompany(
    companyId: number,
    options?: { status?: AssignmentStatus },
  ): Promise<ReadonlyArray<Assignment>>;
  /** Belge no üretmek için yıl bazında bir sonraki sıra. */
  nextSequence(companyId: number, year: number): Promise<number>;
}
