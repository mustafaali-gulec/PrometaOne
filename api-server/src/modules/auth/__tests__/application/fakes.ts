/**
 * Test fixture'lari — in-memory implementasyonlar.
 */
import type { Clock } from '../../application/ports/Clock.js';
import type { PasswordHasher } from '../../application/ports/PasswordHasher.js';
import type {
  PasswordResetEmailSender,
  PasswordResetEmailSenderResult,
  SendPasswordResetEmailInput,
} from '../../application/ports/PasswordResetEmailSender.js';
import type {
  PasswordResetTokenRecord,
  PasswordResetTokenStore,
} from '../../application/ports/PasswordResetTokenStore.js';
import type {
  CreateRefreshSessionInput,
  RefreshSession,
  RefreshSessionStore,
} from '../../application/ports/RefreshSessionStore.js';
import type {
  AccessTokenPayload,
  IssuedTokens,
  RefreshTokenPayload,
  TokenIssuer,
} from '../../application/ports/TokenIssuer.js';
import type { UserRepository } from '../../application/ports/UserRepository.js';
import { User } from '../../domain/entities/User.js';
import type { Password } from '../../domain/valueObjects/Password.js';
import type { UserRole } from '../../domain/valueObjects/UserRole.js';

export function fakeClock(at: string = '2026-05-19T12:00:00Z'): Clock {
  return { now: () => new Date(at) };
}

export class InMemoryUserRepo implements UserRepository {
  public users: User[] = [];
  public passwordHashes = new Map<number, string>();

  static withSeed(
    overrides: Partial<{
      id: number;
      username: string;
      fullName: string | null;
      email: string | null;
      role: UserRole;
      active: boolean;
      passwordHash: string;
    }> = {},
  ): InMemoryUserRepo {
    const repo = new InMemoryUserRepo();
    const id = overrides.id ?? 1;
    repo.users.push(
      User.create({
        id,
        username: overrides.username ?? 'admin',
        fullName: overrides.fullName ?? 'Sistem Yoneticisi',
        email: overrides.email ?? 'admin@example.com',
        role: overrides.role ?? 'admin',
        active: overrides.active ?? true,
        createdAt: new Date('2026-05-19T09:00:00Z'),
        lastLoginAt: null,
      }),
    );
    if (overrides.passwordHash !== undefined) {
      repo.passwordHashes.set(id, overrides.passwordHash);
    }
    return repo;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.users.find((u) => u.username === username) ?? null;
  }
  async findByEmail(email: string): Promise<User | null> {
    const lower = email.toLowerCase();
    return this.users.find((u) => u.email?.toLowerCase() === lower) ?? null;
  }
  async findByEmailOrUsername(input: string): Promise<User | null> {
    const lower = input.toLowerCase();
    return (
      this.users.find(
        (u) => u.username === input || (u.email !== null && u.email.toLowerCase() === lower),
      ) ?? null
    );
  }
  async findById(id: number): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }
  async findPasswordHashByUserId(userId: number): Promise<string | null> {
    return this.passwordHashes.get(userId) ?? null;
  }
  async updatePasswordHash(userId: number, newHash: string): Promise<void> {
    this.passwordHashes.set(userId, newHash);
  }
  async save(user: User): Promise<void> {
    const i = this.users.findIndex((u) => u.id === user.id);
    if (i >= 0) this.users[i] = user;
    else this.users.push(user);
  }
}

export class FakePasswordHasher implements PasswordHasher {
  async hash(p: Password): Promise<string> {
    return `hash-of(${p.value})`;
  }
  async verify(plain: string, hash: string): Promise<boolean> {
    return hash === `hash-of(${plain})`;
  }
}

export class FakeTokenIssuer implements TokenIssuer {
  public lastJti = 0;
  issue(payload: AccessTokenPayload): IssuedTokens {
    this.lastJti += 1;
    const jti = `jti-${this.lastJti}`;
    return {
      accessToken: `access:${payload.sub}:${payload.role}`,
      refreshToken: `refresh:${payload.sub}:${jti}`,
      accessTokenTtlSeconds: 900,
      refreshTokenJti: jti,
    };
  }
  issueAccessToken(payload: AccessTokenPayload): { token: string; ttlSeconds: number } {
    return { token: `access:${payload.sub}:${payload.role}:refreshed`, ttlSeconds: 900 };
  }
  verifyRefreshToken(token: string): RefreshTokenPayload {
    const match = /^refresh:(\d+):(.+)$/.exec(token);
    if (!match) throw new Error('Bozuk refresh token');
    const sub = match[1];
    const jti = match[2];
    return { sub: Number(sub), jti: jti as string };
  }
}

export class InMemoryRefreshSessionStore implements RefreshSessionStore {
  public sessions: RefreshSession[] = [];

  async create(input: CreateRefreshSessionInput): Promise<void> {
    this.sessions.push({
      jti: input.jti,
      userId: input.userId,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      createdAt: new Date(),
      expiresAt: input.expiresAt,
      revokedAt: null,
    });
  }
  async findActiveWithHash(jti: string): Promise<RefreshSession | null> {
    return (
      this.sessions.find(
        (s) => s.jti === jti && s.revokedAt === null && s.expiresAt > new Date(),
      ) ?? null
    );
  }
  async revoke(jti: string): Promise<void> {
    const s = this.sessions.find((x) => x.jti === jti);
    if (s) s.revokedAt = new Date();
  }
  async revokeAllForUser(userId: number): Promise<void> {
    for (const s of this.sessions) {
      if (s.userId === userId && s.revokedAt === null) s.revokedAt = new Date();
    }
  }
}

export class InMemoryPasswordResetTokenStore implements PasswordResetTokenStore {
  public records: (PasswordResetTokenRecord & { emailSent: boolean })[] = [];

  async create(input: {
    userId: number;
    token: string;
    expiresAt: Date;
    ip?: string | undefined;
    userAgent?: string | undefined;
  }): Promise<void> {
    this.records.push({
      userId: input.userId,
      token: input.token,
      expiresAt: input.expiresAt,
      usedAt: null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      emailSent: false,
    });
  }
  async findActive(token: string): Promise<PasswordResetTokenRecord | null> {
    return (
      this.records.find(
        (r) => r.token === token && r.usedAt === null && r.expiresAt > new Date(),
      ) ?? null
    );
  }
  async findByToken(token: string): Promise<PasswordResetTokenRecord | null> {
    return this.records.find((r) => r.token === token) ?? null;
  }
  async markUsed(token: string): Promise<void> {
    const r = this.records.find((x) => x.token === token);
    if (r) r.usedAt = new Date();
  }
  async revokeUnusedForUser(userId: number): Promise<void> {
    for (const r of this.records) {
      if (r.userId === userId && r.usedAt === null) r.usedAt = new Date();
    }
  }
  async markEmailSent(token: string): Promise<void> {
    const r = this.records.find((x) => x.token === token);
    if (r) r.emailSent = true;
  }
}

export class FakeEmailSender implements PasswordResetEmailSender {
  public sent: SendPasswordResetEmailInput[] = [];
  public deliverResult: PasswordResetEmailSenderResult = { sent: true };

  async send(input: SendPasswordResetEmailInput): Promise<PasswordResetEmailSenderResult> {
    this.sent.push(input);
    return this.deliverResult;
  }
}

export const fakeSha256 = (s: string): string => `sha256(${s})`;
