/**
 * Auth HTTP route'lari — yeni use-case'leri cagirir.
 *
 * Eski routes/auth.ts'in birebir replacement'idir; URL'ler ve JSON shape'leri
 * ayni kalir (backward compatibility).
 *
 * Bu dosya use-case'leri yalnizca cagirir — is kurali YAZMAZ.
 * Cross-cutting concern'ler (audit logging) burada yapilir.
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Context } from 'hono';

import { authMiddleware } from '../../../middleware/auth.js';
import { logAudit } from '../../../middleware/audit.js';
import {
  AccountInactiveError,
  CurrentPasswordMismatchError,
  InvalidCredentialsError,
  InvalidPasswordResetTokenError,
  UserNotFoundError,
} from '../application/errors/AuthErrors.js';
import {
  InvalidTokenError,
  TokenExpiredError,
} from '../application/ports/TokenIssuer.js';
import { WeakPasswordError } from '../domain/valueObjects/Password.js';
import type { ChangePasswordUseCase } from '../application/useCases/ChangePasswordUseCase.js';
import type { GetCurrentUserUseCase } from '../application/useCases/GetCurrentUserUseCase.js';
import type { LoginUseCase } from '../application/useCases/LoginUseCase.js';
import type { LogoutAllSessionsUseCase } from '../application/useCases/LogoutAllSessionsUseCase.js';
import type { RefreshTokenUseCase } from '../application/useCases/RefreshTokenUseCase.js';
import type { RequestPasswordResetUseCase } from '../application/useCases/RequestPasswordResetUseCase.js';
import type { ResetPasswordUseCase } from '../application/useCases/ResetPasswordUseCase.js';
import type { VerifyPasswordResetTokenUseCase } from '../application/useCases/VerifyPasswordResetTokenUseCase.js';

export interface AuthRouterDeps {
  loginUseCase: LoginUseCase;
  refreshTokenUseCase: RefreshTokenUseCase;
  logoutAllSessionsUseCase: LogoutAllSessionsUseCase;
  getCurrentUserUseCase: GetCurrentUserUseCase;
  changePasswordUseCase: ChangePasswordUseCase;
  requestPasswordResetUseCase: RequestPasswordResetUseCase;
  resetPasswordUseCase: ResetPasswordUseCase;
  verifyPasswordResetTokenUseCase: VerifyPasswordResetTokenUseCase;
  exposeDevTokens: boolean;
}

/**
 * Header'lardan ip/userAgent cikartir. exactOptionalPropertyTypes ile uyumlu
 * olmasi icin alanlar conditional spread'le eklenir.
 */
function getClientMeta(c: Context): { ip?: string; userAgent?: string } {
  const ipHeader = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = c.req.header('user-agent');
  const out: { ip?: string; userAgent?: string } = {};
  if (ipHeader !== undefined && ipHeader !== '') out.ip = ipHeader;
  if (ua !== undefined && ua !== '') out.userAgent = ua;
  return out;
}

export function createAuthRouter(deps: AuthRouterDeps): Hono {
  const auth = new Hono();

  // =========================================================================
  // POST /login
  // =========================================================================
  auth.post(
    '/login',
    zValidator(
      'json',
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }),
    ),
    async (c) => {
      const { username, password } = c.req.valid('json');
      const meta = getClientMeta(c);

      try {
        const result = await deps.loginUseCase.execute({
          username,
          password,
          ...meta,
        });

        c.set('auth', {
          userId: result.user.id,
          username: result.user.username,
          role: result.user.role,
        });
        await logAudit(c, 'login', {
          ip: meta.ip ?? null,
          ua: meta.userAgent ?? null,
        });

        return c.json(result);
      } catch (err: unknown) {
        if (err instanceof InvalidCredentialsError) {
          throw new HTTPException(401, { message: err.message });
        }
        if (err instanceof AccountInactiveError) {
          throw new HTTPException(403, { message: err.message });
        }
        throw err;
      }
    },
  );

  // =========================================================================
  // POST /refresh
  // =========================================================================
  auth.post(
    '/refresh',
    zValidator('json', z.object({ refreshToken: z.string().min(1) })),
    async (c) => {
      const { refreshToken } = c.req.valid('json');
      try {
        const result = await deps.refreshTokenUseCase.execute({ refreshToken });
        return c.json(result);
      } catch (err: unknown) {
        if (
          err instanceof InvalidCredentialsError ||
          err instanceof InvalidTokenError ||
          err instanceof TokenExpiredError
        ) {
          throw new HTTPException(401, {
            message: 'Gecersiz veya suresi dolmus refresh token',
          });
        }
        if (err instanceof AccountInactiveError) {
          throw new HTTPException(403, { message: err.message });
        }
        throw err;
      }
    },
  );

  // =========================================================================
  // POST /logout
  // =========================================================================
  auth.post('/logout', authMiddleware, async (c) => {
    const authCtx = c.get('auth');
    await deps.logoutAllSessionsUseCase.execute({ userId: authCtx.userId });
    await logAudit(c, 'logout', {});
    return new Response(null, { status: 204 });
  });

  // =========================================================================
  // GET /me
  // =========================================================================
  auth.get('/me', authMiddleware, async (c) => {
    const authCtx = c.get('auth');
    try {
      const dto = await deps.getCurrentUserUseCase.execute({ userId: authCtx.userId });
      return c.json(dto);
    } catch (err: unknown) {
      if (err instanceof UserNotFoundError) {
        throw new HTTPException(404, { message: err.message });
      }
      throw err;
    }
  });

  // =========================================================================
  // POST /change-password
  // =========================================================================
  auth.post(
    '/change-password',
    authMiddleware,
    zValidator(
      'json',
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8, 'Sifre en az 8 karakter olmali'),
      }),
    ),
    async (c) => {
      const authCtx = c.get('auth');
      const { currentPassword, newPassword } = c.req.valid('json');

      try {
        await deps.changePasswordUseCase.execute({
          userId: authCtx.userId,
          currentPassword,
          newPassword,
        });
        await logAudit(c, 'password_change', {});
        return new Response(null, { status: 204 });
      } catch (err: unknown) {
        if (err instanceof CurrentPasswordMismatchError) {
          throw new HTTPException(400, { message: err.message });
        }
        if (err instanceof InvalidCredentialsError) {
          throw new HTTPException(404, { message: 'Kullanici bulunamadi' });
        }
        if (err instanceof WeakPasswordError) {
          throw new HTTPException(400, { message: err.message });
        }
        throw err;
      }
    },
  );

  // =========================================================================
  // POST /forgot-password
  // =========================================================================
  auth.post(
    '/forgot-password',
    zValidator(
      'json',
      z.object({
        emailOrUsername: z.string().min(1),
        lang: z.enum(['tr', 'en', 'de', 'ar']).optional(),
      }),
    ),
    async (c) => {
      const { emailOrUsername, lang } = c.req.valid('json');
      const meta = getClientMeta(c);

      const result = await deps.requestPasswordResetUseCase.execute({
        emailOrUsername,
        ...(lang !== undefined ? { lang } : {}),
        ...meta,
      });

      if (result === null) {
        console.log(
          `[ForgotPassword] eligible olmayan giris: ${emailOrUsername} (IP: ${meta.ip ?? 'unknown'})`,
        );
        return c.json({
          success: true,
          message: 'Eger bu kullanici varsa, e-posta gonderildi.',
        });
      }

      await logAudit(c, 'password_reset_requested', {
        emailOrUsername,
        emailSent: result.emailSent,
      });

      return c.json({
        success: true,
        emailSent: result.emailSent,
        ...(deps.exposeDevTokens ? { _devToken: result.token } : {}),
      });
    },
  );

  // =========================================================================
  // POST /reset-password
  // =========================================================================
  auth.post(
    '/reset-password',
    zValidator(
      'json',
      z.object({
        token: z.string().min(4).max(128),
        newPassword: z.string().min(6).max(128),
      }),
    ),
    async (c) => {
      const { token, newPassword } = c.req.valid('json');
      try {
        await deps.resetPasswordUseCase.execute({ token, newPassword });
        await logAudit(c, 'password_reset_completed', {});
        return c.json({ success: true });
      } catch (err: unknown) {
        if (err instanceof InvalidPasswordResetTokenError) {
          throw new HTTPException(400, { message: 'Gecersiz veya suresi dolmus kod' });
        }
        if (err instanceof WeakPasswordError) {
          throw new HTTPException(400, { message: err.message });
        }
        throw err;
      }
    },
  );

  // =========================================================================
  // GET /verify-reset-token?token=xxx
  // =========================================================================
  auth.get('/verify-reset-token', async (c) => {
    const token = c.req.query('token');
    if (!token) {
      throw new HTTPException(400, { message: 'Token gerekli' });
    }
    return c.json(await deps.verifyPasswordResetTokenUseCase.execute({ token }));
  });

  return auth;
}
