/**
 * RefreshSessionStore — refresh token oturumlarının kalıcılığı.
 *
 * Her refresh token (jti) DB'de bir kayda denktir. Logout veya rotation'da
 * silinir/işaretlenir. Bir refresh token sadece bir kez kullanılabilir
 * (rotation pattern).
 */

export interface RefreshSession {
  jti: string;
  userId: number;
  /** Token'ın IP/UA gibi metadata'sı (audit için). */
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface RefreshSessionStore {
  create(input: {
    jti: string;
    userId: number;
    ip?: string | undefined;
    userAgent?: string | undefined;
    expiresAt: Date;
  }): Promise<void>;

  findActive(jti: string): Promise<RefreshSession | null>;
  revoke(jti: string): Promise<void>;
  revokeAllForUser(userId: number): Promise<void>;
}
