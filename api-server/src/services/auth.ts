/**
 * Auth servisi: JWT üretme, password hashing.
 */
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import crypto from "node:crypto";
import { config } from "../config.js";
import { pool } from "../db.js";
import type { UserRole } from "../types.js";

interface TokenPayload {
  sub: number;
  username: string;
  role: UserRole;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, config.BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signAccessToken(payload: TokenPayload): string {
  const options = {
    expiresIn: config.JWT_ACCESS_EXPIRES,
    issuer: "promet-cf",
  } as SignOptions;
  return jwt.sign(payload, config.JWT_SECRET, options);
}

export function signRefreshToken(payload: { sub: number; jti: string }): string {
  const options = {
    expiresIn: config.JWT_REFRESH_EXPIRES,
    issuer: "promet-cf",
  } as SignOptions;
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, options);
}

export function verifyRefreshToken(token: string): { sub: number; jti: string } {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as unknown as { sub: number; jti: string };
}

/** Access token TTL (saniye) */
export function getAccessTokenTTL(): number {
  const expires = config.JWT_ACCESS_EXPIRES;
  const match = expires.match(/^(\d+)([smhd])$/);
  if (!match) return 900;
  const [, num, unit] = match;
  const n = Number(num);
  switch (unit) {
    case "s": return n;
    case "m": return n * 60;
    case "h": return n * 3600;
    case "d": return n * 86400;
    default: return 900;
  }
}

/** Refresh token oluştur ve DB'ye kaydet */
export async function createRefreshSession(
  userId: number,
  ipAddress?: string,
  userAgent?: string
): Promise<{ token: string; sessionId: string }> {
  const sessionId = crypto.randomUUID();
  const token = signRefreshToken({ sub: userId, jti: sessionId });
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  // Expires: 7 gün (refresh token TTL ile uyumlu)
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

  await pool.query(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sessionId, userId, tokenHash, ipAddress, userAgent, expiresAt]
  );

  return { token, sessionId };
}

/** Refresh token'ı doğrula ve aktif session olduğunu kontrol et */
export async function validateRefreshSession(
  token: string
): Promise<{ userId: number; sessionId: string }> {
  const payload = verifyRefreshToken(token);
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const result = await pool.query(
    `SELECT id FROM sessions
     WHERE id = $1 AND user_id = $2 AND refresh_token_hash = $3
       AND expires_at > NOW() AND revoked_at IS NULL`,
    [payload.jti, payload.sub, tokenHash]
  );

  if (result.rowCount === 0) {
    throw new Error("Geçersiz veya iptal edilmiş oturum");
  }

  return { userId: payload.sub, sessionId: payload.jti };
}

/** Session'ı iptal et (logout) */
export async function revokeSession(sessionId: string): Promise<void> {
  await pool.query(
    `UPDATE sessions SET revoked_at = NOW() WHERE id = $1`,
    [sessionId]
  );
}

/** Kullanıcının tüm aktif session'larını iptal et (şifre değişikliği sonrası) */
export async function revokeAllUserSessions(userId: number): Promise<void> {
  await pool.query(
    `UPDATE sessions SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}
