/**
 * JWT authentication middleware.
 * Authorization: Bearer <token> header'ını bekler.
 * Geçerliyse context'e auth bilgilerini ekler.
 */
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';

import { config } from '../config.js';
import { canRole } from '../types.js';
import type { AuthContext, UserRole } from '../types.js';

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
      throw new HTTPException(401, {
        message: 'Token süresi doldu',
        cause: { code: 'TOKEN_EXPIRED' },
      });
    }
    throw new HTTPException(401, { message: 'Geçersiz token' });
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    payload.sub === undefined ||
    payload.sub === null
  ) {
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
 * `authMiddleware`'in eski API ismi. Geriye uyumluluk için tutuluyor.
 * Yeni kodda `authMiddleware` kullanın.
 */
export const requireAuth = authMiddleware;

/**
 * Minimum rol veya verilen rollerden HERHANGI BİRİ gerektirir.
 *
 * @example
 *   requireRole('editor')           // editor veya üstü
 *   requireRole(['admin', 'cfo'])   // admin VEYA cfo (sadece bu ikisi)
 */
export function requireRole(roleOrRoles: UserRole | UserRole[]): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.get('auth');
    if (!auth) {
      throw new HTTPException(401, { message: 'Yetkilendirme gerekli' });
    }

    if (Array.isArray(roleOrRoles)) {
      // OR: kullanıcının rolü listenin herhangi birine eşit olmalı
      if (!roleOrRoles.includes(auth.role)) {
        throw new HTTPException(403, {
          message: `Bu işlem için şu rollerden biri gerekli: ${roleOrRoles.join(', ')}`,
        });
      }
    } else {
      // Hiyerarşik: kullanıcının rolü minRole veya üstü olmalı
      if (!canRole(auth.role, roleOrRoles)) {
        throw new HTTPException(403, {
          message: `Bu işlem için en az '${roleOrRoles}' rolü gerekli`,
        });
      }
    }
    await next();
  };
}

/** Şirket erişim kontrolü (user_company_access tablosuna bakar) */
export function requireCompanyAccess(minRole: UserRole = 'viewer'): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.get('auth');
    if (!auth) throw new HTTPException(401, { message: 'Yetki gerekli' });

    const cidParam = c.req.param('cid') ?? c.req.query('companyId');
    const cid = Number(cidParam);
    if (!cid || isNaN(cid)) {
      throw new HTTPException(400, { message: 'Geçersiz şirket ID' });
    }

    // Admin tüm şirketlere erişir
    if (auth.role === 'admin') {
      c.set('auth', { ...auth, companyId: cid });
      return next();
    }

    // user_company_access tablosundan kontrol
    const { queryOne } = await import('../db.js');
    const access = await queryOne<{ role: UserRole }>(
      `SELECT role FROM user_company_access
       WHERE user_id = $1 AND company_id = $2`,
      [auth.userId, cid],
    );

    if (!access) {
      throw new HTTPException(403, { message: 'Bu şirkete erişim yetkiniz yok' });
    }
    if (!canRole(access.role, minRole)) {
      throw new HTTPException(403, {
        message: `Bu işlem için bu şirkette en az '${minRole}' rolü gerekli`,
      });
    }

    c.set('auth', { ...auth, role: access.role, companyId: cid });
    await next();
  };
}
