/**
 * Access modülünde fırlatılan typed error'lar.
 * Presentation katmanı bunları uygun HTTP status'a çevirir (errorMapping.ts).
 */

export class CustomRoleNotFoundError extends Error {
  constructor(roleId: number) {
    super(`Özel rol bulunamadı (id=${roleId})`);
    this.name = 'CustomRoleNotFoundError';
  }
}

export class DuplicateRoleNameError extends Error {
  constructor(name: string) {
    super(`Bu şirkette "${name}" adında bir rol zaten var`);
    this.name = 'DuplicateRoleNameError';
  }
}

export class RoleGrantNotFoundError extends Error {
  constructor(grantId: number) {
    super(`Rol ataması bulunamadı (id=${grantId})`);
    this.name = 'RoleGrantNotFoundError';
  }
}

export class OverrideNotFoundError extends Error {
  constructor(overrideId: number) {
    super(`İzin override'ı bulunamadı (id=${overrideId})`);
    this.name = 'OverrideNotFoundError';
  }
}

/**
 * Geçersiz `resource.action` (bilinmeyen resource veya o resource için izinsiz
 * action). Not: domain/valueObjects/Permission.ts'deki InvalidPermissionError de
 * 400'e maplenir; bu sınıf application katmanı için ek bir saramadır.
 */
export class InvalidPermissionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPermissionInputError';
  }
}
