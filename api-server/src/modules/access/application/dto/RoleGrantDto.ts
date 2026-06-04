/**
 * RoleGrantDto — REST response için.
 */
import type { RoleGrant } from '../../domain/entities/RoleGrant.js';
import type { SubjectType } from '../../domain/valueObjects/SubjectType.js';

export interface RoleGrantDto {
  id: number;
  companyId: number;
  roleId: number;
  subjectType: SubjectType;
  subjectId: string;
  cascade: boolean;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toRoleGrantDto(grant: RoleGrant): RoleGrantDto {
  return {
    id: grant.id,
    companyId: grant.companyId,
    roleId: grant.roleId,
    subjectType: grant.subjectType,
    subjectId: grant.subjectId,
    cascade: grant.cascade,
    validFrom: grant.validFrom === null ? null : grant.validFrom.toISOString(),
    validUntil: grant.validUntil === null ? null : grant.validUntil.toISOString(),
    createdAt: grant.createdAt.toISOString(),
    updatedAt: grant.updatedAt.toISOString(),
  };
}
