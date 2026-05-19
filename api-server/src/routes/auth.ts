/**
 * Auth route'ları.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { pool, queryOne } from "../db.js";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  getAccessTokenTTL,
  createRefreshSession,
  validateRefreshSession,
  revokeAllUserSessions,
} from "../services/auth.js";
import { authMiddleware } from "../middleware/auth.js";
import { logAudit } from "../middleware/audit.js";
import type { User } from "../types.js";

const auth = new Hono();

// =========== LOGIN ===========
auth.post(
  "/login",
  zValidator("json", z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  })),
  async (c) => {
    const { username, password } = c.req.valid("json");
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = c.req.header("user-agent") ?? null;

    const user = await queryOne<any>(
      `SELECT id, username, password_hash, full_name, email, role, active, created_at, last_login_at
       FROM users WHERE username = $1`,
      [username]
    );

    if (!user || !user.active) {
      throw new HTTPException(401, { message: "Geçersiz kullanıcı adı veya şifre" });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      throw new HTTPException(401, { message: "Geçersiz kullanıcı adı veya şifre" });
    }

    // Token üret
    const accessToken = signAccessToken({
      sub: user.id,
      username: user.username,
      role: user.role,
    });
    const { token: refreshToken } = await createRefreshSession(user.id, ip ?? undefined, ua ?? undefined);

    // last_login güncelle
    await pool.query(
      `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
      [user.id]
    );

    // Audit
    c.set("auth", { userId: user.id, username: user.username, role: user.role });
    await logAudit(c, "login", { ip, ua });

    return c.json({
      accessToken,
      refreshToken,
      expiresIn: getAccessTokenTTL(),
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        active: user.active,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      } as User,
    });
  }
);

// =========== REFRESH ===========
auth.post(
  "/refresh",
  zValidator("json", z.object({ refreshToken: z.string().min(1) })),
  async (c) => {
    const { refreshToken } = c.req.valid("json");

    let session;
    try {
      session = await validateRefreshSession(refreshToken);
    } catch (err: any) {
      throw new HTTPException(401, { message: err.message ?? "Geçersiz refresh token" });
    }

    // User bilgilerini tekrar al (rol değişmiş olabilir)
    const user = await queryOne<any>(
      `SELECT id, username, role, active FROM users WHERE id = $1`,
      [session.userId]
    );
    if (!user || !user.active) {
      throw new HTTPException(401, { message: "Kullanıcı aktif değil" });
    }

    const accessToken = signAccessToken({
      sub: user.id,
      username: user.username,
      role: user.role,
    });

    return c.json({
      accessToken,
      expiresIn: getAccessTokenTTL(),
    });
  }
);

// =========== LOGOUT ===========
auth.post("/logout", authMiddleware, async (c) => {
  const authCtx = c.get("auth");
  // Tüm session'ları kapat (basit yaklaşım); spesifik bir session kapatmak istersek
  // refresh token'ı body'den alıp jti'ye göre kapatabiliriz
  await revokeAllUserSessions(authCtx.userId);
  await logAudit(c, "logout", {});
  return new Response(null, { status: 204 });
});

// =========== ME ===========
auth.get("/me", authMiddleware, async (c) => {
  const authCtx = c.get("auth");
  const user = await queryOne<any>(
    `SELECT id, username, full_name, email, role, active, created_at, last_login_at
     FROM users WHERE id = $1`,
    [authCtx.userId]
  );
  if (!user) {
    throw new HTTPException(404, { message: "Kullanıcı bulunamadı" });
  }
  return c.json({
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    active: user.active,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
  });
});

// =========== CHANGE PASSWORD ===========
auth.post(
  "/change-password",
  authMiddleware,
  zValidator("json", z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, "Şifre en az 8 karakter olmalı"),
  })),
  async (c) => {
    const authCtx = c.get("auth");
    const { currentPassword, newPassword } = c.req.valid("json");

    const user = await queryOne<any>(
      `SELECT password_hash FROM users WHERE id = $1`,
      [authCtx.userId]
    );
    if (!user) {
      throw new HTTPException(404, { message: "Kullanıcı bulunamadı" });
    }

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
      throw new HTTPException(400, { message: "Mevcut şifre hatalı" });
    }

    const newHash = await hashPassword(newPassword);
    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [newHash, authCtx.userId]
    );

    // Güvenlik için tüm session'ları iptal et — kullanıcı tekrar login olmalı
    await revokeAllUserSessions(authCtx.userId);
    await logAudit(c, "password_change", {});

    return new Response(null, { status: 204 });
  }
);

// =========== FORGOT PASSWORD — TOKEN İSTE ===========
// POST /v1/auth/forgot-password
// Body: { emailOrUsername: string, lang?: "tr" | "en" | "de" | "ar" }
//
// Güvenlik notu: Email var/yok bilgisini ifşa etmemek için her zaman
// 200 OK döner (rate limit ayrıca uygulanmalı reverse proxy seviyesinde).
auth.post(
  "/forgot-password",
  zValidator("json", z.object({
    emailOrUsername: z.string().min(1),
    lang: z.enum(["tr", "en", "de", "ar"]).optional(),
  })),
  async (c) => {
    const { emailOrUsername, lang } = c.req.valid("json");
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = c.req.header("user-agent") ?? null;

    // Kullanıcı bul (username VEYA email ile)
    const user = await queryOne<any>(
      `SELECT id, username, full_name, email, active
       FROM users
       WHERE (username = $1 OR LOWER(email) = LOWER($1)) AND active = true
       LIMIT 1`,
      [emailOrUsername]
    );

    // Güvenlik: kullanıcı bulunamazsa bile aynı yanıtı döner
    if (!user) {
      // Bilgi sızdırmayı engelle — saldırgan email var/yok ayırt edemesin
      // Yine de log tutalım
      console.log(`[ForgotPassword] Bulunamadı: ${emailOrUsername} (IP: ${ip})`);
      return c.json({
        success: true,
        message: "Eğer bu kullanıcı varsa, e-posta gönderildi.",
      });
    }

    // 6 haneli token üret
    const token = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 dk

    // Aynı kullanıcının eski (kullanılmamış) tokenlerini iptal et
    await pool.query(
      `UPDATE password_resets SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [user.id]
    );

    // Yeni token kaydet
    await pool.query(
      `INSERT INTO password_resets (user_id, token, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, token, expiresAt, ip, ua]
    );

    // Email gönder (eğer kullanıcının email'i varsa)
    let emailSent = false;
    if (user.email) {
      const { sendMail, buildPasswordResetEmail } = await import("../services/mailer.js");
      const mailContent = buildPasswordResetEmail({
        fullName: user.full_name || user.username,
        token,
        expiresInMinutes: 15,
        lang: lang || "tr",
        ...(process.env.APP_URL ? { resetUrl: `${process.env.APP_URL}/reset-password?token=${token}` } : {}),
      });

      const result = await sendMail({
        to: user.email,
        subject: mailContent.subject,
        html: mailContent.html,
        text: mailContent.text,
      });

      emailSent = result.success;
      if (emailSent) {
        await pool.query(
          `UPDATE password_resets SET email_sent = true WHERE token = $1`,
          [token]
        );
      } else {
        console.error("Email gönderilemedi:", result.error);
      }
    }

    await logAudit(c, "password_reset_requested", {
      userId: user.id,
      username: user.username,
      emailSent,
    });

    return c.json({
      success: true,
      emailSent,
      // Demo modunda token'i de döndürebiliriz (production'da ASLA!)
      ...(process.env.NODE_ENV === "development" ? { _devToken: token } : {}),
    });
  }
);

// =========== RESET PASSWORD — TOKEN İLE YENİ ŞİFRE ===========
// POST /v1/auth/reset-password
// Body: { token: string, newPassword: string }
auth.post(
  "/reset-password",
  zValidator("json", z.object({
    token: z.string().min(4).max(64),
    newPassword: z.string().min(6).max(128),
  })),
  async (c) => {
    const { token, newPassword } = c.req.valid("json");

    // Token'ı bul + geçerlilik kontrolü
    const reset = await queryOne<any>(
      `SELECT id, user_id, expires_at, used_at
       FROM password_resets
       WHERE token = $1`,
      [token]
    );

    if (!reset) {
      throw new HTTPException(400, { message: "Geçersiz kod" });
    }
    if (reset.used_at) {
      throw new HTTPException(400, { message: "Bu kod daha önce kullanıldı" });
    }
    if (new Date(reset.expires_at) < new Date()) {
      throw new HTTPException(400, { message: "Kodun süresi doldu" });
    }

    // Şifreyi güncelle
    const newHash = await hashPassword(newPassword);
    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [newHash, reset.user_id]
    );

    // Token'ı kullanılmış olarak işaretle
    await pool.query(
      `UPDATE password_resets SET used_at = NOW() WHERE id = $1`,
      [reset.id]
    );

    // Güvenlik: kullanıcının tüm aktif session'larını iptal et
    await revokeAllUserSessions(reset.user_id);

    await logAudit(c, "password_reset_completed", {
      userId: reset.user_id,
    });

    return c.json({ success: true });
  }
);

// =========== VERIFY TOKEN — KONTROL ===========
// GET /v1/auth/verify-reset-token?token=xxx
// Reset ekranında token formunda doğrulama için
auth.get("/verify-reset-token", async (c) => {
  const token = c.req.query("token");
  if (!token) {
    throw new HTTPException(400, { message: "Token gerekli" });
  }

  const reset = await queryOne<any>(
    `SELECT id, expires_at, used_at
     FROM password_resets
     WHERE token = $1`,
    [token]
  );

  if (!reset) return c.json({ valid: false, reason: "not_found" });
  if (reset.used_at) return c.json({ valid: false, reason: "used" });
  if (new Date(reset.expires_at) < new Date()) return c.json({ valid: false, reason: "expired" });

  return c.json({ valid: true });
});

export default auth;
