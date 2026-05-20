/**
 * User — kullanıcı entity.
 *
 * Immutable. `password_hash` burada YOK (security — hash'leri sadece
 * repository içinde dolaşır). `withRole`, `deactivate`, `recordLogin`
 * gibi davranışlar yeni instance üretir.
 */
import type { UserRole } from '../valueObjects/UserRole.js';

export interface UserProps {
  id: number;
  username: string;
  fullName: string | null;
  email: string | null;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export class User {
  private constructor(private readonly props: Readonly<UserProps>) {}

  static create(props: UserProps): User {
    if (props.id <= 0) throw new Error('User.id pozitif olmalı');
    if (props.username.trim().length === 0) throw new Error('User.username boş olamaz');
    if (props.username.length > 64) throw new Error('User.username 64 karakteri geçemez');
    return new User(props);
  }

  get id(): number {
    return this.props.id;
  }
  get username(): string {
    return this.props.username;
  }
  get fullName(): string | null {
    return this.props.fullName;
  }
  get email(): string | null {
    return this.props.email;
  }
  get role(): UserRole {
    return this.props.role;
  }
  get active(): boolean {
    return this.props.active;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get lastLoginAt(): Date | null {
    return this.props.lastLoginAt;
  }

  /** Login zamanını günceller — yeni instance döner. */
  recordLogin(now: Date): User {
    return new User({ ...this.props, lastLoginAt: now });
  }

  /** Devre dışı bırakır — yeni instance döner. */
  deactivate(): User {
    if (!this.props.active) return this;
    return new User({ ...this.props, active: false });
  }

  /** Rolünü değiştirir — yeni instance döner. */
  withRole(role: UserRole): User {
    if (this.props.role === role) return this;
    return new User({ ...this.props, role });
  }

  toJSON(): Readonly<UserProps> {
    return { ...this.props };
  }
}
