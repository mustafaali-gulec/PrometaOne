/**
 * AppState use-case testleri.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

import type { AppStateMirror } from '../application/ports/AppStateMirror.js';
import {
  GetAppStateUseCase,
  SetAppStateUseCase,
} from '../application/useCases/AppStateUseCases.js';
import type { MirrorGroup, MirrorRow } from '../domain/BlobProjector.js';

import { FixedClock, InMemoryAppStateRepository } from './fakes.js';

describe('AppStateUseCases', () => {
  let repo: InMemoryAppStateRepository;
  let clock: FixedClock;

  beforeEach(() => {
    repo = new InMemoryAppStateRepository();
    clock = new FixedClock();
  });

  it('get: olmayan anahtar → null', async () => {
    const get = new GetAppStateUseCase(repo);
    assert.equal(await get.execute({ key: 'promet:data' }), null);
  });

  it('happy: set sonrası get → aynı değer (JSON round-trip)', async () => {
    const set = new SetAppStateUseCase(repo, clock);
    const get = new GetAppStateUseCase(repo);
    const blob = {
      companies: [{ id: 1, name: 'Acme' }],
      counts: [1, 2, 3],
      meta: { active: true, label: 'merhaba' },
    };

    const res = await set.execute({ key: 'promet:data', value: blob, actorUserId: 7 });
    assert.equal(res.scope, 'global');
    assert.equal(res.key, 'promet:data');
    assert.equal(res.updatedAt, clock.now().toISOString());

    const dto = await get.execute({ key: 'promet:data' });
    assert.ok(dto);
    assert.equal(dto.scope, 'global');
    assert.equal(dto.key, 'promet:data');
    assert.deepEqual(dto.value, blob);
    assert.equal(dto.updatedAt, clock.now().toISOString());
  });

  it('happy: tekrar set (upsert) → değeri ezer ve updatedAt güncellenir', async () => {
    const get = new GetAppStateUseCase(repo);

    const t1 = new Date('2026-06-25T00:00:00.000Z');
    const t2 = new Date('2026-06-26T10:30:00.000Z');

    await new SetAppStateUseCase(repo, new FixedClock(t1)).execute({
      key: 'promet:data',
      value: { v: 1 },
    });
    const second = await new SetAppStateUseCase(repo, new FixedClock(t2)).execute({
      key: 'promet:data',
      value: { v: 2, extra: 'yeni' },
    });

    assert.equal(second.updatedAt, t2.toISOString());

    const dto = await get.execute({ key: 'promet:data' });
    assert.ok(dto);
    assert.deepEqual(dto.value, { v: 2, extra: 'yeni' });
    assert.equal(dto.updatedAt, t2.toISOString());
  });

  it('edge: farklı scope/key bağımsızdır', async () => {
    const set = new SetAppStateUseCase(repo, clock);
    const get = new GetAppStateUseCase(repo);

    await set.execute({ key: 'promet:data', value: { a: 1 } });
    await set.execute({ key: 'promet:data', value: { a: 2 }, scope: 'user-42' });
    await set.execute({ key: 'other', value: { b: 9 } });

    assert.deepEqual((await get.execute({ key: 'promet:data' }))?.value, { a: 1 });
    assert.deepEqual((await get.execute({ key: 'promet:data', scope: 'user-42' }))?.value, {
      a: 2,
    });
    assert.deepEqual((await get.execute({ key: 'other' }))?.value, { b: 9 });
    // user-42 scope'unda 'other' yok
    assert.equal(await get.execute({ key: 'other', scope: 'user-42' }), null);
  });

  it('happy: scope verilmezse global varsayılır; boş scope da global', async () => {
    const set = new SetAppStateUseCase(repo, clock);
    const get = new GetAppStateUseCase(repo);

    await set.execute({ key: 'k', value: { x: 1 }, scope: '   ' });
    // Boş/whitespace scope → 'global' olarak normalize; default get ile bulunur.
    assert.deepEqual((await get.execute({ key: 'k' }))?.value, { x: 1 });
  });
});

describe('SetAppStateUseCase — mirror fan-out', () => {
  interface CapturedCall {
    rows: readonly MirrorRow[];
    groups: readonly MirrorGroup[] | undefined;
  }

  function makeMirror(fail = false): { mirror: AppStateMirror; calls: CapturedCall[] } {
    const calls: CapturedCall[] = [];
    return {
      calls,
      mirror: {
        async replaceAll(rows, groups) {
          calls.push({ rows, groups });
          if (fail) throw new Error('ayna çöktü');
        },
      },
    };
  }

  it("happy: 'promet:data' PUT sonrası ayna projeksiyon satırlarıyla çağrılır", async () => {
    const { mirror, calls } = makeMirror();
    const set = new SetAppStateUseCase(new InMemoryAppStateRepository(), new FixedClock(), mirror);

    await set.execute({
      key: 'promet:data',
      value: { companies: [{ id: 'comp_promet', name: 'Promet' }] },
    });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]!.rows, [
      {
        companyId: '0',
        domain: 'companies',
        clientId: 'comp_promet',
        data: { id: 'comp_promet', name: 'Promet' },
      },
    ]);
    assert.deepEqual(calls[0]!.groups, [{ companyId: '0', domain: 'companies' }]);
  });

  it('edge: ayna hatası PUT sonucunu BOZMAZ (fire-and-forget, hata yutulur)', async () => {
    const errSpy = mock.method(console, 'error', () => undefined);
    try {
      const { mirror, calls } = makeMirror(true);
      const set = new SetAppStateUseCase(
        new InMemoryAppStateRepository(),
        new FixedClock(),
        mirror,
      );

      const res = await set.execute({ key: 'promet:data', value: { banks: [{ id: 'b1' }] } });
      assert.equal(res.key, 'promet:data'); // yanıt normal döner
      assert.equal(calls.length, 1);
      // Reddedilen ayna promise'inin catch'i mikrotask'ta koşar — bekle.
      await new Promise((r) => setImmediate(r));
      assert.ok(errSpy.mock.calls.length >= 1);
    } finally {
      errSpy.mock.restore();
    }
  });

  it('edge: aynalanmayan anahtar ve global-dışı scope aynayı ÇAĞIRMAZ', async () => {
    const { mirror, calls } = makeMirror();
    const set = new SetAppStateUseCase(new InMemoryAppStateRepository(), new FixedClock(), mirror);

    await set.execute({ key: 'baska:anahtar', value: { x: 1 } });
    await set.execute({ key: 'promet:data', value: { banks: [] }, scope: 'user-42' });

    assert.equal(calls.length, 0);
  });

  it('geriye uyum: mirror verilmeden kurulabilir ve çalışır', async () => {
    const set = new SetAppStateUseCase(new InMemoryAppStateRepository(), new FixedClock());
    const res = await set.execute({ key: 'promet:data', value: { banks: [] } });
    assert.equal(res.scope, 'global');
  });
});
