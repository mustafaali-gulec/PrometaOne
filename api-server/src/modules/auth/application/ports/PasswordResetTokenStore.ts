/**
 * PasswordResetTokenStore — şifre sıfırlama token'larını saklar.
 * password_resets tablosu (migration 010).
 */

export interface PasswordResetTokenRecord {
  userId: number;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
  ip: string | null;
  userAgent: string | null;
}

export interface PasswordResetTokenStore {
  create(input: {
    userId: number;
    token: string;
    expiresAt: Date;
    ip?: string | undefined;
    userAgent?: string | undefined;
  }): Promise<void>;

  findActive(token: string): Promise<PasswordResetTokenRecord | null>;
  markUsed(token: string): Promise<void>;
}
