/**
 * JWT authentication middleware.
 * Authorization: Bearer <token> header'ını bekler.
 * Geçerliyse context'e auth bilgilerini ekler.
 */
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import type { AuthContext, UserRole } from "../types.js";
import { canRole } from "../types.js";

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Authorization header eksik veya hatalı" });
  }
  const token = authHeader.slice(7);

  let payload: any;
  try {
    payload = jwt.verify(token, config.JWT_SECRET);
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      throw new HTTPException(401, { message: "Token süresi doldu", cause: { code: "TOKEN_EXPIRED" } });
    }
    throw new HTTPException(401, { message: "Geçersiz token" });
  }

  if (!payload || typeof payload !== "object" || !payload.sub) {
    throw new HTTPException(401, { message: "Token formatı geçersiz" });
  }

  c.set("auth", {
    userId: Number(payload.sub),
    username: payload.username,
    role: payload.role as UserRole,
  });

  await next();
};

/** Minimum rol gerektirir */
export function requireRole(minRole: UserRole): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.get("auth");
    if (!auth) {
      throw new HTTPException(401, { message: "Yetkilendirme gerekli" });
    }
    if (!canRole(auth.role, minRole)) {
      throw new HTTPException(403, {
        message: `Bu işlem için en az '${minRole}' rolü gerekli`,
      });
    }
    await next();
  };
}

/** Şirket erişim kontrolü (user_company_access tablosuna bakar) */
export function requireCompanyAccess(minRole: UserRole = "viewer"): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.get("auth");
    if (!auth) throw new HTTPException(401, { message: "Yetki gerekli" });

    const cid = Number(c.req.param("cid"));
    if (!cid || isNaN(cid)) {
      throw new HTTPException(400, { message: "Geçersiz şirket ID" });
    }

    // Admin tüm şirketlere erişir
    if (auth.role === "admin") {
      c.set("auth", { ...auth, companyId: cid });
      return next();
    }

    // user_company_access tablosundan kontrol
    const { queryOne } = await import("../db.js");
    const access = await queryOne<{ role: UserRole }>(
      `SELECT role FROM user_company_access
       WHERE user_id = $1 AND company_id = $2`,
      [auth.userId, cid]
    );

    if (!access) {
      throw new HTTPException(403, { message: "Bu şirkete erişim yetkiniz yok" });
    }
    if (!canRole(access.role, minRole)) {
      throw new HTTPException(403, {
        message: `Bu işlem için bu şirkette en az '${minRole}' rolü gerekli`,
      });
    }

    // company bazlı rolü context'e ekle (override)
    c.set("auth", { ...auth, role: access.role, companyId: cid });
    await next();
  };
}
