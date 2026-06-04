/**
 * RoleGrant — bir özel rolü bir özneye (user/employee/job_title/department/org_unit)
 * atayan kayıt. Opsiyonel geçerlilik penceresi (validFrom/validUntil) ve cascade
 * (alt birimlere yayılım) destekler.
 *
 * Immutable.
 */
import type { SubjectType } from '../valueObjects/SubjectType.js';

export interface RoleGrantProps {
  id: number;
  companyId: number;
  roleId: number;
  subjectType: SubjectType;
  /** 'user' → username; diğerleri → numeric id'nin text hali. */
  subjectId: string;
  cascade: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class RoleGrant {
  private constructor(private readonly props: Readonly<RoleGrantProps>) {}

  static create(props: RoleGrantProps): RoleGrant {
    if (props.id <= 0) {
      throw new Error('RoleGrant.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('RoleGrant.companyId pozitif olmalı');
    }
    if (props.roleId <= 0) {
      throw new Error('RoleGrant.roleId pozitif olmalı');
    }
    if (props.subjectId.trim().length === 0) {
      throw new Error('RoleGrant.subjectId boş olamaz');
    }
    if (
      props.validFrom !== null &&
      props.validUntil !== null &&
      props.validFrom.getTime() > props.validUntil.getTime()
    ) {
      throw new Error('RoleGrant.validFrom, validUntil sonrasında olamaz');
    }
    return new RoleGrant(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get roleId(): number {
    return this.props.roleId;
  }
  get subjectType(): SubjectType {
    return this.props.subjectType;
  }
  get subjectId(): string {
    return this.props.subjectId;
  }
  get cascade(): boolean {
    return this.props.cascade;
  }
  get validFrom(): Date | null {
    return this.props.validFrom;
  }
  get validUntil(): Date | null {
    return this.props.validUntil;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Grant verilen anda geçerlilik penceresi içinde mi? */
  isActiveAt(now: Date): boolean {
    if (this.props.validFrom !== null && this.props.validFrom.getTime() > now.getTime()) {
      return false;
    }
    if (this.props.validUntil !== null && this.props.validUntil.getTime() < now.getTime()) {
      return false;
    }
    return true;
  }

  toJSON(): Readonly<RoleGrantProps> {
    return { ...this.props };
  }
}
