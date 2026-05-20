import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { User } from '../../domain/entities/User.js';

describe('User', () => {
  const baseProps = {
    id: 1,
    username: 'admin',
    fullName: 'Sistem Yöneticisi',
    email: 'admin@example.com',
    role: 'admin' as const,
    active: true,
    createdAt: new Date('2026-05-19T09:00:00Z'),
    lastLoginAt: null,
  };

  it('create geçerli prop\'larla başarılı', () => {
    const u = User.create(baseProps);
    assert.equal(u.id, 1);
    assert.equal(u.username, 'admin');
    assert.equal(u.role, 'admin');
    assert.equal(u.active, true);
  });

  it('id <= 0 ile fırlatır', () => {
    assert.throws(() => User.create({ ...baseProps, id: 0 }), /pozitif/);
    assert.throws(() => User.create({ ...baseProps, id: -1 }), /pozitif/);
  });

  it('boş username ile fırlatır', () => {
    assert.throws(() => User.create({ ...baseProps, username: '   ' }), /boş olamaz/);
  });

  it('64 karakter üstü username ile fırlatır', () => {
    assert.throws(
      () => User.create({ ...baseProps, username: 'a'.repeat(65) }),
      /64 karakteri/,
    );
  });

  it('recordLogin yeni instance döner', () => {
    const u = User.create(baseProps);
    const now = new Date('2026-05-19T13:00:00Z');
    const after = u.recordLogin(now);
    assert.equal(u.lastLoginAt, null, 'orijinal değişmemeli');
    assert.deepEqual(after.lastLoginAt, now);
    assert.notEqual(u, after);
  });

  it('deactivate aktifken yeni instance, pasifken aynı', () => {
    const active = User.create(baseProps);
    const inactive = active.deactivate();
    assert.equal(inactive.active, false);
    assert.equal(inactive.deactivate(), inactive, 'pasifken no-op');
  });

  it('withRole farklı rolde yeni instance, aynı rolde aynı', () => {
    const admin = User.create(baseProps);
    const cfo = admin.withRole('cfo');
    assert.equal(cfo.role, 'cfo');
    assert.equal(admin.role, 'admin', 'orijinal değişmemeli');
    assert.equal(admin.withRole('admin'), admin, 'aynı rol no-op');
  });
});
