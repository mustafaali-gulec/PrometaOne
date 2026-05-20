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

  /** Sadece kullanılmamış + süresi geçmemiş kayıtları döner. */
  findActive(token: string): Promise<PasswordResetTokenRecord | null>;

  /**
   * State'e bakmadan ham kaydı döner (verify-reset-token akışı için —
   * "not_found / used / expired" ayrımı yapılabilsin diye).
   */
  findByToken(token: string): Promise<PasswordResetTokenRecord | null>;

  markUsed(token: string): Promise<void>;

  /**
   * Bir kullanıcının kullanılmamış (eski) reset token'larını revoke eder.
   * forgot-password ardışık çağrılarında eski kodları geçersizleştirmek için.
   */
  revokeUnusedForUser(userId: number): Promise<void>;

  /** Email gönderim durumunu işaretle (audit / loglama için). */
  markEmailSent(token: string): Promise<void>;
}
