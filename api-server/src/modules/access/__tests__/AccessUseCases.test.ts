/**
 * Access use-case testleri — InMemoryAccessRepository + FakeClock +
 * RecordingAuditLogger ile.
 *
 * Kapsam:
 *  - rol CRUD + duplicate (409) + not found (404)
 *  - grant create/delete + rol yoksa 404
 *  - override upsert (idempotent) + delete
 *  - resolve: rol+grant ile etkin izin seti
 *  - her yazma işlemi audit kaydı üretir
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DuplicateRoleNameError,
  CustomRoleNotFoundError,
  OverrideNotFoundError,
  RoleGrantNotFoundError,
} from '../application/errors/AccessErrors.js';
import { CreateCustomRoleUseCase } from '../application/useCases/CreateCustomRoleUseCase.js';
import { CreateRoleGrantUseCase } from '../application/useCases/CreateRoleGrantUseCase.js';
import { DeleteCustomRoleUseCase } from '../application/useCases/DeleteCustomRoleUseCase.js';
import { DeletePermissionOverrideUseCase } from '../application/useCases/DeletePermissionOverrideUseCase.js';
import { DeleteRoleGrantUseCase } from '../application/useCases/DeleteRoleGrantUseCase.js';
import { ListCustomRolesUseCase } from '../application/useCases/ListCustomRolesUseCase.js';
import { ListPermissionOverridesUseCase } from '../application/useCases/ListPermissionOverridesUseCase.js';
import { ListRoleGrantsUseCase } from '../application/useCases/ListRoleGrantsUseCase.js';
import { ResolvePermissionsUseCase } from '../application/useCases/ResolvePermissionsUseCase.js';
import { SetPermissionOverrideUseCase } from '../application/useCases/SetPermissionOverrideUseCase.js';
import { UpdateCustomRoleUseCase } from '../application/useCases/UpdateCustomRoleUseCase.js';
import type {
  DepartmentNode,
  OrgUnitNode,
  UserScope,
} from '../domain/services/PermissionResolver.js';
import { InvalidPermissionError } from '../domain/valueObjects/Permission.js';

import { InMemoryOrgStructureReader, makeFakeAccessContext } from './fakes.js';

const ACTOR = { actorUserId: 1, actorUsername: 'admin' };
const CO = 7;

describe('CustomRole use-cases', () => {
  it('rol oluşturur ve audit yazar', async () => {
    const { repo, clock, audit } = makeFakeAccessContext();
    const uc = new CreateCustomRoleUseCase(repo, clock, audit);
    const dto = await uc.execute({
      ...ACTOR,
      companyId: CO,
      name: 'İK Görüntüleyici',
      description: null,
      permissions: ['hr.employees.view'],
    });
    assert.equal(dto.name, 'İK Görüntüleyici');
    assert.deepEqual(dto.permissions, ['hr.employees.view']);
    assert.equal(audit.findByAction('access.role.created').length, 1);
  });

  it('aynı isimde ikinci rol DuplicateRoleNameError fırlatır', async () => {
    const { repo, clock, audit } = makeFakeAccessContext();
    const uc = new CreateCustomRoleUseCase(repo, clock, audit);
    await uc.execute({ ...ACTOR, companyId: CO, name: 'Rol', description: null, permissions: [] });
    await assert.rejects(
      () =>
        uc.execute({ ...ACTOR, companyId: CO, name: 'Rol', description: null, permissions: [] }),
      DuplicateRoleNameError,
    );
  });

  it('geçersiz izin InvalidPermissionError fırlatır', async () => {
    const { repo, clock, audit } = makeFakeAccessContext();
    const uc = new CreateCustomRoleUseCase(repo, clock, audit);
    await assert.rejects(
      () =>
        uc.execute({
          ...ACTOR,
          companyId: CO,
          name: 'Rol',
          description: null,
          permissions: ['hr.employees.fly'],
        }),
      InvalidPermissionError,
    );
  });

  it('rol günceller (izin seti değişir)', async () => {
    const { repo, clock, audit } = makeFakeAccessContext();
    const create = new CreateCustomRoleUseCase(repo, clock, audit);
    const update = new UpdateCustomRoleUseCase(repo, clock, audit);
    const created = await create.execute({
      ...ACTOR,
      companyId: CO,
      name: 'Rol',
      description: null,
      permissions: ['hr.employees.view'],
    });
    const updated = await update.execute({
      ...ACTOR,
      companyId: CO,
      roleId: created.id,
      name: 'Rol (güncel)',
      description: 'açıklama',
      permissions: ['hr.employees.view', 'hr.employees.create'],
    });
    assert.equal(updated.name, 'Rol (güncel)');
    assert.deepEqual(updated.permissions, ['hr.employees.create', 'hr.employees.view']);
    assert.equal(audit.findByAction('access.role.updated').length, 1);
  });

  it('olmayan rolü güncellemek CustomRoleNotFoundError fırlatır', async () => {
    const { repo, clock, audit } = makeFakeAccessContext();
    const update = new UpdateCustomRoleUseCase(repo, clock, audit);
    await assert.rejects(
      () =>
        update.execute({
          ...ACTOR,
          companyId: CO,
          roleId: 999,
          name: 'X',
          description: null,
          permissions: [],
        }),
      CustomRoleNotFoundError,
    );
  });

  it('rol siler + audit yazar', async () => {
    const { repo, clock, audit } = makeFakeAccessContext();
    const create = new CreateCustomRoleUseCase(repo, clock, audit);
    const del = new DeleteCustomRoleUseCase(repo, clock, audit);
    const list = new ListCustomRolesUseCase(repo);
    const created = await create.execute({
      ...ACTOR,
      companyId: CO,
      name: 'Rol',
      description: null,
      permissions: [],
    });
    await del.execute({ ...ACTOR, companyId: CO, roleId: created.id });
    assert.equal((await list.execute({ companyId: CO })).length, 0);
    assert.equal(audit.findByAction('access.role.deleted').length, 1);
  });
});

describe('RoleGrant use-cases', () => {
  it('grant oluşturur + siler, rol yoksa 404', async () => {
    const { repo, clock, audit } = makeFakeAccessContext();
    const createRole = new CreateCustomRoleUseCase(repo, clock, audit);
    const createGrant = new CreateRoleGrantUseCase(repo, clock, audit);
    const deleteGrant = new DeleteRoleGrantUseCase(repo, clock, audit);
    const listGrants = new ListRoleGrantsUseCase(repo);

    const role = await createRole.execute({
      ...ACTOR,
      companyId: CO,
      name: 'Rol',
      description: null,
      permissions: ['hr.employees.view'],
    });

    const grant = await createGrant.execute({
      ...ACTOR,
      companyId: CO,
      roleId: role.id,
      subjectType: 'user',
      subjectId: 'ali',
    });
    assert.equal(grant.cascade, true);
    assert.equal((await listGrants.execute({ companyId: CO })).length, 1);
    assert.equal(audit.findByAction('access.grant.created').length, 1);

    await deleteGrant.execute({ ...ACTOR, companyId: CO, grantId: grant.id });
    assert.equal((await listGrants.execute({ companyId: CO })).length, 0);
    assert.equal(audit.findByAction('access.grant.deleted').length, 1);
  });

  it('olmayan role grant CustomRoleNotFoundError fırlatır', async () => {
    const { repo, clock, audit } = makeFakeAccessContext();
    const createGrant = new CreateRoleGrantUseCase(repo, clock, audit);
    await assert.rejects(
      () =>
        createGrant.execute({
          ...ACTOR,
          companyId: CO,
          roleId: 999,
          subjectType: 'user',
          subjectId: 'ali',
        }),
      CustomRoleNotFoundError,
    );
  });

  it('olmayan grant silmek RoleGrantNotFoundError fırlatır', async () => {
    const { repo, clock, audit } = makeFakeAccessContext();
    const deleteGrant = new DeleteRoleGrantUseCase(repo, clock, audit);
    await assert.rejects(
      () => deleteGrant.execute({ ...ACTOR, companyId: CO, grantId: 999 }),
      RoleGrantNotFoundError,
    );
  });
});

describe('PermissionOverride use-cases', () => {
  it('override upsert idempotenttir (aynı dörtlü -> aynı kayıt güncellenir)', async () => {
    const { repo, clock, audit } = makeFakeAccessContext();
    const set = new SetPermissionOverrideUseCase(repo, clock, audit);
    const list = new ListPermissionOverridesUseCase(repo);

    const a = await set.execute({
      ...ACTOR,
      companyId: CO,
      username: 'ali',
      resource: 'hr.employees',
      action: 'view',
      allow: true,
    });
    const b = await set.execute({
      ...ACTOR,
      companyId: CO,
      username: 'ali',
      resource: 'hr.employees',
      action: 'view',
      allow: false,
    });
    assert.equal(a.id, b.id);
    assert.equal(b.allow, false);
    assert.equal((await list.execute({ companyId: CO })).length, 1);
    assert.equal(audit.findByAction('access.override.created').length, 2);
  });

  it('override siler, yoksa 404', async () => {
    const { repo, clock, audit } = makeFakeAccessContext();
    const set = new SetPermissionOverrideUseCase(repo, clock, audit);
    const del = new DeletePermissionOverrideUseCase(repo, clock, audit);

    const o = await set.execute({
      ...ACTOR,
      companyId: CO,
      username: 'ali',
      resource: 'hr.employees',
      action: 'view',
      allow: true,
    });
    await del.execute({ ...ACTOR, companyId: CO, overrideId: o.id });
    assert.equal(audit.findByAction('access.override.deleted').length, 1);

    await assert.rejects(
      () => del.execute({ ...ACTOR, companyId: CO, overrideId: 999 }),
      OverrideNotFoundError,
    );
  });
});

describe('ResolvePermissions use-case', () => {
  it('rol + user grant ile etkin izin seti çözülür', async () => {
    const { repo, clock, audit } = makeFakeAccessContext();
    const createRole = new CreateCustomRoleUseCase(repo, clock, audit);
    const createGrant = new CreateRoleGrantUseCase(repo, clock, audit);
    const resolve = new ResolvePermissionsUseCase(repo, clock);

    const role = await createRole.execute({
      ...ACTOR,
      companyId: CO,
      name: 'Rol',
      description: null,
      permissions: ['hr.employees.view', 'hr.employees.create'],
    });
    await createGrant.execute({
      ...ACTOR,
      companyId: CO,
      roleId: role.id,
      subjectType: 'user',
      subjectId: 'ali',
    });

    const eff = await resolve.execute({ companyId: CO, username: 'ali', role: 'viewer' });
    assert.equal(eff.username, 'ali');
    assert.ok(eff.permissions.includes('hr.employees.view'));
    assert.ok(eff.permissions.includes('hr.employees.create'));
    assert.ok(!eff.permissions.includes('hr.employees.delete'));
  });

  it('admin tüm kataloğu alır', async () => {
    const { repo, clock } = makeFakeAccessContext();
    const resolve = new ResolvePermissionsUseCase(repo, clock);
    const eff = await resolve.execute({ companyId: CO, username: 'root', role: 'admin' });
    assert.ok(eff.permissions.length > 50);
  });

  it('cascade org_unit grant + userScope/orgUnits ile (alt birim) çözülür', async () => {
    const { repo, clock, audit } = makeFakeAccessContext();
    const createRole = new CreateCustomRoleUseCase(repo, clock, audit);
    const createGrant = new CreateRoleGrantUseCase(repo, clock, audit);
    const resolve = new ResolvePermissionsUseCase(repo, clock);

    const role = await createRole.execute({
      ...ACTOR,
      companyId: CO,
      name: 'Birim Rolü',
      description: null,
      permissions: ['hr.employees.view'],
    });
    // Üst birim (id=1) için org_unit cascade grant.
    await createGrant.execute({
      ...ACTOR,
      companyId: CO,
      roleId: role.id,
      subjectType: 'org_unit',
      subjectId: '1',
    });

    // org_units: 2 → parent 1 (yani 2, 1'in alt birimi)
    const orgUnits: OrgUnitNode[] = [
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
    ];
    const departments: DepartmentNode[] = [{ id: 10, parentDeptId: null }];
    // ayse alt birim (2) içinde → cascade ile 1'in grant'ı uygulanır.
    const scope: UserScope = { employeeId: 100, departmentId: 10, orgUnitId: 2 };
    const reader = new InMemoryOrgStructureReader(
      orgUnits,
      departments,
      new Map([['ayse', scope]]),
    );

    const ou = await reader.listOrgUnits(CO);
    const deps = await reader.listDepartments(CO);
    const userScope = await reader.resolveUserScope('ayse', CO);
    assert.notEqual(userScope, null);

    const eff = await resolve.execute({
      companyId: CO,
      username: 'ayse',
      role: 'viewer',
      orgUnits: ou,
      departments: deps,
      ...(userScope !== null ? { userScope } : {}),
    });
    assert.ok(eff.permissions.includes('hr.employees.view'));
  });

  it('userScope yoksa (employee kaydı yok) cascade grant çözülmez', async () => {
    const { repo, clock, audit } = makeFakeAccessContext();
    const createRole = new CreateCustomRoleUseCase(repo, clock, audit);
    const createGrant = new CreateRoleGrantUseCase(repo, clock, audit);
    const resolve = new ResolvePermissionsUseCase(repo, clock);

    const role = await createRole.execute({
      ...ACTOR,
      companyId: CO,
      name: 'Birim Rolü',
      description: null,
      permissions: ['hr.employees.view'],
    });
    await createGrant.execute({
      ...ACTOR,
      companyId: CO,
      roleId: role.id,
      subjectType: 'org_unit',
      subjectId: '1',
    });

    const reader = new InMemoryOrgStructureReader([{ id: 1, parentId: null }], [], new Map());
    const userScope = await reader.resolveUserScope('hayalet', CO);
    assert.equal(userScope, null);

    const eff = await resolve.execute({
      companyId: CO,
      username: 'hayalet',
      role: 'viewer',
      orgUnits: await reader.listOrgUnits(CO),
      departments: await reader.listDepartments(CO),
      ...(userScope !== null ? { userScope } : {}),
    });
    assert.ok(!eff.permissions.includes('hr.employees.view'));
  });
});
