/**
 * companyScopeGuard testleri (node:test) — çapraz-tenant companyId koruması.
 * JWT doğrulaması atlanır; auth context doğrudan enjekte edilir, guard izole test edilir.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { companyScopeGuard } from '../../../../middleware/auth.js';
import type { AuthContext } from '../../../../types.js';

function makeApp(auth: AuthContext): Hono {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('auth', auth);
    await next();
  });
  app.use('*', companyScopeGuard);
  app.get('/r', (c) => c.json({ ok: true }));
  app.post('/r', (c) => c.json({ ok: true }));
  return app;
}

const base: AuthContext = { userId: 6, username: 'mustafa', role: 'cfo' };

describe('companyScopeGuard', () => {
  it('izinli şirket (query) → geçer', async () => {
    const app = makeApp({ ...base, companies: [1, 3] });
    const res = await app.request('/r?companyId=1');
    assert.equal(res.status, 200);
  });

  it('izinsiz şirket (query) → 403', async () => {
    const app = makeApp({ ...base, companies: [1, 3] });
    const res = await app.request('/r?companyId=2');
    assert.equal(res.status, 403);
  });

  it('admin sınırsız → izinsiz görünen şirkete bile geçer', async () => {
    const app = makeApp({ ...base, role: 'admin', companies: [] });
    const res = await app.request('/r?companyId=999');
    assert.equal(res.status, 200);
  });

  it('claim yok (eski token) → geçiş dönemi, geçer', async () => {
    const app = makeApp(base); // companies undefined
    const res = await app.request('/r?companyId=999');
    assert.equal(res.status, 200);
  });

  it('POST gövdedeki companyId izinsizse → 403', async () => {
    const app = makeApp({ ...base, companies: [1] });
    const res = await app.request('/r', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: 2, foo: 'bar' }),
    });
    assert.equal(res.status, 403);
  });

  it('POST gövdedeki companyId izinliyse → geçer', async () => {
    const app = makeApp({ ...base, companies: [1] });
    const res = await app.request('/r', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: 1 }),
    });
    assert.equal(res.status, 200);
  });

  it('companyId yoksa → guard geçer (route/zValidator ele alır)', async () => {
    const app = makeApp({ ...base, companies: [1] });
    const res = await app.request('/r');
    assert.equal(res.status, 200);
  });

  // KRİTİK: guard gövdeyi okuduktan sonra zValidator aynı gövdeyi tekrar
  // okuyabilmeli (Hono body-cache). Aksi hâlde gerçek POST route'lar kırılır.
  it('guard sonrası zValidator aynı JSON gövdeyi okuyabilir', async () => {
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('auth', { ...base, companies: [1] });
      await next();
    });
    app.use('*', companyScopeGuard);
    app.post(
      '/v',
      zValidator('json', z.object({ companyId: z.number().int(), name: z.string() })),
      (c) => c.json({ got: c.req.valid('json') }),
    );
    const res = await app.request('/v', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: 1, name: 'proje' }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { got: { companyId: number; name: string } };
    assert.equal(body.got.companyId, 1);
    assert.equal(body.got.name, 'proje');
  });
});
