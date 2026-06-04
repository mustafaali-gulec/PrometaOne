/**
 * Access (RBAC / özel roller) HTTP route'ları — Faz B-4.
 *
 * Tüm endpoint'ler authMiddleware ile korunur (Bearer token gerekli).
 * YAZMA işlemleri requireRole('admin') ister. OKUMA işlemleri (catalog,
 * listeler, effective-permissions) yalnızca authMiddleware ister.
 *
 * companyId query/body'den alınır; multi-tenant izolasyon repo'larda.
 * Bu dosya use-case'leri yalnızca çağırır — iş kuralı YAZMAZ.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware, requireRole } from '../../../middleware/auth.js';
import type { OrgStructureReader } from '../application/ports/OrgStructureReader.js';
import type { CreateCustomRoleUseCase } from '../application/useCases/CreateCustomRoleUseCase.js';
import type { CreateRoleGrantUseCase } from '../application/useCases/CreateRoleGrantUseCase.js';
import type { DeleteCustomRoleUseCase } from '../application/useCases/DeleteCustomRoleUseCase.js';
import type { DeletePermissionOverrideUseCase } from '../application/useCases/DeletePermissionOverrideUseCase.js';
import type { DeleteRoleGrantUseCase } from '../application/useCases/DeleteRoleGrantUseCase.js';
import type { ListCustomRolesUseCase } from '../application/useCases/ListCustomRolesUseCase.js';
import type { ListPermissionOverridesUseCase } from '../application/useCases/ListPermissionOverridesUseCase.js';
import type { ListRoleGrantsUseCase } from '../application/useCases/ListRoleGrantsUseCase.js';
import type { ResolvePermissionsUseCase } from '../application/useCases/ResolvePermissionsUseCase.js';
import type { SetPermissionOverrideUseCase } from '../application/useCases/SetPermissionOverrideUseCase.js';
import type { UpdateCustomRoleUseCase } from '../application/useCases/UpdateCustomRoleUseCase.js';
import { ACTIONS, RESOURCES } from '../domain/catalog/Resources.js';
import { ALL_SUBJECT_TYPES, type SubjectType } from '../domain/valueObjects/SubjectType.js';

import { mapAccessError } from './errorMapping.js';

export interface AccessRouterDeps {
  // roles
  createCustomRole: CreateCustomRoleUseCase;
  updateCustomRole: UpdateCustomRoleUseCase;
  deleteCustomRole: DeleteCustomRoleUseCase;
  listCustomRoles: ListCustomRolesUseCase;
  // grants
  createRoleGrant: CreateRoleGrantUseCase;
  deleteRoleGrant: DeleteRoleGrantUseCase;
  listRoleGrants: ListRoleGrantsUseCase;
  // overrides
  setPermissionOverride: SetPermissionOverrideUseCase;
  deletePermissionOverride: DeletePermissionOverrideUseCase;
  listPermissionOverrides: ListPermissionOverridesUseCase;
  // resolve
  resolvePermissions: ResolvePermissionsUseCase;
  // org/departman hiyerarşisi + kullanıcı scope (cascade grant'lar için)
  orgStructureReader: OrgStructureReader;
}

// ===========================================================================
// Schema fragmanları
// ===========================================================================
const companyIdQuery = z.object({
  companyId: z.coerce.number().int().positive(),
});

const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

const positiveInt = z.number().int().positive();

const subjectTypeSchema = z.enum(ALL_SUBJECT_TYPES as unknown as [string, ...string[]]);

// ===========================================================================
// Router
// ===========================================================================
export function createAccessRouter(deps: AccessRouterDeps): Hono {
  const app = new Hono();

  // Tüm route'lar authentication gerektirir
  app.use('*', authMiddleware);

  // Yazma işlemleri sadece 'admin'
  const requireAdmin = requireRole('admin');

  // -------------------------------------------------------------------------
  // CATALOG (read-only) — RESOURCES + ACTIONS kataloğu
  // -------------------------------------------------------------------------
  app.get('/catalog', (c) => {
    const resources = Object.entries(RESOURCES).map(([resource, def]) => ({
      resource,
      module: def.module,
      label: def.label,
      actions: def.actions,
    }));
    return c.json({ actions: ACTIONS, resources });
  });

  // -------------------------------------------------------------------------
  // CUSTOM ROLES
  // -------------------------------------------------------------------------
  app.get('/roles', zValidator('query', companyIdQuery), async (c) => {
    const q = c.req.valid('query');
    try {
      const roles = await deps.listCustomRoles.execute({ companyId: q.companyId });
      return c.json({ roles });
    } catch (err) {
      mapAccessError(err);
    }
  });

  app.post(
    '/roles',
    requireAdmin,
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        name: z.string().min(1).max(200),
        description: z.string().max(1000).nullable().optional(),
        permissions: z.array(z.string().min(1)).default([]),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const body = c.req.valid('json');
      try {
        const dto = await deps.createCustomRole.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          name: body.name,
          description: body.description ?? null,
          permissions: body.permissions,
        });
        return c.json(dto, 201);
      } catch (err) {
        mapAccessError(err);
      }
    },
  );

  app.put(
    '/roles/:id',
    requireAdmin,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        name: z.string().min(1).max(200),
        description: z.string().max(1000).nullable().optional(),
        permissions: z.array(z.string().min(1)).default([]),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.updateCustomRole.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          roleId: id,
          name: body.name,
          description: body.description ?? null,
          permissions: body.permissions,
        });
        return c.json(dto);
      } catch (err) {
        mapAccessError(err);
      }
    },
  );

  app.delete(
    '/roles/:id',
    requireAdmin,
    zValidator('param', idParam),
    zValidator('query', companyIdQuery),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        await deps.deleteCustomRole.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: q.companyId,
          roleId: id,
        });
        return c.body(null, 204);
      } catch (err) {
        mapAccessError(err);
      }
    },
  );

  // -------------------------------------------------------------------------
  // ROLE GRANTS
  // -------------------------------------------------------------------------
  app.get('/grants', zValidator('query', companyIdQuery), async (c) => {
    const q = c.req.valid('query');
    try {
      const grants = await deps.listRoleGrants.execute({ companyId: q.companyId });
      return c.json({ grants });
    } catch (err) {
      mapAccessError(err);
    }
  });

  app.post(
    '/grants',
    requireAdmin,
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        roleId: positiveInt,
        subjectType: subjectTypeSchema,
        subjectId: z.string().min(1).max(200),
        cascade: z.boolean().optional(),
        validFrom: z.coerce.date().nullable().optional(),
        validUntil: z.coerce.date().nullable().optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const body = c.req.valid('json');
      try {
        const dto = await deps.createRoleGrant.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          roleId: body.roleId,
          subjectType: body.subjectType as SubjectType,
          subjectId: body.subjectId,
          ...(body.cascade !== undefined ? { cascade: body.cascade } : {}),
          ...(body.validFrom !== undefined ? { validFrom: body.validFrom } : {}),
          ...(body.validUntil !== undefined ? { validUntil: body.validUntil } : {}),
        });
        return c.json(dto, 201);
      } catch (err) {
        mapAccessError(err);
      }
    },
  );

  app.delete(
    '/grants/:id',
    requireAdmin,
    zValidator('param', idParam),
    zValidator('query', companyIdQuery),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        await deps.deleteRoleGrant.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: q.companyId,
          grantId: id,
        });
        return c.body(null, 204);
      } catch (err) {
        mapAccessError(err);
      }
    },
  );

  // -------------------------------------------------------------------------
  // PERMISSION OVERRIDES
  // -------------------------------------------------------------------------
  app.get('/overrides', zValidator('query', companyIdQuery), async (c) => {
    const q = c.req.valid('query');
    try {
      const overrides = await deps.listPermissionOverrides.execute({ companyId: q.companyId });
      return c.json({ overrides });
    } catch (err) {
      mapAccessError(err);
    }
  });

  // upsert (PUT — idempotent)
  app.put(
    '/overrides',
    requireAdmin,
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        username: z.string().min(1).max(200),
        resource: z.string().min(1),
        action: z.string().min(1),
        allow: z.boolean(),
        expiresAt: z.coerce.date().nullable().optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const body = c.req.valid('json');
      try {
        const dto = await deps.setPermissionOverride.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          username: body.username,
          resource: body.resource,
          action: body.action,
          allow: body.allow,
          ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt } : {}),
        });
        return c.json(dto);
      } catch (err) {
        mapAccessError(err);
      }
    },
  );

  app.delete(
    '/overrides/:id',
    requireAdmin,
    zValidator('param', idParam),
    zValidator('query', companyIdQuery),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        await deps.deletePermissionOverride.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: q.companyId,
          overrideId: id,
        });
        return c.body(null, 204);
      } catch (err) {
        mapAccessError(err);
      }
    },
  );

  // -------------------------------------------------------------------------
  // EFFECTIVE PERMISSIONS (resolve) — read-only
  // -------------------------------------------------------------------------
  // companyId zorunlu; username/role verilmezse oturum sahibinin kendisi çözülür.
  app.get(
    '/effective-permissions',
    zValidator(
      'query',
      companyIdQuery.extend({
        username: z.string().min(1).optional(),
        role: z.string().min(1).optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const q = c.req.valid('query');
      const username = q.username ?? auth.username;
      try {
        // Org/departman hiyerarşisini + hedef kullanıcının scope'unu topla ki
        // cascade (department / org_unit) grant'ları HTTP üzerinden çözülsün.
        const [orgUnits, departments, userScope] = await Promise.all([
          deps.orgStructureReader.listOrgUnits(q.companyId),
          deps.orgStructureReader.listDepartments(q.companyId),
          deps.orgStructureReader.resolveUserScope(username, q.companyId),
        ]);
        const dto = await deps.resolvePermissions.execute({
          companyId: q.companyId,
          username,
          role: q.role ?? auth.role,
          orgUnits,
          departments,
          ...(userScope !== null ? { userScope } : {}),
        });
        return c.json(dto);
      } catch (err) {
        mapAccessError(err);
      }
    },
  );

  return app;
}
