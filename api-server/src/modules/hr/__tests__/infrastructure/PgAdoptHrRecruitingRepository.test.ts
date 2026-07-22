/**
 * PgAdoptHrRecruitingRepository birim testleri — SQL üretimi mock Pool/Client
 * ile doğrulanır: tek transaction, ON CONFLICT (company_id, client_id) upsert
 * (idempotens), başvuru referanslarının üç kademeli çözümü (çağrı-içi + DB'deki
 * önceki adopt + geçerli sayısal sunucu id), MEZUN departman çözücüsü,
 * uq_applications_active_unique çakışmasında devralma (SON kazanır, 500 yok),
 * 23505 → conflict, rollback.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  NormalizedAdoptApplication,
  NormalizedAdoptCandidate,
  NormalizedAdoptPosition,
} from '../../application/dto/AdoptHrRecruitingDtos.js';
import { HrRecruitingAdoptConflictError } from '../../application/errors/HrErrors.js';
import {
  PgAdoptHrRecruitingRepository,
  type AdoptHrRecruitingPool,
  type AdoptHrRecruitingPoolClient,
} from '../../infrastructure/persistence/PgAdoptHrRecruitingRepository.js';

interface RecordedCall {
  sql: string;
  values: readonly unknown[] | undefined;
}

interface FakeOptions {
  /** Departman çözücü SELECT'inin döneceği satırlar (MEZUN tablo içeriği). */
  dbDepartments?: Array<{ id: number; client_id: string | null }>;
  /** candidates client_id lookup'ının döneceği satırlar (önceki adopt). */
  dbCandidatesByClient?: Array<{ id: number; client_id: string }>;
  /** positions client_id lookup'ının döneceği satırlar (önceki adopt). */
  dbPositionsByClient?: Array<{ id: number; client_id: string }>;
  /** Sayısal id doğrulama lookup'larının döneceği id'ler. */
  dbCandidateIds?: number[];
  dbPositionIds?: number[];
  /** SELECT id FROM applications WHERE ... client_id → "kendi satırı" id'si. */
  ownApplicationIdByClient?: Record<string, number>;
  /** Aktif çift SELECT'inin döneceği çakışan satır id'si. */
  activeConflictId?: number;
  failOn?: (sql: string) => boolean;
}

function makeFakePool(opts: FakeOptions = {}): {
  pool: AdoptHrRecruitingPool;
  calls: RecordedCall[];
  released: () => boolean;
} {
  const calls: RecordedCall[] = [];
  let released = false;
  let nextId = 100;
  const client: AdoptHrRecruitingPoolClient = {
    async query(sql: string, values?: readonly unknown[]) {
      calls.push({ sql, values });
      if (opts.failOn?.(sql)) throw new Error('patladı');
      if (sql.includes('FROM departments')) {
        return { rows: opts.dbDepartments ?? [] };
      }
      if (sql.includes('SELECT id, client_id FROM candidates')) {
        return { rows: opts.dbCandidatesByClient ?? [] };
      }
      if (sql.includes('SELECT id, client_id FROM positions')) {
        return { rows: opts.dbPositionsByClient ?? [] };
      }
      if (sql.includes('SELECT id FROM candidates')) {
        return { rows: (opts.dbCandidateIds ?? []).map((id) => ({ id })) };
      }
      if (sql.includes('SELECT id FROM positions')) {
        return { rows: (opts.dbPositionIds ?? []).map((id) => ({ id })) };
      }
      if (
        sql.includes('SELECT id FROM applications WHERE company_id') &&
        sql.includes('client_id')
      ) {
        const clientId = String(values?.[1]);
        const own = opts.ownApplicationIdByClient?.[clientId];
        return own !== undefined ? { rows: [{ id: own }], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (sql.includes("stage NOT IN ('hired', 'rejected', 'withdrawn')")) {
        return opts.activeConflictId !== undefined
          ? { rows: [{ id: opts.activeConflictId }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      if (
        (sql.includes('INSERT INTO') || sql.trimStart().startsWith('UPDATE')) &&
        sql.includes('RETURNING id')
      ) {
        return { rows: [{ id: nextId++ }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    release() {
      released = true;
    },
  };
  return { pool: { connect: async () => client }, calls, released: () => released };
}

const pos = (
  clientId: string,
  over: Partial<NormalizedAdoptPosition> = {},
): NormalizedAdoptPosition => ({
  clientId,
  title: `Pozisyon ${clientId}`,
  description: null,
  status: 'open',
  headcountTarget: 1,
  minSalary: null,
  maxSalary: null,
  departmentRef: null,
  ...over,
});

const cand = (
  clientId: string,
  over: Partial<NormalizedAdoptCandidate> = {},
): NormalizedAdoptCandidate => ({
  clientId,
  firstName: 'Ayşe',
  lastName: `Kaya ${clientId}`,
  email: null,
  phone: null,
  source: 'direct',
  cvUrl: null,
  notes: null,
  ...over,
});

const app = (
  clientId: string,
  over: Partial<NormalizedAdoptApplication> = {},
): NormalizedAdoptApplication => ({
  clientId,
  candidateRef: 'cand_1',
  positionRef: 'pos_1',
  stage: 'interview',
  stageChangedAt: null,
  rejectionReason: null,
  salaryExpectation: null,
  notes: null,
  ...over,
});

describe('PgAdoptHrRecruitingRepository', () => {
  it('happy: tek transaction; ON CONFLICT (company_id, client_id) upsert; başvuru çağrı-içi haritayla çözülür', async () => {
    const { pool, calls, released } = makeFakePool();
    const repo = new PgAdoptHrRecruitingRepository(pool);

    const outcome = await repo.adoptAll(1, {
      positions: [pos('pos_1')],
      candidates: [cand('cand_1')],
      applications: [app('app_1', { stageChangedAt: '2026-07-10T10:00:00Z' })],
    });

    assert.equal(calls[0]!.sql, 'BEGIN');
    assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
    assert.ok(released());

    const posInsert = calls.find((c) => c.sql.includes('INSERT INTO positions'));
    assert.ok(posInsert);
    assert.ok(posInsert.sql.includes('ON CONFLICT (company_id, client_id)'));
    assert.ok(posInsert.sql.includes('DO UPDATE'));
    const candInsert = calls.find((c) => c.sql.includes('INSERT INTO candidates'));
    assert.ok(candInsert);
    assert.ok(candInsert.sql.includes('ON CONFLICT (company_id, client_id)'));

    // Başvuru: candidate_id (101) + position_id (100) çağrı-içi haritadan.
    const appInsert = calls.find((c) => c.sql.includes('INSERT INTO applications'));
    assert.ok(appInsert);
    assert.deepEqual(appInsert.values, [
      1,
      101,
      100,
      'interview',
      '2026-07-10T10:00:00Z',
      null,
      null,
      null,
      'app_1',
    ]);

    assert.deepEqual(outcome.positionIdByClient, { pos_1: 100 });
    assert.deepEqual(outcome.candidateIdByClient, { cand_1: 101 });
    assert.deepEqual(outcome.applicationIdByClient, { app_1: 102 });

    // departmentRef yok → departments çözücüsü hiç sorgulanmaz.
    assert.equal(
      calls.some((c) => c.sql.includes('FROM departments')),
      false,
    );
  });

  it('MEZUN departman çözücüsü: client_id haritası + geçerli SAYISAL sunucu id; çözülemeyen NULL', async () => {
    const { pool, calls } = makeFakePool({
      dbDepartments: [
        { id: 12, client_id: 'dept_yzl' },
        { id: 34, client_id: null }, // CRUD/adopt satırı — sayısal ref doğrulanır
      ],
    });
    const repo = new PgAdoptHrRecruitingRepository(pool);

    await repo.adoptAll(1, {
      positions: [
        pos('pos_cli', { departmentRef: 'dept_yzl' }),
        pos('pos_num', { departmentRef: '34' }),
        pos('pos_yok', { departmentRef: 'dept_bilinmez' }),
        pos('pos_yabanci', { departmentRef: '999' }), // geçersiz sayısal id
      ],
      candidates: [],
      applications: [],
    });

    const deptLookup = calls.find((c) => c.sql.includes('FROM departments'));
    assert.ok(deptLookup);
    assert.deepEqual(deptLookup.values, [1]); // şirket kapsamlı

    const inserts = calls.filter((c) => c.sql.includes('INSERT INTO positions'));
    const deptOf = new Map(inserts.map((c) => [c.values![8], c.values![1]]));
    assert.equal(deptOf.get('pos_cli'), 12);
    assert.equal(deptOf.get('pos_num'), 34);
    assert.equal(deptOf.get('pos_yok'), null);
    assert.equal(deptOf.get('pos_yabanci'), null);
  });

  it("DB-önceki çözüm: çağrıda olmayan candidate/position referansları client_id'den, kalanı geçerli sayısal id'den bulunur", async () => {
    const { pool, calls } = makeFakePool({
      dbCandidatesByClient: [{ id: 55, client_id: 'cand_onceki' }],
      dbPositionIds: [77], // sayısal ref doğrulaması
    });
    const repo = new PgAdoptHrRecruitingRepository(pool);

    const outcome = await repo.adoptAll(1, {
      positions: [],
      candidates: [],
      applications: [app('app_1', { candidateRef: 'cand_onceki', positionRef: '77' })],
    });

    const appInsert = calls.find((c) => c.sql.includes('INSERT INTO applications'));
    assert.ok(appInsert);
    assert.equal(appInsert.values![1], 55); // DB client_id'den
    assert.equal(appInsert.values![2], 77); // geçerli sayısal sunucu id'den
    assert.deepEqual(outcome.applicationIdByClient, { app_1: 100 });

    // Lookup'lar şirket kapsamlı ve yalnız eksik referanslarla yapılır.
    const candLookup = calls.find((c) => c.sql.includes('SELECT id, client_id FROM candidates'));
    assert.ok(candLookup);
    assert.equal(candLookup.values![0], 1);
    assert.deepEqual(candLookup.values![1], ['cand_onceki']);
    const posIdLookup = calls.find((c) => c.sql.includes('SELECT id FROM positions'));
    assert.ok(posIdLookup);
    assert.deepEqual(posIdLookup.values![1], [77]);
  });

  it('çözülemeyen başvuru referansı: satır DÜŞER (idMap dışı), transaction COMMIT eder', async () => {
    const { pool, calls } = makeFakePool(); // DB boş
    const repo = new PgAdoptHrRecruitingRepository(pool);

    const outcome = await repo.adoptAll(1, {
      positions: [pos('pos_1')],
      candidates: [],
      applications: [app('app_yetim', { candidateRef: 'cand_yok', positionRef: 'pos_1' })],
    });

    assert.deepEqual(outcome.applicationIdByClient, {});
    assert.equal(
      calls.some((c) => c.sql.includes('INSERT INTO applications')),
      false,
    );
    assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
  });

  it('kendi satırı varsa (önceki adopt) UPDATE ile güncellenir — INSERT atılmaz (idempotens)', async () => {
    const { pool, calls } = makeFakePool({
      dbCandidatesByClient: [{ id: 55, client_id: 'cand_1' }],
      dbPositionsByClient: [{ id: 66, client_id: 'pos_1' }],
      ownApplicationIdByClient: { app_1: 88 },
    });
    const repo = new PgAdoptHrRecruitingRepository(pool);

    const outcome = await repo.adoptAll(1, {
      positions: [],
      candidates: [],
      applications: [app('app_1', { stage: 'offer' })],
    });

    const update = calls.find(
      (c) => c.sql.trimStart().startsWith('UPDATE applications') && c.sql.includes('WHERE id ='),
    );
    assert.ok(update);
    assert.equal(update.values![3], 'offer');
    assert.equal(update.values![9], 88); // kendi satırının id'si
    assert.equal(
      calls.some((c) => c.sql.includes('INSERT INTO applications')),
      false,
    );
    assert.deepEqual(outcome.applicationIdByClient, { app_1: 100 }); // RETURNING id
  });

  it('uq_applications_active_unique DEVRALMA: kendi satırı yokken çakışan aktif satır adopt verisiyle güncellenip client_id alır (500 yok)', async () => {
    const { pool, calls } = makeFakePool({
      dbCandidatesByClient: [{ id: 55, client_id: 'cand_1' }],
      dbPositionsByClient: [{ id: 66, client_id: 'pos_1' }],
      activeConflictId: 91, // CRUD'un aktif başvurusu
    });
    const repo = new PgAdoptHrRecruitingRepository(pool);

    await repo.adoptAll(1, {
      positions: [],
      candidates: [],
      applications: [app('app_1', { stage: 'screening' })],
    });

    const conflictSelect = calls.find((c) =>
      c.sql.includes("stage NOT IN ('hired', 'rejected', 'withdrawn')"),
    );
    assert.ok(conflictSelect);
    assert.deepEqual(conflictSelect.values, [1, 55, 66, null]); // kendi satırı yok

    const takeover = calls.find(
      (c) => c.sql.trimStart().startsWith('UPDATE applications') && c.sql.includes('WHERE id ='),
    );
    assert.ok(takeover);
    assert.equal(takeover.values![8], 'app_1'); // client_id devralındı
    assert.equal(takeover.values![9], 91); // çakışan satır güncellendi
    assert.equal(
      calls.some((c) => c.sql.includes('INSERT INTO applications')),
      false,
    );
    assert.equal(
      calls.some((c) => c.sql.includes('DELETE FROM applications')),
      false,
    );
    assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
  });

  it('SON KAZANIR: kendi satırı VE çakışan aktif satır varsa çakışan silinir, kendi satırı güncellenir', async () => {
    const { pool, calls } = makeFakePool({
      dbCandidatesByClient: [{ id: 55, client_id: 'cand_1' }],
      dbPositionsByClient: [{ id: 66, client_id: 'pos_1' }],
      ownApplicationIdByClient: { app_1: 88 },
      activeConflictId: 91,
    });
    const repo = new PgAdoptHrRecruitingRepository(pool);

    await repo.adoptAll(1, {
      positions: [],
      candidates: [],
      applications: [app('app_1', { stage: 'offer' })],
    });

    const del = calls.find((c) => c.sql.includes('DELETE FROM applications'));
    assert.ok(del);
    assert.deepEqual(del.values, [91]);
    const update = calls.find(
      (c) => c.sql.trimStart().startsWith('UPDATE applications') && c.sql.includes('WHERE id ='),
    );
    assert.ok(update);
    assert.equal(update.values![9], 88); // kendi satırı güncellendi
    assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
  });

  it("terminal stage'de aktif-çift çakışma SELECT'i hiç yapılmaz (partial index dışı)", async () => {
    const { pool, calls } = makeFakePool({
      dbCandidatesByClient: [{ id: 55, client_id: 'cand_1' }],
      dbPositionsByClient: [{ id: 66, client_id: 'pos_1' }],
    });
    const repo = new PgAdoptHrRecruitingRepository(pool);

    await repo.adoptAll(1, {
      positions: [],
      candidates: [],
      applications: [app('app_1', { stage: 'rejected' })],
    });

    assert.equal(
      calls.some((c) => c.sql.includes("stage NOT IN ('hired', 'rejected', 'withdrawn')")),
      false,
    );
    assert.ok(calls.some((c) => c.sql.includes('INSERT INTO applications')));
  });

  it('boş payload: DB sorgusu üretmeden BEGIN/COMMIT ile boş sonuç döner', async () => {
    const { pool, calls } = makeFakePool();
    const repo = new PgAdoptHrRecruitingRepository(pool);

    const outcome = await repo.adoptAll(1, { positions: [], candidates: [], applications: [] });

    assert.deepEqual(outcome, {
      positionIdByClient: {},
      candidateIdByClient: {},
      applicationIdByClient: {},
    });
    assert.deepEqual(
      calls.map((c) => c.sql),
      ['BEGIN', 'COMMIT'],
    );
  });

  it('23505 (beklenmedik benzersizlik çakışması) → HrRecruitingAdoptConflictError (409) + ROLLBACK', async () => {
    const calls: RecordedCall[] = [];
    let released = false;
    const client: AdoptHrRecruitingPoolClient = {
      async query(sql: string, values?: readonly unknown[]) {
        calls.push({ sql, values });
        if (sql.includes('INSERT INTO candidates')) {
          const err = new Error('duplicate key') as Error & { code: string; detail: string };
          err.code = '23505';
          err.detail = 'Key (company_id, client_id)=(1, cand_1) already exists.';
          throw err;
        }
        return { rows: [], rowCount: 0 };
      },
      release() {
        released = true;
      },
    };
    const repo = new PgAdoptHrRecruitingRepository({ connect: async () => client });

    await assert.rejects(
      () => repo.adoptAll(1, { positions: [], candidates: [cand('cand_1')], applications: [] }),
      HrRecruitingAdoptConflictError,
    );
    assert.ok(calls.some((c) => c.sql === 'ROLLBACK'));
    assert.equal(
      calls.some((c) => c.sql === 'COMMIT'),
      false,
    );
    assert.ok(released);
  });

  it('beklenmeyen hata → ROLLBACK + release; hata çağırana fırlar', async () => {
    const { pool, calls, released } = makeFakePool({
      failOn: (sql) => sql.includes('INSERT INTO positions'),
    });
    const repo = new PgAdoptHrRecruitingRepository(pool);

    await assert.rejects(
      () => repo.adoptAll(1, { positions: [pos('pos_1')], candidates: [], applications: [] }),
      /patladı/,
    );
    assert.ok(calls.some((c) => c.sql === 'ROLLBACK'));
    assert.equal(
      calls.some((c) => c.sql === 'COMMIT'),
      false,
    );
    assert.ok(released());
  });
});
