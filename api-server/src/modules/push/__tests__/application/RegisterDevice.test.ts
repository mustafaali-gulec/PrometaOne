import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PushValidationError,
  RegisterDeviceUseCase,
} from '../../application/useCases/RegisterDevice.js';
import { InMemoryPushDeviceRepository } from '../helpers/fakes.js';

describe('RegisterDeviceUseCase', () => {
  it('token kimliği body kimliğini EZER (username + userId)', async () => {
    const repo = new InMemoryPushDeviceRepository();
    const uc = new RegisterDeviceUseCase(repo);

    await uc.execute({
      auth: { userId: 7, username: 'gercek.kullanici' },
      body: {
        username: 'sahte-kullanici',
        userId: 'sahte-id',
        provider: 'web_push',
        endpoint: 'https://push.example.com/sub/abc123',
        keys: { p256dh: 'p', auth: 'a' },
      },
    });

    assert.equal(repo.devices.length, 1);
    assert.equal(repo.devices[0]?.username, 'gercek.kullanici');
    assert.equal(repo.devices[0]?.userId, '7');
  });

  it('auth yoksa body.username kullanılır', async () => {
    const repo = new InMemoryPushDeviceRepository();
    const uc = new RegisterDeviceUseCase(repo);

    const result = await uc.execute({
      body: {
        username: 'mobil.kullanici',
        provider: 'fcm',
        endpoint: 'fcm-registration-token-1234567890',
      },
    });

    assert.equal(repo.devices[0]?.username, 'mobil.kullanici');
    assert.ok(result.deviceId.startsWith('dev_'));
  });

  it('kimlik hiç yoksa PushValidationError fırlatır', async () => {
    const repo = new InMemoryPushDeviceRepository();
    const uc = new RegisterDeviceUseCase(repo);

    await assert.rejects(
      uc.execute({
        body: { provider: 'web_push', endpoint: 'https://push.example.com/sub/x' },
      }),
      PushValidationError,
    );
    assert.equal(repo.devices.length, 0);
  });

  it('aynı endpoint yeniden kayıt olunca upsert: tek satır, aynı deviceId, yeniden aktif', async () => {
    const repo = new InMemoryPushDeviceRepository();
    const uc = new RegisterDeviceUseCase(repo);

    const first = await uc.execute({
      body: {
        id: 'dev_ilk',
        username: 'ali',
        provider: 'web_push',
        endpoint: 'https://push.example.com/sub/ayni',
        keys: { p256dh: 'eski-p', auth: 'eski-a' },
      },
    });

    // Cihaz pasife alınmış olsun (unregister sonrası yeniden abone senaryosu)
    await repo.deactivateByEndpoint('https://push.example.com/sub/ayni');

    const second = await uc.execute({
      body: {
        id: 'dev_ikinci',
        username: 'ali',
        provider: 'web_push',
        endpoint: 'https://push.example.com/sub/ayni',
        keys: { p256dh: 'yeni-p', auth: 'yeni-a' },
      },
    });

    assert.equal(repo.devices.length, 1);
    assert.equal(second.deviceId, first.deviceId); // mevcut id korunur
    assert.equal(repo.devices[0]?.active, true);
    assert.deepEqual(repo.devices[0]?.keys, { p256dh: 'yeni-p', auth: 'yeni-a' });
  });
});
