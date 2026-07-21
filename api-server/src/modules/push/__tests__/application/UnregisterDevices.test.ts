import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PushValidationError } from '../../application/useCases/RegisterDevice.js';
import { UnregisterDevicesUseCase } from '../../application/useCases/UnregisterDevices.js';
import { InMemoryPushDeviceRepository } from '../helpers/fakes.js';

describe('UnregisterDevicesUseCase', () => {
  it('endpoint verilmişse yalnız o endpoint pasife alınır', async () => {
    const repo = new InMemoryPushDeviceRepository();
    repo.seed({ username: 'ali', endpoint: 'https://p.example/1' });
    repo.seed({ username: 'ali', endpoint: 'https://p.example/2' });
    const uc = new UnregisterDevicesUseCase(repo);

    const result = await uc.execute({ body: { endpoint: 'https://p.example/1' } });

    assert.equal(result.removed, 1);
    assert.equal(repo.devices.find((d) => d.endpoint === 'https://p.example/1')?.active, false);
    assert.equal(repo.devices.find((d) => d.endpoint === 'https://p.example/2')?.active, true);
  });

  it('endpoint yoksa (username, provider) TOPLU deaktivasyon — FE sözleşmesi', async () => {
    const repo = new InMemoryPushDeviceRepository();
    repo.seed({ username: 'ali', provider: 'web_push', endpoint: 'https://p.example/1' });
    repo.seed({ username: 'ali', provider: 'web_push', endpoint: 'https://p.example/2' });
    repo.seed({ username: 'ali', provider: 'fcm', endpoint: 'fcm-token-123456' });
    repo.seed({ username: 'veli', provider: 'web_push', endpoint: 'https://p.example/3' });
    const uc = new UnregisterDevicesUseCase(repo);

    const result = await uc.execute({ body: { username: 'ali', provider: 'web_push' } });

    assert.equal(result.removed, 2);
    assert.equal(repo.devices.find((d) => d.endpoint === 'fcm-token-123456')?.active, true);
    assert.equal(repo.devices.find((d) => d.endpoint === 'https://p.example/3')?.active, true);
  });

  it("auth varsa username token'dan alınır (body ezilir)", async () => {
    const repo = new InMemoryPushDeviceRepository();
    repo.seed({ username: 'gercek', provider: 'web_push', endpoint: 'https://p.example/g' });
    repo.seed({ username: 'kurban', provider: 'web_push', endpoint: 'https://p.example/k' });
    const uc = new UnregisterDevicesUseCase(repo);

    const result = await uc.execute({
      auth: { userId: 1, username: 'gercek' },
      body: { username: 'kurban', provider: 'web_push' },
    });

    assert.equal(result.removed, 1);
    assert.equal(repo.devices.find((d) => d.username === 'kurban')?.active, true);
    assert.equal(repo.devices.find((d) => d.username === 'gercek')?.active, false);
  });

  it('ne endpoint ne provider varsa PushValidationError', async () => {
    const repo = new InMemoryPushDeviceRepository();
    const uc = new UnregisterDevicesUseCase(repo);

    await assert.rejects(uc.execute({ body: { username: 'ali' } }), PushValidationError);
  });
});
