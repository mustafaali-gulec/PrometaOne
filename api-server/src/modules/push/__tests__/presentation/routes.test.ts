/**
 * Push routes test — Hono in-memory request/response + gerçek JWT
 * (config.JWT_SECRET .env'den gelir; authMiddleware'in kendisi de zincirde).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import jwt from 'jsonwebtoken';

import { config } from '../../../../config.js';
import type { UserRole } from '../../../../types.js';
import { RegisterDeviceUseCase } from '../../application/useCases/RegisterDevice.js';
import { SendPushUseCase } from '../../application/useCases/SendPush.js';
import { UnregisterDevicesUseCase } from '../../application/useCases/UnregisterDevices.js';
import { createPushRouter } from '../../presentation/routes.js';
import { FakePushSender, InMemoryPushDeviceRepository } from '../helpers/fakes.js';

function makeRouter(repo = new InMemoryPushDeviceRepository(), publicKey: string | null = null) {
  const sender = new FakePushSender();
  return {
    router: createPushRouter({
      registerDevice: new RegisterDeviceUseCase(repo),
      unregisterDevices: new UnregisterDevicesUseCase(repo),
      sendPush: new SendPushUseCase(repo, sender),
      deviceQuery: repo,
      vapidPublicKey: publicKey,
    }),
    repo,
    sender,
  };
}

function bearer(username: string, role: UserRole = 'editor', sub = 1): string {
  return `Bearer ${jwt.sign({ sub, username, role }, config.JWT_SECRET)}`;
}

function jsonReq(body: unknown, auth?: string): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  };
}

describe('createPushRouter', () => {
  it("GET /public-key guard'sız çalışır; VAPID yoksa publicKey:null", async () => {
    const { router } = makeRouter();
    const res = await router.request('/public-key');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { publicKey: null });
  });

  it('GET /public-key VAPID varsa anahtarı döner', async () => {
    const { router } = makeRouter(new InMemoryPushDeviceRepository(), 'BTestPublicKey');
    const res = await router.request('/public-key');
    assert.deepEqual(await res.json(), { publicKey: 'BTestPublicKey' });
  });

  it("POST /register-device token'sız + username'li kayıt yapar → {success:true, deviceId}", async () => {
    const { router, repo } = makeRouter();
    const res = await router.request(
      '/register-device',
      jsonReq({
        username: 'ali',
        provider: 'web_push',
        endpoint: 'https://push.example.com/sub/abc',
        keys: { p256dh: 'p', auth: 'a' },
      }),
    );

    assert.equal(res.status, 200);
    const body = (await res.json()) as { success: boolean; deviceId: string };
    assert.equal(body.success, true);
    assert.ok(body.deviceId);
    assert.equal(repo.devices[0]?.username, 'ali');
  });

  it("POST /register-device token'sız + username'siz → 400", async () => {
    const { router } = makeRouter();
    const res = await router.request(
      '/register-device',
      jsonReq({ provider: 'web_push', endpoint: 'https://push.example.com/sub/abc' }),
    );
    assert.equal(res.status, 400);
  });

  it("POST /register-device geçerli token body kimliğini ezer (username token'dan)", async () => {
    const { router, repo } = makeRouter();
    const res = await router.request(
      '/register-device',
      jsonReq(
        {
          username: 'sahte',
          provider: 'web_push',
          endpoint: 'https://push.example.com/sub/abc',
        },
        bearer('gercek.kullanici'),
      ),
    );
    assert.equal(res.status, 200);
    assert.equal(repo.devices[0]?.username, 'gercek.kullanici');
  });

  it("POST /register-device GEÇERSİZ token → 401 (auth'suz devam edilmez)", async () => {
    const { router, repo } = makeRouter();
    const res = await router.request(
      '/register-device',
      jsonReq(
        { username: 'ali', provider: 'web_push', endpoint: 'https://push.example.com/sub/abc' },
        'Bearer gecersiz.token.degeri',
      ),
    );
    assert.equal(res.status, 401);
    assert.equal(repo.devices.length, 0);
  });

  it("POST /register-device web_push endpoint'i https:// değilse → 400", async () => {
    const { router } = makeRouter();
    const res = await router.request(
      '/register-device',
      jsonReq({
        username: 'ali',
        provider: 'web_push',
        endpoint: 'http://guvensiz.example.com/sub/abc',
      }),
    );
    assert.equal(res.status, 400);
  });

  it('POST /unregister-device endpoint da provider da yoksa → 400', async () => {
    const { router } = makeRouter();
    const res = await router.request('/unregister-device', jsonReq({ username: 'ali' }));
    assert.equal(res.status, 400);
  });

  it('POST /unregister-device {username, provider} toplu deaktivasyon → {success:true, removed}', async () => {
    const repo = new InMemoryPushDeviceRepository();
    repo.seed({ username: 'ali', provider: 'web_push', endpoint: 'https://p.example/1' });
    repo.seed({ username: 'ali', provider: 'web_push', endpoint: 'https://p.example/2' });
    const { router } = makeRouter(repo);

    const res = await router.request(
      '/unregister-device',
      jsonReq({ username: 'ali', provider: 'web_push' }),
    );

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { success: true, removed: 2 });
  });

  it("POST /send auth'suz → 401", async () => {
    const { router } = makeRouter();
    const res = await router.request('/send', jsonReq({ notification: { title: 'Merhaba' } }));
    assert.equal(res.status, 401);
  });

  it('POST /send kayıtlı olmayan endpoint relay edilmez → sent:0', async () => {
    const { router } = makeRouter();
    const res = await router.request(
      '/send',
      jsonReq(
        {
          notification: { title: 'Merhaba', body: 'Deneme', link: null },
          devices: [{ provider: 'web_push', endpoint: 'https://saldirgan.example/hedef' }],
        },
        bearer('gonderen'),
      ),
    );

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { success: false, sent: 0, failed: 0 });
  });

  it('GET /devices/:username başka kullanıcı + admin değil → 403; admin → 200', async () => {
    const repo = new InMemoryPushDeviceRepository();
    repo.seed({ username: 'ali', endpoint: 'https://p.example/1' });
    const { router } = makeRouter(repo);

    const forbidden = await router.request('/devices/ali', {
      headers: { Authorization: bearer('veli', 'editor') },
    });
    assert.equal(forbidden.status, 403);

    const allowed = await router.request('/devices/ali', {
      headers: { Authorization: bearer('yonetici', 'admin') },
    });
    assert.equal(allowed.status, 200);
    const body = (await allowed.json()) as { devices: Array<{ endpoint: string }> };
    assert.equal(body.devices.length, 1);
  });
});
