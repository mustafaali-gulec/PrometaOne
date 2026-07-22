/**
 * AppState use-case testleri.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

import type { AccessProjectionMirror } from '../application/ports/AccessProjectionMirror.js';
import type { AppStateMirror } from '../application/ports/AppStateMirror.js';
import type { FinanceProjectionMirror } from '../application/ports/FinanceProjectionMirror.js';
import type { HrProjectionMirror } from '../application/ports/HrProjectionMirror.js';
import {
  GetAppStateUseCase,
  SetAppStateUseCase,
} from '../application/useCases/AppStateUseCases.js';
import type { AccessProjection } from '../domain/AccessProjection.js';
import type { MirrorGroup, MirrorRow } from '../domain/BlobProjector.js';
import type { FinanceProjection } from '../domain/FinanceProjection.js';
import type { HrProjection } from '../domain/HrProjection.js';

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

describe('SetAppStateUseCase — access projeksiyon fan-out', () => {
  function makeAccessMirror(fail = false): {
    accessMirror: AccessProjectionMirror;
    calls: AccessProjection[];
  } {
    const calls: AccessProjection[] = [];
    return {
      calls,
      accessMirror: {
        async replaceAll(projection) {
          calls.push(projection);
          if (fail) throw new Error('access aynası çöktü');
        },
      },
    };
  }

  const makeSut = (accessMirror: AccessProjectionMirror): SetAppStateUseCase =>
    new SetAppStateUseCase(
      new InMemoryAppStateRepository(),
      new FixedClock(),
      undefined,
      accessMirror,
    );

  it("happy: 'promet:data' PUT sonrası access aynası RBAC projeksiyonuyla çağrılır", async () => {
    const { accessMirror, calls } = makeAccessMirror();
    const set = makeSut(accessMirror);

    await set.execute({
      key: 'promet:data',
      value: {
        companyData: {
          '2': {
            hrCustomRoles: [{ id: 'role_1', name: 'Muhasebe', permissions: ['hr.view'] }],
            hrRoleGrants: [
              { id: 'grant_1', roleId: 'role_1', subjectType: 'user', subjectId: 'ali' },
            ],
          },
        },
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.roles.length, 1);
    assert.equal(calls[0]!.roles[0]!.companyId, 2);
    assert.equal(calls[0]!.roles[0]!.clientId, 'role_1');
    assert.equal(calls[0]!.grants.length, 1);
    assert.deepEqual(calls[0]!.overrides, []);
  });

  it('RBAC koleksiyonu boş/yok olsa da çağrılır (boş projeksiyon = prune sinyali)', async () => {
    const { accessMirror, calls } = makeAccessMirror();
    const set = makeSut(accessMirror);

    await set.execute({ key: 'promet:data', value: { banks: [] } });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { roles: [], grants: [], overrides: [] });
  });

  it('edge: access aynası hatası PUT sonucunu BOZMAZ (fire-and-forget, hata yutulur)', async () => {
    const errSpy = mock.method(console, 'error', () => undefined);
    try {
      const { accessMirror, calls } = makeAccessMirror(true);
      const set = makeSut(accessMirror);

      const res = await set.execute({ key: 'promet:data', value: { companyData: {} } });
      assert.equal(res.key, 'promet:data'); // yanıt normal döner
      assert.equal(calls.length, 1);
      await new Promise((r) => setImmediate(r));
      assert.ok(errSpy.mock.calls.length >= 1);
    } finally {
      errSpy.mock.restore();
    }
  });

  it("edge: 'promet:data' dışı anahtar ve global-dışı scope access aynasını ÇAĞIRMAZ", async () => {
    const { accessMirror, calls } = makeAccessMirror();
    const set = makeSut(accessMirror);

    await set.execute({ key: 'promet:users', value: [{ username: 'ali' }] });
    await set.execute({ key: 'promet:data', value: { companyData: {} }, scope: 'user-42' });

    assert.equal(calls.length, 0);
  });
});

describe('SetAppStateUseCase — hr projeksiyon fan-out', () => {
  function makeHrMirror(fail = false): {
    hrMirror: HrProjectionMirror;
    calls: HrProjection[];
  } {
    const calls: HrProjection[] = [];
    return {
      calls,
      hrMirror: {
        async replaceAll(projection) {
          calls.push(projection);
          if (fail) throw new Error('hr aynası çöktü');
        },
      },
    };
  }

  const makeSut = (hrMirror: HrProjectionMirror): SetAppStateUseCase =>
    new SetAppStateUseCase(
      new InMemoryAppStateRepository(),
      new FixedClock(),
      undefined,
      undefined,
      hrMirror,
    );

  it("happy: 'promet:data' PUT sonrası hr aynası HR projeksiyonuyla çağrılır", async () => {
    const { hrMirror, calls } = makeHrMirror();
    const set = makeSut(hrMirror);

    await set.execute({
      key: 'promet:data',
      value: {
        companyData: {
          '2': {
            hrOrgUnits: [{ id: 'ou_1', name: 'GM' }],
            hrDepartments: [{ id: 'dept_1', name: 'Yazılım', orgUnitId: 'ou_1' }],
            hrEmployees: [
              {
                id: 'emp_1',
                firstName: 'Ali',
                lastName: 'Veli',
                departmentId: 'dept_1',
                startDate: '2025-03-01',
              },
            ],
          },
        },
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.orgUnits.length, 1);
    assert.equal(calls[0]!.orgUnits[0]!.companyId, 2);
    assert.equal(calls[0]!.departments[0]!.orgUnitClientId, 'ou_1');
    assert.equal(calls[0]!.employees[0]!.clientId, 'emp_1');
    assert.equal(calls[0]!.employees[0]!.departmentClientId, 'dept_1');
  });

  it('HR koleksiyonu boş/yok olsa da çağrılır (boş projeksiyon = prune sinyali)', async () => {
    const { hrMirror, calls } = makeHrMirror();
    const set = makeSut(hrMirror);

    await set.execute({ key: 'promet:data', value: { banks: [] } });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]!.employees, []);
    assert.deepEqual(calls[0]!.orgUnits, []);
  });

  it('edge: hr aynası hatası PUT sonucunu BOZMAZ (fire-and-forget, hata yutulur)', async () => {
    const errSpy = mock.method(console, 'error', () => undefined);
    try {
      const { hrMirror, calls } = makeHrMirror(true);
      const set = makeSut(hrMirror);

      const res = await set.execute({ key: 'promet:data', value: { companyData: {} } });
      assert.equal(res.key, 'promet:data'); // yanıt normal döner
      assert.equal(calls.length, 1);
      await new Promise((r) => setImmediate(r));
      assert.ok(errSpy.mock.calls.length >= 1);
    } finally {
      errSpy.mock.restore();
    }
  });

  it("edge: 'promet:data' dışı anahtar ve global-dışı scope hr aynasını ÇAĞIRMAZ", async () => {
    const { hrMirror, calls } = makeHrMirror();
    const set = makeSut(hrMirror);

    await set.execute({ key: 'promet:users', value: [{ username: 'ali' }] });
    await set.execute({ key: 'promet:data', value: { companyData: {} }, scope: 'user-42' });

    assert.equal(calls.length, 0);
  });
});

describe('SetAppStateUseCase — finans projeksiyon fan-out', () => {
  function makeFinanceMirror(fail = false): {
    financeMirror: FinanceProjectionMirror;
    calls: FinanceProjection[];
  } {
    const calls: FinanceProjection[] = [];
    return {
      calls,
      financeMirror: {
        async replaceAll(projection) {
          calls.push(projection);
          if (fail) throw new Error('finans aynası çöktü');
        },
      },
    };
  }

  const makeSut = (financeMirror: FinanceProjectionMirror): SetAppStateUseCase =>
    new SetAppStateUseCase(
      new InMemoryAppStateRepository(),
      new FixedClock(),
      undefined,
      undefined,
      undefined,
      financeMirror,
    );

  it("happy: 'promet:data' PUT sonrası finans aynası FİNANS projeksiyonuyla çağrılır", async () => {
    const { financeMirror, calls } = makeFinanceMirror();
    const set = makeSut(financeMirror);

    await set.execute({
      key: 'promet:data',
      value: {
        banks: [{ id: 'bnk_1', name: 'YKB', code: 'YKB' }],
        companyData: {
          '2': {
            bankAccounts: [{ id: 'acc_1', bankId: 'bnk_1', name: 'Vadesiz', currency: 'TRY' }],
            kasaAccounts: [{ id: 'ksa_1', name: 'Merkez Kasa' }],
            inflows: [{ id: 'in_1', name: 'Satış' }],
          },
        },
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.banks.length, 1);
    assert.equal(calls[0]!.banks[0]!.clientId, 'bnk_1');
    assert.equal(calls[0]!.bankAccounts[0]!.companyId, 2);
    assert.equal(calls[0]!.bankAccounts[0]!.bankClientId, 'bnk_1');
    assert.equal(calls[0]!.kasaAccounts[0]!.clientId, 'ksa_1');
    assert.equal(calls[0]!.categories[0]!.section, 'inflows');
  });

  it('finans koleksiyonu boş/yok olsa da çağrılır (boş projeksiyon = prune sinyali)', async () => {
    const { financeMirror, calls } = makeFinanceMirror();
    const set = makeSut(financeMirror);

    await set.execute({ key: 'promet:data', value: { companyData: {} } });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]!.banks, []);
    assert.deepEqual(calls[0]!.invoices, []);
  });

  it('edge: finans aynası hatası PUT sonucunu BOZMAZ (fire-and-forget, hata yutulur)', async () => {
    const errSpy = mock.method(console, 'error', () => undefined);
    try {
      const { financeMirror, calls } = makeFinanceMirror(true);
      const set = makeSut(financeMirror);

      const res = await set.execute({ key: 'promet:data', value: { companyData: {} } });
      assert.equal(res.key, 'promet:data'); // yanıt normal döner
      assert.equal(calls.length, 1);
      await new Promise((r) => setImmediate(r));
      assert.ok(errSpy.mock.calls.length >= 1);
    } finally {
      errSpy.mock.restore();
    }
  });

  it("edge: 'promet:data' dışı anahtar ve global-dışı scope finans aynasını ÇAĞIRMAZ", async () => {
    const { financeMirror, calls } = makeFinanceMirror();
    const set = makeSut(financeMirror);

    await set.execute({ key: 'promet:users', value: [{ username: 'ali' }] });
    await set.execute({ key: 'promet:data', value: { companyData: {} }, scope: 'user-42' });

    assert.equal(calls.length, 0);
  });
});
