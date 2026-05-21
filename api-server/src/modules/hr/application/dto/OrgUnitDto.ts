/**
 * OrgUnitDto — REST response için.
 */
import type { OrgUnit } from '../../domain/entities/OrgUnit.js';

export interface OrgUnitDto {
  id: number;
  companyId: number;
  parentId: number | null;
  name: string;
  code: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toOrgUnitDto(u: OrgUnit): OrgUnitDto {
  return {
    id: u.id,
    companyId: u.companyId,
    parentId: u.parentId,
    name: u.name,
    code: u.code?.value ?? null,
    sortOrder: u.sortOrder,
    active: u.active,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}
