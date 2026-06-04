/**
 * PermissionOverride — bir kullanıcı için tekil `resource.action` allow/deny.
 *
 * deny (allow=false) PermissionResolver içinde her zaman önceliklidir.
 * expiresAt geçmişse override yok sayılır.
 *
 * Immutable.
 */
import { parsePermission } from '../valueObjects/Permission.js';

export interface PermissionOverrideProps {
  id: number;
  companyId: number;
  username: string;
  resource: string;
  action: string;
  allow: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PermissionOverride {
  private constructor(private readonly props: Readonly<PermissionOverrideProps>) {}

  static create(props: PermissionOverrideProps): PermissionOverride {
    if (props.id <= 0) {
      throw new Error('PermissionOverride.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('PermissionOverride.companyId pozitif olmalı');
    }
    if (props.username.trim().length === 0) {
      throw new Error('PermissionOverride.username boş olamaz');
    }
    // resource.action katalog'a karşı doğrula
    parsePermission(`${props.resource}.${props.action}`);
    return new PermissionOverride(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get username(): string {
    return this.props.username;
  }
  get resource(): string {
    return this.props.resource;
  }
  get action(): string {
    return this.props.action;
  }
  get allow(): boolean {
    return this.props.allow;
  }
  get expiresAt(): Date | null {
    return this.props.expiresAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Override verilen anda hâlâ geçerli mi (süresi dolmamış mı)? */
  isActiveAt(now: Date): boolean {
    if (this.props.expiresAt !== null && this.props.expiresAt.getTime() < now.getTime()) {
      return false;
    }
    return true;
  }

  toJSON(): Readonly<PermissionOverrideProps> {
    return { ...this.props };
  }
}
