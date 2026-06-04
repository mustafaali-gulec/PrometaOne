/**
 * PermissionResolver (domain servisi) testleri.
 *
 * Kapsam:
 *  - admin her izni alır
 *  - deny > allow > grant öncelik sırası
 *  - scope'suz kullanıcıya grant uygulanmaz
 *  - cascade department/org_unit alt birimlere yayılır
 *  - süresi dolmuş override / grant geçerlilik penceresi yok sayılır
 *  - bilinmeyen izin reddedilir (false)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  resolvePermission,
  resolveEffectivePermissions,
  type ResolverContext,
} from '../domain/services/PermissionResolver.js';

const NOW = new Date('2026-06-04T12:00:00Z');

function baseCtx(over: Partial<ResolverContext> = {}): ResolverContext {
  return {
    customRoles: [],
    grants: [],
    overrides: [],
    now: NOW,
    ...over,
  };
}

describe('PermissionResolver', () => {
  it('admin her izni alır', () => {
    const ctx = baseCtx();
    assert.equal(
      resolvePermission({ username: 'root', role: 'admin' }, 'hr.employees.delete', ctx),
      true,
    );
  });

  it('grant olmadan, admin olmayan kullanıcı reddedilir', () => {
    const ctx = baseCtx();
    assert.equal(
      resolvePermission({ username: 'u', role: 'viewer' }, 'hr.employees.view', ctx),
      false,
    );
  });

  it('user grant ile rolün izni alınır', () => {
    const ctx = baseCtx({
      customRoles: [{ id: 1, permissions: ['hr.employees.view'] }],
      grants: [
        {
          roleId: 1,
          subjectType: 'user',
          subjectId: 'u',
          cascade: true,
          validFrom: null,
          validUntil: null,
        },
      ],
    });
    assert.equal(
      resolvePermission({ username: 'u', role: 'viewer' }, 'hr.employees.view', ctx),
      true,
    );
    // verilmeyen izin yine reddedilir
    assert.equal(
      resolvePermission({ username: 'u', role: 'viewer' }, 'hr.employees.delete', ctx),
      false,
    );
  });

  it('deny override, allow override ve grant önünde kazanır', () => {
    const ctx = baseCtx({
      customRoles: [{ id: 1, permissions: ['hr.employees.view'] }],
      grants: [
        {
          roleId: 1,
          subjectType: 'user',
          subjectId: 'u',
          cascade: true,
          validFrom: null,
          validUntil: null,
        },
      ],
      overrides: [
        {
          username: 'u',
          resource: 'hr.employees',
          action: 'view',
          allow: false,
          expiresAt: null,
        },
        {
          username: 'u',
          resource: 'hr.employees',
          action: 'view',
          allow: true,
          expiresAt: null,
        },
      ],
    });
    assert.equal(
      resolvePermission({ username: 'u', role: 'viewer' }, 'hr.employees.view', ctx),
      false,
    );
  });

  it('allow override, grant olmadan izni verir', () => {
    const ctx = baseCtx({
      overrides: [
        {
          username: 'u',
          resource: 'hr.employees',
          action: 'view',
          allow: true,
          expiresAt: null,
        },
      ],
    });
    assert.equal(
      resolvePermission({ username: 'u', role: 'viewer' }, 'hr.employees.view', ctx),
      true,
    );
  });

  it('scope yoksa employee grant uygulanmaz', () => {
    const ctx = baseCtx({
      customRoles: [{ id: 1, permissions: ['hr.employees.view'] }],
      grants: [
        {
          roleId: 1,
          subjectType: 'employee',
          subjectId: '42',
          cascade: true,
          validFrom: null,
          validUntil: null,
        },
      ],
      // userScope verilmedi
    });
    assert.equal(
      resolvePermission({ username: 'u', role: 'viewer' }, 'hr.employees.view', ctx),
      false,
    );
  });

  it('cascade department grant alt departmana yayılır', () => {
    const ctx = baseCtx({
      customRoles: [{ id: 1, permissions: ['hr.employees.view'] }],
      grants: [
        {
          roleId: 1,
          subjectType: 'department',
          subjectId: '10',
          cascade: true,
          validFrom: null,
          validUntil: null,
        },
      ],
      userScope: { departmentId: 12 },
      departments: [
        { id: 10, parentDeptId: null },
        { id: 11, parentDeptId: 10 },
        { id: 12, parentDeptId: 11 },
      ],
    });
    assert.equal(
      resolvePermission({ username: 'u', role: 'viewer' }, 'hr.employees.view', ctx),
      true,
    );
  });

  it('cascade=false department grant alt departmana yayılmaz', () => {
    const ctx = baseCtx({
      customRoles: [{ id: 1, permissions: ['hr.employees.view'] }],
      grants: [
        {
          roleId: 1,
          subjectType: 'department',
          subjectId: '10',
          cascade: false,
          validFrom: null,
          validUntil: null,
        },
      ],
      userScope: { departmentId: 12 },
      departments: [
        { id: 10, parentDeptId: null },
        { id: 12, parentDeptId: 10 },
      ],
    });
    assert.equal(
      resolvePermission({ username: 'u', role: 'viewer' }, 'hr.employees.view', ctx),
      false,
    );
  });

  it('cascade org_unit grant alt birime yayılır', () => {
    const ctx = baseCtx({
      customRoles: [{ id: 1, permissions: ['hr.employees.view'] }],
      grants: [
        {
          roleId: 1,
          subjectType: 'org_unit',
          subjectId: '100',
          cascade: true,
          validFrom: null,
          validUntil: null,
        },
      ],
      userScope: { orgUnitId: 102 },
      orgUnits: [
        { id: 100, parentId: null },
        { id: 101, parentId: 100 },
        { id: 102, parentId: 101 },
      ],
    });
    assert.equal(
      resolvePermission({ username: 'u', role: 'viewer' }, 'hr.employees.view', ctx),
      true,
    );
  });

  it('geçerlilik penceresi dışındaki grant yok sayılır', () => {
    const ctx = baseCtx({
      customRoles: [{ id: 1, permissions: ['hr.employees.view'] }],
      grants: [
        {
          roleId: 1,
          subjectType: 'user',
          subjectId: 'u',
          cascade: true,
          validFrom: null,
          validUntil: new Date('2026-06-01T00:00:00Z'), // NOW'dan önce dolmuş
        },
      ],
    });
    assert.equal(
      resolvePermission({ username: 'u', role: 'viewer' }, 'hr.employees.view', ctx),
      false,
    );
  });

  it('süresi dolmuş deny override etkisizdir', () => {
    const ctx = baseCtx({
      overrides: [
        {
          username: 'u',
          resource: 'hr.employees',
          action: 'view',
          allow: false,
          expiresAt: new Date('2026-06-01T00:00:00Z'), // dolmuş
        },
        {
          username: 'u',
          resource: 'hr.employees',
          action: 'view',
          allow: true,
          expiresAt: null,
        },
      ],
    });
    assert.equal(
      resolvePermission({ username: 'u', role: 'viewer' }, 'hr.employees.view', ctx),
      true,
    );
  });

  it('bilinmeyen izin formatı InvalidPermissionError fırlatır', () => {
    const ctx = baseCtx();
    assert.throws(() => resolvePermission({ username: 'u', role: 'viewer' }, 'tekparca', ctx));
  });

  it('resolveEffectivePermissions sadece allow olanları döner', () => {
    const ctx = baseCtx({
      customRoles: [{ id: 1, permissions: ['hr.employees.view', 'hr.employees.create'] }],
      grants: [
        {
          roleId: 1,
          subjectType: 'user',
          subjectId: 'u',
          cascade: true,
          validFrom: null,
          validUntil: null,
        },
      ],
    });
    const result = resolveEffectivePermissions(
      { username: 'u', role: 'viewer' },
      ['hr.employees.view', 'hr.employees.create', 'hr.employees.delete'],
      ctx,
    );
    assert.deepEqual(result.sort(), ['hr.employees.create', 'hr.employees.view']);
  });
});
