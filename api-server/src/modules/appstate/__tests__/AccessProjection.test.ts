/**
 * AccessProjection birim testleri — blob RBAC koleksiyonları → access_*
 * projeksiyon satırları eşleme kuralları.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_ACCESS_COMPANY_ID,
  projectAccess,
  resolveAccessCompanyId,
} from '../domain/AccessProjection.js';

describe('AccessProjection', () => {
  it('happy: rol/grant/override alanları doğru eşlenir (permissions dizisi dahil)', () => {
    const p = projectAccess({
      companyData: {
        '3': {
          hrCustomRoles: [
            {
              id: 'role_1',
              name: ' Muhasebe ',
              description: 'Muhasebe ekibi',
              color: '#7c3aed',
              permissions: ['hr.employees.view', 'fin.invoices.edit'],
              createdAt: '2026-01-01T00:00:00.000Z',
              createdBy: 'admin',
            },
          ],
          hrRoleGrants: [
            {
              id: 'grant_1',
              roleId: 'role_1',
              subjectType: 'department',
              subjectId: 'dept_5',
              cascade: false,
              validFrom: '2026-01-01',
              validUntil: '2026-12-31',
              note: 'yetki devri',
              source: 'user_role',
            },
          ],
          hrPermOverrides: [
            {
              id: 'ovr_1',
              userId: 'ali.veli',
              resource: 'hr.employees',
              action: 'delete',
              allow: false,
              expiresAt: '2026-06-30',
            },
          ],
        },
      },
    });

    assert.equal(p.roles.length, 1);
    assert.deepEqual(p.roles[0], {
      companyId: 3,
      clientId: 'role_1',
      name: 'Muhasebe',
      description: 'Muhasebe ekibi',
      permissions: ['hr.employees.view', 'fin.invoices.edit'],
    });

    assert.equal(p.grants.length, 1);
    assert.deepEqual(p.grants[0], {
      companyId: 3,
      clientId: 'grant_1',
      roleClientId: 'role_1',
      subjectType: 'department',
      subjectId: 'dept_5',
      cascade: false,
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
    });

    assert.equal(p.overrides.length, 1);
    assert.deepEqual(p.overrides[0], {
      companyId: 3,
      clientId: 'ovr_1',
      username: 'ali.veli',
      resource: 'hr.employees',
      action: 'delete',
      allow: false,
      expiresAt: '2026-06-30',
    });
  });

  it('tüm subjectType değerleri kabul edilir; bilinmeyen subjectType atlanır', () => {
    const grants = ['user', 'employee', 'job_title', 'department', 'org_unit', 'takım'].map(
      (st, i) => ({ id: `grant_${i}`, roleId: 'role_1', subjectType: st, subjectId: `s${i}` }),
    );
    const p = projectAccess({ companyData: { '1': { hrRoleGrants: grants } } });
    assert.deepEqual(
      p.grants.map((g) => g.subjectType),
      ['user', 'employee', 'job_title', 'department', 'org_unit'],
    );
  });

  it('şirket ayrımı: sayısal cid korunur; string cid varsayılan şirkete (1) düşer ve BİRLEŞİR', () => {
    const p = projectAccess({
      companyData: {
        '7': { hrCustomRoles: [{ id: 'role_a', name: 'A' }] },
        comp_promet: { hrCustomRoles: [{ id: 'role_b', name: 'B' }] },
        comp_1719912345_abc: { hrCustomRoles: [{ id: 'role_c', name: 'C' }] },
      },
    });
    const byClient = new Map(p.roles.map((r) => [r.clientId, r.companyId]));
    assert.equal(byClient.get('role_a'), 7);
    assert.equal(byClient.get('role_b'), DEFAULT_ACCESS_COMPANY_ID);
    assert.equal(byClient.get('role_c'), DEFAULT_ACCESS_COMPANY_ID);
    assert.equal(p.roles.length, 3); // birleşim — hepsi taşınır
  });

  it('resolveAccessCompanyId: pozitif tamsayı → kendisi; aksi → öndeğer (einvBackendCompanyId kalıbı)', () => {
    assert.equal(resolveAccessCompanyId('12', 1), 12);
    assert.equal(resolveAccessCompanyId('comp_promet', 1), 1);
    assert.equal(resolveAccessCompanyId('-3', 1), 1);
    assert.equal(resolveAccessCompanyId('2.5', 1), 1);
    assert.equal(resolveAccessCompanyId('0', 9), 9);
  });

  it('boş koleksiyonlar / boş blob → boş projeksiyon (repo tarafında prune sinyali)', () => {
    const empty = projectAccess({
      companyData: { '1': { hrCustomRoles: [], hrRoleGrants: [], hrPermOverrides: [] } },
    });
    assert.deepEqual(empty, { roles: [], grants: [], overrides: [] });

    assert.deepEqual(projectAccess({}), { roles: [], grants: [], overrides: [] });
    assert.deepEqual(projectAccess(null), { roles: [], grants: [], overrides: [] });
    assert.deepEqual(projectAccess('bozuk'), { roles: [], grants: [], overrides: [] });
  });

  it('eleme: id/name eksik rol, roleId/subjectId eksik grant, alanları eksik override atlanır', () => {
    const p = projectAccess({
      companyData: {
        '1': {
          hrCustomRoles: [
            { name: 'idsiz' },
            { id: 'role_adsiz' },
            { id: '', name: 'boş id' },
            { id: 'role_ok', name: 'Tamam' },
          ],
          hrRoleGrants: [
            { id: 'grant_rolsuz', subjectType: 'user', subjectId: 'ali' },
            { id: 'grant_öznesiz', roleId: 'role_ok', subjectType: 'user' },
            { id: 'grant_ok', roleId: 'role_ok', subjectType: 'user', subjectId: 'ali' },
          ],
          hrPermOverrides: [
            { id: 'ovr_kaynaksız', userId: 'ali', action: 'view' },
            { id: 'ovr_ok', userId: 'ali', resource: 'hr', action: 'view', allow: true },
          ],
        },
      },
    });
    assert.deepEqual(
      p.roles.map((r) => r.clientId),
      ['role_ok'],
    );
    assert.deepEqual(
      p.grants.map((g) => g.clientId),
      ['grant_ok'],
    );
    assert.deepEqual(
      p.overrides.map((o) => o.clientId),
      ['ovr_ok'],
    );
  });

  it('öndeğerler: cascade true; permissions dizi değilse boş; allow strict true; username fallback', () => {
    const p = projectAccess({
      companyData: {
        '1': {
          hrCustomRoles: [{ id: 'role_1', name: 'R', permissions: 'hr.view' }],
          hrRoleGrants: [{ id: 'grant_1', roleId: 'role_1', subjectType: 'user', subjectId: 'a' }],
          hrPermOverrides: [
            { id: 'ovr_1', username: 'veli', resource: 'hr', action: 'view', allow: 'yes' },
          ],
        },
      },
    });
    assert.deepEqual(p.roles[0]!.permissions, []);
    assert.equal(p.grants[0]!.cascade, true);
    assert.equal(p.grants[0]!.validFrom, null);
    assert.equal(p.overrides[0]!.username, 'veli'); // userId yoksa username kabul
    assert.equal(p.overrides[0]!.allow, false); // strict boolean true değilse deny say
  });

  it('dedupe: çift client_id SON kazanır; override doğal anahtarında da SON kazanır', () => {
    const p = projectAccess({
      companyData: {
        '1': {
          hrCustomRoles: [
            { id: 'role_1', name: 'Eski' },
            { id: 'role_1', name: 'Yeni' },
          ],
          hrPermOverrides: [
            { id: 'ovr_a', userId: 'ali', resource: 'hr', action: 'view', allow: true },
            { id: 'ovr_b', userId: 'ali', resource: 'hr', action: 'view', allow: false },
          ],
        },
      },
    });
    assert.equal(p.roles.length, 1);
    assert.equal(p.roles[0]!.name, 'Yeni');
    // Aynı (company, username, resource, action) → tek satır, SON kazanır.
    assert.equal(p.overrides.length, 1);
    assert.equal(p.overrides[0]!.clientId, 'ovr_b');
    assert.equal(p.overrides[0]!.allow, false);
  });

  it('companyData dışındaki kök alanlar ve obje-olmayan şirket değerleri yok sayılır', () => {
    const p = projectAccess({
      hrCustomRoles: [{ id: 'role_root', name: 'Kökte kalmış' }], // kök — taşınmaz
      companyData: {
        '1': 'bozuk',
        '': { hrCustomRoles: [{ id: 'role_boş', name: 'X' }] },
        '2': { hrCustomRoles: [{ id: 'role_ok', name: 'OK' }] },
      },
    });
    assert.deepEqual(
      p.roles.map((r) => r.clientId),
      ['role_ok'],
    );
  });
});
