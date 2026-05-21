/**
 * CandidateRepository — port.
 *
 * Concrete: infrastructure/persistence/PgCandidateRepository.ts (PR 4'te).
 */
import type { Candidate } from '../../domain/entities/Candidate.js';
import type { CandidateSource } from '../../domain/valueObjects/CandidateSource.js';

export interface CandidateRepository {
  insert(input: NewCandidateInput): Promise<Candidate>;

  update(candidate: Candidate): Promise<void>;

  findById(id: number, companyId: number): Promise<Candidate | null>;

  listByCompany(
    companyId: number,
    options?: {
      source?: CandidateSource;
      /** İsim/soyisim/email içinde arar (case-insensitive). */
      q?: string;
    },
  ): Promise<ReadonlyArray<Candidate>>;

  /**
   * Silme — sadece bu candidate'a bağlı aktif application yoksa.
   * Caller (use-case) hasActiveApplications kontrolü yapmalı.
   */
  remove(id: number, companyId: number): Promise<void>;
}

export interface NewCandidateInput {
  companyId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  /** Normalize edilmiş +90XXXXXXXXXX. */
  phone: string | null;
  source: CandidateSource;
  cvUrl: string | null;
  notes: string | null;
}
