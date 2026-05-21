/**
 * Candidate — işe alım aday havuzu kaydı.
 *
 * Immutable. Bir aday birden fazla pozisyona başvurabilir (Application
 * entity'si üzerinden). Aday bilgileri sadece kişisel ve iletişim alanlarını
 * tutar; başvuru detayları Application'a aittir.
 */
import type { CandidateSource } from '../valueObjects/CandidateSource.js';
import type { PhoneNumber } from '../valueObjects/PhoneNumber.js';

export interface CandidateProps {
  id: number;
  companyId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: PhoneNumber | null;
  source: CandidateSource;
  cvUrl: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Candidate {
  private constructor(private readonly props: Readonly<CandidateProps>) {}

  static create(props: CandidateProps): Candidate {
    if (props.id <= 0) {
      throw new Error('Candidate.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('Candidate.companyId pozitif olmalı');
    }
    if (props.firstName.trim().length === 0) {
      throw new Error('Candidate.firstName boş olamaz');
    }
    if (props.firstName.length > 100) {
      throw new Error('Candidate.firstName 100 karakteri geçemez');
    }
    if (props.lastName.trim().length === 0) {
      throw new Error('Candidate.lastName boş olamaz');
    }
    if (props.lastName.length > 100) {
      throw new Error('Candidate.lastName 100 karakteri geçemez');
    }
    return new Candidate(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get firstName(): string {
    return this.props.firstName;
  }
  get lastName(): string {
    return this.props.lastName;
  }
  get fullName(): string {
    return `${this.props.firstName} ${this.props.lastName}`;
  }
  get email(): string | null {
    return this.props.email;
  }
  get phone(): PhoneNumber | null {
    return this.props.phone;
  }
  get source(): CandidateSource {
    return this.props.source;
  }
  get cvUrl(): string | null {
    return this.props.cvUrl;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  updateProfile(
    update: {
      firstName?: string;
      lastName?: string;
      email?: string | null;
      phone?: PhoneNumber | null;
      source?: CandidateSource;
      cvUrl?: string | null;
      notes?: string | null;
    },
    now: Date,
  ): Candidate {
    const firstName =
      update.firstName !== undefined ? update.firstName.trim() : this.props.firstName;
    const lastName = update.lastName !== undefined ? update.lastName.trim() : this.props.lastName;

    if (firstName.length === 0) {
      throw new Error('Candidate.firstName boş olamaz');
    }
    if (firstName.length > 100) {
      throw new Error('Candidate.firstName 100 karakteri geçemez');
    }
    if (lastName.length === 0) {
      throw new Error('Candidate.lastName boş olamaz');
    }
    if (lastName.length > 100) {
      throw new Error('Candidate.lastName 100 karakteri geçemez');
    }

    return new Candidate({
      ...this.props,
      firstName,
      lastName,
      email: update.email !== undefined ? update.email : this.props.email,
      phone: update.phone !== undefined ? update.phone : this.props.phone,
      source: update.source !== undefined ? update.source : this.props.source,
      cvUrl: update.cvUrl !== undefined ? update.cvUrl : this.props.cvUrl,
      notes: update.notes !== undefined ? update.notes : this.props.notes,
      updatedAt: now,
    });
  }

  toJSON(): Readonly<CandidateProps> {
    return { ...this.props };
  }
}
