/**
 * PgUserRepository — UserRepository port'unun PostgreSQL implementasyonu.
 *
 * 'users' tablosunu okur/yazar. password_hash entity'de YOK (security);
 * findPasswordHashByUserId ayrı bir metot.
 */
import type { Pool } from 'pg';

import { User } from '../../domain/entities/User.js';
import type { UserRole } from '../../domain/valueObjects/UserRole.js';
import type { UserRepository } from '../../application/ports/UserRepository.js';

interface UserRow {
  id: number;
  username: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  active: boolean;
  created_at: Date;
  last_login_at: Date | null;
}

export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async findByUsername(username: string): Promise<User | null> {
    const r = await this.pool.query<UserRow>(
      `SELECT id, username, full_name, email, role, active, created_at, last_login_at
       FROM users WHERE username = $1 LIMIT 1`,
      [username],
    );
    return rowToUser(r.rows[0]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const r = await this.pool.query<UserRow>(
      `SELECT id, username, full_name, email, role, active, created_at, last_login_at
       FROM users WHERE email = $1 LIMIT 1`,
      [email.toLowerCase()],
    );
    return rowToUser(r.rows[0]);
  }

  async findById(id: number): Promise<User | null> {
    const r = await this.pool.query<UserRow>(
      `SELECT id, username, full_name, email, role, active, created_at, last_login_at
       FROM users WHERE id = $1 LIMIT 1`,
      [id],
    );
    return rowToUser(r.rows[0]);
  }

  async findPasswordHashByUserId(userId: number): Promise<string | null> {
    const r = await this.pool.query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    return r.rows[0]?.password_hash ?? null;
  }

  async updatePasswordHash(userId: number, newHash: string): Promise<void> {
    await this.pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, userId],
    );
  }

  async save(user: User): Promise<void> {
    const props = user.toJSON();
    await this.pool.query(
      `UPDATE users SET
         username = $1,
         full_name = $2,
         email = $3,
         role = $4,
         active = $5,
         last_login_at = $6,
         updated_at = NOW()
       WHERE id = $7`,
      [
        props.username,
        props.fullName,
        props.email,
        props.role,
        props.active,
        props.lastLoginAt,
        props.id,
      ],
    );
  }
}

function rowToUser(row: UserRow | undefined): User | null {
  if (!row) return null;
  return User.create({
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  });
}
