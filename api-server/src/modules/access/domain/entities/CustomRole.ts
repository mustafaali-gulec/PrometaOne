/**
 * CustomRole — şirkete özel bir rol tanımı.
 *
 * Immutable. permissions, katalog'a karşı doğrulanan `resource.action`
 * string'lerinin (sıralı, tekrarsız) listesidir. Davranışlar yeni instance döner.
 */
import { parsePermission } from '../valueObjects/Permission.js';

export interface CustomRoleProps {
  id: number;
  companyId: number;
  name: string;
  description: string | null;
  permissions: ReadonlyArray<string>;
  createdAt: Date;
  updatedAt: Date;
}

export class CustomRole {
  private constructor(private readonly props: Readonly<CustomRoleProps>) {}

  static create(props: CustomRoleProps): CustomRole {
    if (props.id <= 0) {
      throw new Error('CustomRole.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('CustomRole.companyId pozitif olmalı');
    }
    if (props.name.trim().length === 0) {
      throw new Error('CustomRole.name boş olamaz');
    }
    // Tüm izinleri katalog'a karşı doğrula (geçersizse InvalidPermissionError)
    for (const p of props.permissions) {
      parsePermission(p);
    }
    return new CustomRole({
      ...props,
      permissions: normalizePermissions(props.permissions),
    });
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string | null {
    return this.props.description;
  }
  get permissions(): ReadonlyArray<string> {
    return this.props.permissions;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  hasPermission(permission: string): boolean {
    return this.props.permissions.includes(permission);
  }

  /** Adı / açıklamayı günceller — yeni instance döner. */
  rename(name: string, description: string | null, now: Date): CustomRole {
    if (name.trim().length === 0) {
      throw new Error('CustomRole.name boş olamaz');
    }
    return new CustomRole({ ...this.props, name, description, updatedAt: now });
  }

  /** İzin ekler (katalog'a karşı doğrular) — yeni instance döner. */
  addPermission(permission: string, now: Date): CustomRole {
    parsePermission(permission);
    if (this.props.permissions.includes(permission)) {
      return new CustomRole({ ...this.props, updatedAt: now });
    }
    return new CustomRole({
      ...this.props,
      permissions: normalizePermissions([...this.props.permissions, permission]),
      updatedAt: now,
    });
  }

  /** İzin çıkarır — yeni instance döner. */
  removePermission(permission: string, now: Date): CustomRole {
    return new CustomRole({
      ...this.props,
      permissions: this.props.permissions.filter((p) => p !== permission),
      updatedAt: now,
    });
  }

  /** İzin setini tümüyle değiştirir (katalog'a karşı doğrular) — yeni instance döner. */
  replacePermissions(permissions: ReadonlyArray<string>, now: Date): CustomRole {
    for (const p of permissions) {
      parsePermission(p);
    }
    return new CustomRole({
      ...this.props,
      permissions: normalizePermissions(permissions),
      updatedAt: now,
    });
  }

  toJSON(): Readonly<CustomRoleProps> {
    return { ...this.props };
  }
}

/** Tekrarsız + sıralı izin dizisi üretir (kararlı karşılaştırma için). */
function normalizePermissions(permissions: ReadonlyArray<string>): ReadonlyArray<string> {
  return [...new Set(permissions)].sort();
}
