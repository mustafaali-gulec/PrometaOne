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
  companies?: number[];
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
    ...(Array.isArray(payload.companies) ? { companies: payload.companies } : {}),
  });

  await next();
};

/**
 * Çapraz-tenant koruması: istenen companyId, kullanıcının erişebileceği
 * şirketler (`auth.companies`, access-token'daki claim) içinde olmalı.
 * companyId query'de (GET/DELETE) ya da JSON gövdede (POST/PATCH/PUT) taşınır.
 *
 * requireCompanyAccess'ten farkı: bu guard DB SORGUSU YAPMAZ (token claim'ini
 * kullanır) ve companyId'yi GÖVDEDEN de okur → yeni Clean-Arch modüllerinin
 * (hr/warehouse/production/purchasing/finance/...) body-companyId route'larıyla
 * uyumludur. Şirket-kapsamlı modül router'larına app.use('*', ...) ile takılır.
 *
 * - admin → sınırsız (bypass).
 * - `companies` claim'i YOKSA (eski token / geçiş dönemi) → geçici izin
 *   (rollout kırılmasın; token yenilenince tam aktif).
 * - companyId çıkarılamıyorsa (companyId'siz route) → geç (route/zValidator ele alır).
 * - Aksi hâlde üyelik zorunlu; değilse 403.
 */
export const companyScopeGuard: MiddlewareHandler = async (c, next) => {
  const auth = c.get('auth');
  if (!auth) throw new HTTPException(401, { message: 'Yetkilendirme gerekli' });
  if (auth.role === 'admin') return next();
  if (auth.companies === undefined) return next(); // geçiş dönemi (claim'siz token)

  let cid: number | null = null;
  const q = c.req.query('companyId');
  if (q != null && q !== '') {
    cid = Number(q);
  } else {
    const m = c.req.method;
    if (m === 'POST' || m === 'PATCH' || m === 'PUT') {
      try {
        const body = (await c.req.json()) as { companyId?: unknown } | null;
        if (body != null && body.companyId != null) cid = Number(body.companyId);
      } catch {
        cid = null; // JSON değil → route zaten reddeder
      }
    }
  }

  if (cid === null || Number.isNaN(cid)) return next(); // companyId'siz route → route/zValidator ele alır
  if (!auth.companies.includes(cid)) {
    throw new HTTPException(403, { message: 'Bu şirkete erişim yetkiniz yok' });
  }
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
