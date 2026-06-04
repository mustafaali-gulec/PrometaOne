/**
 * Permission — `resource.action` izin string'i için parse/validate yardımcısı.
 *
 * Katalog (Resources.ts) üzerinden doğrulanır: bilinmeyen resource veya o
 * resource için izin verilmeyen action InvalidPermissionError fırlatır.
 */
import { isAllowedAction, isKnownResource, RESOURCES } from '../catalog/Resources.js';

export class InvalidPermissionError extends Error {
  constructor(permission: string, reason: string) {
    super(`Geçersiz izin "${permission}": ${reason}`);
    this.name = 'InvalidPermissionError';
  }
}

export interface ParsedPermission {
  /** Tam izin string'i (örn 'hr.employees.view'). */
  permission: string;
  /** Resource kısmı (örn 'hr.employees'). */
  resource: string;
  /** Action kısmı (örn 'view'). */
  action: string;
}

/**
 * `resource.action` string'ini parçalar.
 * Son nokta'dan SONRASI action, ÖNCESİ resource'tur (legacy `can()` ile aynı).
 */
export function splitPermission(permission: string): { resource: string; action: string } {
  const parts = permission.split('.');
  if (parts.length < 2) {
    throw new InvalidPermissionError(permission, 'format "resource.action" olmalı');
  }
  const action = parts[parts.length - 1]!;
  const resource = parts.slice(0, -1).join('.');
  return { resource, action };
}

/** Geçerliyse ayrıştırılmış halini döner; değilse InvalidPermissionError fırlatır. */
export function parsePermission(permission: string): ParsedPermission {
  const { resource, action } = splitPermission(permission);
  if (!isKnownResource(resource)) {
    throw new InvalidPermissionError(permission, `bilinmeyen resource "${resource}"`);
  }
  if (!isAllowedAction(resource, action)) {
    throw new InvalidPermissionError(
      permission,
      `action "${action}" bu resource için tanımlı değil (izinli: ${RESOURCES[resource]!.actions.join(', ')})`,
    );
  }
  return { permission, resource, action };
}

/** Throw etmeden geçerlilik kontrolü. */
export function isValidPermission(permission: string): boolean {
  try {
    parsePermission(permission);
    return true;
  } catch {
    return false;
  }
}

/** Katalogdaki TÜM geçerli `resource.action` izinlerini düz liste olarak döner. */
export function allCatalogPermissions(): string[] {
  const out: string[] = [];
  for (const [resource, def] of Object.entries(RESOURCES)) {
    for (const action of def.actions) {
      out.push(`${resource}.${action}`);
    }
  }
  return out;
}
