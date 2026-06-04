/**
 * CustomRoleDto — REST response için.
 */
import type { CustomRole } from '../../domain/entities/CustomRole.js';

export interface CustomRoleDto {
  id: number;
  companyId: number;
  name: string;
  description: string | null;
  permissions: ReadonlyArray<string>;
  createdAt: string;
  updatedAt: string;
}

export function toCustomRoleDto(role: CustomRole): CustomRoleDto {
  return {
    id: role.id,
    companyId: role.companyId,
    name: role.name,
    description: role.description,
    permissions: role.permissions,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}
