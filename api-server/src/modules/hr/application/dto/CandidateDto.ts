/**
 * CandidateDto — REST response için.
 */
import type { Candidate } from '../../domain/entities/Candidate.js';
import type { CandidateSource } from '../../domain/valueObjects/CandidateSource.js';

export interface CandidateDto {
  id: number;
  companyId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  /** Normalize edilmiş +90XXXXXXXXXX. */
  phone: string | null;
  source: CandidateSource;
  cvUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toCandidateDto(c: Candidate): CandidateDto {
  return {
    id: c.id,
    companyId: c.companyId,
    firstName: c.firstName,
    lastName: c.lastName,
    fullName: c.fullName,
    email: c.email,
    phone: c.phone?.value ?? null,
    source: c.source,
    cvUrl: c.cvUrl,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
