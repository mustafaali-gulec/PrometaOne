/**
 * JWT authentication middleware — monolit (auth servisi) ile AYNI JWT_SECRET'i
 * kullanarak token'ı stateless doğrular. Authorization: Bearer <token> bekler.
 */
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';

import { config } from '../config.js';
import { canRole, type AuthContext, type UserRole } from '../types.js';

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

interface JwtPayloadShape {
  sub: number | string;
  username?: string;
  role?: UserRole;
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Authorization header eksik veya hatalı' });
  }
  const token = authHeader.slice(7);

  let payload: JwtPayloadShape;
  try {
    payload = jwt.verify(token, config.JWT_SECRET) as JwtPayloadShape;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      throw new HTTPException(401, { message: 'Token süresi doldu', cause: { code: 'TOKEN_EXPIRED' } });
    }
    throw new HTTPException(401, { message: 'Geçersiz token' });
  }

  if (!payload || typeof payload !== 'object' || payload.sub === undefined || payload.sub === null) {
    throw new HTTPException(401, { message: 'Token formatı geçersiz' });
  }

  c.set('auth', {
    userId: Number(payload.sub),
    username: payload.username ?? '',
    role: payload.role ?? 'viewer',
  });

  await next();
};

/**
 * Minimum rol veya verilen rollerden HERHANGI BİRİ gerektirir.
 *   requireRole('editor')          → editor veya üstü (hiyerarşik)
 *   requireRole(['admin','cfo'])   → admin VEYA cfo (sadece bu ikisi)
 */
export function requireRole(roleOrRoles: UserRole | UserRole[]): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.get('auth');
    if (!auth) throw new HTTPException(401, { message: 'Yetkilendirme gerekli' });

    if (Array.isArray(roleOrRoles)) {
      if (!roleOrRoles.includes(auth.role)) {
        throw new HTTPException(403, {
          message: `Bu işlem için şu rollerden biri gerekli: ${roleOrRoles.join(', ')}`,
        });
      }
    } else if (!canRole(auth.role, roleOrRoles)) {
      throw new HTTPException(403, { message: `Bu işlem için en az '${roleOrRoles}' rolü gerekli` });
    }
    await next();
  };
}
