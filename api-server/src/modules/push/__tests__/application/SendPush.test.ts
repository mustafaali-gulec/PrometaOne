import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SendPushUseCase } from '../../application/useCases/SendPush.js';
import { FakePushSender, InMemoryPushDeviceRepository } from '../helpers/fakes.js';

const AUTH = { userId: 1, username: 'gonderen' };

describe('SendPushUseCase', () => {
  it('relay engeli: devices listesindeki KAYITSIZ endpoint elenir', async () => {
    const repo = new InMemoryPushDeviceRepository();
    repo.seed({ username: 'ali', endpoint: 'https://p.example/kayitli' });
    const sender = new FakePushSender();
    const uc = new SendPushUseCase(repo, sender);

    const result = await uc.execute({
      auth: AUTH,
      notification: { title: 'Merhaba' },
      devices: [
        { provider: 'web_push', endpoint: 'https://p.example/kayitli' },
        { provider: 'web_push', endpoint: 'https://saldirgan.example/relay-hedefi' },
      ],
    });

    assert.equal(sender.sent.length, 1);
    assert.equal(sender.sent[0]?.device.endpoint, 'https://p.example/kayitli');
    assert.deepEqual(result, { success: true, sent: 1, failed: 0 });
  });

  it('relay engeli: kayıtlı ama PASİF endpoint de elenir', async () => {
    const repo = new InMemoryPushDeviceRepository();
    repo.seed({ username: 'ali', endpoint: 'https://p.example/pasif', active: false });
    const sender = new FakePushSender();
    const uc = new SendPushUseCase(repo, sender);

    const result = await uc.execute({
      auth: AUTH,
      notification: { title: 'Merhaba' },
      devices: [{ provider: 'web_push', endpoint: 'https://p.example/pasif' }],
    });

    assert.equal(sender.sent.length, 0);
    assert.deepEqual(result, { success: false, sent: 0, failed: 0 });
  });

  it("istemcinin yolladığı keys DEĞİL, DB'deki kayıtlı keys kullanılır", async () => {
    const repo = new InMemoryPushDeviceRepository();
    repo.seed({
      username: 'ali',
      endpoint: 'https://p.example/1',
      keys: { p256dh: 'db-p', auth: 'db-a' },
    });
    const sender = new FakePushSender();
    const uc = new SendPushUseCase(repo, sender);

    await uc.execute({
      auth: AUTH,
      notification: { title: 'Merhaba' },
      devices: [
        {
          provider: 'web_push',
          endpoint: 'https://p.example/1',
          keys: { p256dh: 'istemci-p', auth: 'istemci-a' },
        },
      ],
    });

    assert.deepEqual(sender.sent[0]?.device.keys, { p256dh: 'db-p', auth: 'db-a' });
  });

  it('gone (404/410) sonucu cihazı pasife alır ve failed sayılır', async () => {
    const repo = new InMemoryPushDeviceRepository();
    repo.seed({ username: 'ali', endpoint: 'https://p.example/olu' });
    repo.seed({ username: 'ali', endpoint: 'https://p.example/canli' });
    const sender = new FakePushSender();
    sender.results.set('https://p.example/olu', {
      ok: false,
      gone: true,
      error: 'abonelik geçersiz (http-410)',
    });
    const uc = new SendPushUseCase(repo, sender);

    const result = await uc.execute({
      auth: AUTH,
      notification: { title: 'Merhaba' },
      username: 'ali',
    });

    assert.deepEqual(result, { success: true, sent: 1, failed: 1 });
    assert.equal(repo.devices.find((d) => d.endpoint === 'https://p.example/olu')?.active, false);
    assert.equal(repo.devices.find((d) => d.endpoint === 'https://p.example/canli')?.active, true);
  });

  it('başarılı gönderimde last_used_at güncellenir (touchLastUsed)', async () => {
    const repo = new InMemoryPushDeviceRepository();
    repo.seed({ username: 'ali', endpoint: 'https://p.example/1' });
    const sender = new FakePushSender();
    const uc = new SendPushUseCase(repo, sender);

    await uc.execute({ auth: AUTH, notification: { title: 'Merhaba' }, username: 'ali' });

    assert.deepEqual(repo.touched, ['https://p.example/1']);
  });

  it('devices yoksa username parametresinin aktif cihazları hedeflenir', async () => {
    const repo = new InMemoryPushDeviceRepository();
    repo.seed({ username: 'ali', endpoint: 'https://p.example/a1' });
    repo.seed({ username: 'ali', endpoint: 'https://p.example/a2', active: false });
    repo.seed({ username: 'veli', endpoint: 'https://p.example/v1' });
    const sender = new FakePushSender();
    const uc = new SendPushUseCase(repo, sender);

    const result = await uc.execute({
      auth: AUTH,
      notification: { title: 'Merhaba' },
      username: 'ali',
    });

    assert.equal(sender.sent.length, 1);
    assert.equal(sender.sent[0]?.device.endpoint, 'https://p.example/a1');
    assert.deepEqual(result, { success: true, sent: 1, failed: 0 });
  });

  it('devices BOŞ LİSTE ise sıfır hedef (çağıranın cihazlarına düşülmez)', async () => {
    const repo = new InMemoryPushDeviceRepository();
    repo.seed({ username: 'gonderen', endpoint: 'https://p.example/self' });
    const sender = new FakePushSender();
    const uc = new SendPushUseCase(repo, sender);

    const result = await uc.execute({
      auth: AUTH,
      notification: { title: 'Merhaba' },
      devices: [],
    });

    assert.equal(sender.sent.length, 0);
    assert.deepEqual(result, { success: false, sent: 0, failed: 0 });
  });

  it('devices ve username yoksa çağıranın (auth) cihazları hedeflenir', async () => {
    const repo = new InMemoryPushDeviceRepository();
    repo.seed({ username: 'gonderen', endpoint: 'https://p.example/self' });
    const sender = new FakePushSender();
    const uc = new SendPushUseCase(repo, sender);

    const result = await uc.execute({ auth: AUTH, notification: { title: 'Merhaba' } });

    assert.equal(sender.sent[0]?.device.username, 'gonderen');
    assert.deepEqual(result, { success: true, sent: 1, failed: 0 });
  });
});
