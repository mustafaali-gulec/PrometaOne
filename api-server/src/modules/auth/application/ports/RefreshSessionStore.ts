/**
 * RefreshSessionStore — refresh token oturumlarının kalıcılığı.
 *
 * Güvenlik: token'ın KENDİSİ değil, SHA-256 hash'i DB'de saklanır.
 * Validate sırasında store, sağlanan hash ile DB'deki hash'i karşılaştırır.
 * Bu sayede DB sızıntısında token'lar aktive edilemez.
 */

export interface RefreshSession {
  jti: string;
  userId: number;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface CreateRefreshSessionInput {
  jti: string;
  userId: number;
  /** SHA-256 hex hash'i; raw token store edilmez. */
  refreshTokenHash: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
  expiresAt: Date;
}

export interface RefreshSessionStore {
  create(input: CreateRefreshSessionInput): Promise<void>;

  /**
   * jti + token hash kombinasyonuyla aktif (revoked değil, expired değil)
   * session bulur. Bulamazsa null.
   */
  findActiveWithHash(jti: string, refreshTokenHash: string): Promise<RefreshSession | null>;

  revoke(jti: string): Promise<void>;
  revokeAllForUser(userId: number): Promise<void>;
}
