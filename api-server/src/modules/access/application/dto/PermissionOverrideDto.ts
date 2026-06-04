/**
 * PermissionOverrideDto — REST response için.
 */
import type { PermissionOverride } from '../../domain/entities/PermissionOverride.js';

export interface PermissionOverrideDto {
  id: number;
  companyId: number;
  username: string;
  resource: string;
  action: string;
  allow: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toPermissionOverrideDto(o: PermissionOverride): PermissionOverrideDto {
  return {
    id: o.id,
    companyId: o.companyId,
    username: o.username,
    resource: o.resource,
    action: o.action,
    allow: o.allow,
    expiresAt: o.expiresAt === null ? null : o.expiresAt.toISOString(),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}
