/**
 * companyScopeGuard testleri (node:test) — monolit çapraz-tenant companyId koruması.
 * JWT doğrulaması atlanır; auth context doğrudan enjekte edilerek guard izole test edilir.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { companyScopeGuard } from '../../middleware/auth.js';
import type { AuthContext } from '../../types.js';

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

describe('companyScopeGuard (monolit)', () => {
  it('izinli şirket (query) → geçer', async () => {
    const res = await makeApp({ ...base, companies: [1, 3] }).request('/r?companyId=1');
    assert.equal(res.status, 200);
  });

  it('izinsiz şirket (query) → 403', async () => {
    const res = await makeApp({ ...base, companies: [1, 3] }).request('/r?companyId=2');
    assert.equal(res.status, 403);
  });

  it('admin sınırsız → izinsiz görünen şirkete bile geçer', async () => {
    const res = await makeApp({ ...base, role: 'admin', companies: [] }).request(
      '/r?companyId=999',
    );
    assert.equal(res.status, 200);
  });

  it('claim yok (eski token) → geçiş dönemi, geçer', async () => {
    const res = await makeApp(base).request('/r?companyId=999');
    assert.equal(res.status, 200);
  });

  it('POST gövdedeki companyId izinsizse → 403', async () => {
    const res = await makeApp({ ...base, companies: [1] }).request('/r', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: 2 }),
    });
    assert.equal(res.status, 403);
  });

  it('companyId yoksa → guard geçer (route/zValidator ele alır)', async () => {
    const res = await makeApp({ ...base, companies: [1] }).request('/r');
    assert.equal(res.status, 200);
  });

  it('guard sonrası zValidator aynı JSON gövdeyi okuyabilir (Hono body-cache)', async () => {
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
      body: JSON.stringify({ companyId: 1, name: 'x' }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { got: { companyId: number; name: string } };
    assert.equal(body.got.companyId, 1);
  });
});
