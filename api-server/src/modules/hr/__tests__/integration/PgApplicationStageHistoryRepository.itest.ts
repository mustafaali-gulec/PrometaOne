/**
 * PgApplicationStageHistoryRepository integration test.
 *
 * Doğrulanan davranışlar:
 *   - findByApplication: trigger tarafından oluşturulan satırlar (INSERT'te
 *     from=NULL, UPDATE of stage'de from=OLD) kronolojik (changed_at ASC)
 *     sırayla döner.
 *   - record(): explicit history satırı eklenebilir (manuel not için).
 *   - Birden çok application için izolasyon doğru.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { PgApplicationRepository } from '../../infrastructure/persistence/PgApplicationRepository.js';
import { PgApplicationStageHistoryRepository } from '../../infrastructure/persistence/PgApplicationStageHistoryRepository.js';
import { PgCandidateRepository } from '../../infrastructure/persistence/PgCandidateRepository.js';
import { PgDepartmentRepository } from '../../infrastructure/persistence/PgDepartmentRepository.js';
import { PgOrgUnitRepository } from '../../infrastructure/persistence/PgOrgUnitRepository.js';
import { PgPositionRepository } from '../../infrastructure/persistence/PgPositionRepository.js';

import {
  seedCompany,
  startHrPgContainer,
  truncateAuthAndHrTables,
  type HrPgContext,
} from './setup.js';

describe('PgApplicationStageHistoryRepository [integration]', () => {
  let ctx: HrPgContext;
  let seedCounter = 0;

  before(
    async () => {
      ctx = await startHrPgContainer();
    },
    { timeout: 180_000 },
  );

  after(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  beforeEach(async () => {
    await truncateAuthAndHrTables(ctx.pool);
    await seedCompany(ctx.pool, { id: 1, name: 'Test A.Ş.' });
    seedCounter = 0;
  });

  /**
   * Her çağrıda unique code ile yeni org-unit + department + position +
   * candidate + application oluşturur (UNIQUE constraint çakışmasını
   * engellemek için).
   */
  async function seedApplication(stage: 'new' | 'screening' = 'new'): Promise<number> {
    seedCounter += 1;
    const suffix = String(seedCounter).padStart(2, '0');

    const orgRepo = new PgOrgUnitRepository(ctx.pool);
    const deptRepo = new PgDepartmentRepository(ctx.pool);
    const posRepo = new PgPositionRepository(ctx.pool);
    const candRepo = new PgCandidateRepository(ctx.pool);
    const appRepo = new PgApplicationRepository(ctx.pool);

    const root = await orgRepo.insert({
      companyId: 1,
      parentId: null,
      name: `HQ-${suffix}`,
      code: `HQ-${suffix}`,
      sortOrder: 0,
      active: true,
    });
    const dept = await deptRepo.insert({
      companyId: 1,
      orgUnitId: root.id,
      name: `Eng-${suffix}`,
      code: `ENG-${suffix}`,
      managerEmployeeId: null,
      active: true,
    });
    const pos = await posRepo.insert({
      companyId: 1,
      departmentId: dept.id,
      title: `SE-${suffix}`,
      description: null,
      status: 'open',
      headcountTarget: 1,
      minSalary: null,
      maxSalary: null,
    });
    const cand = await candRepo.insert({
      companyId: 1,
      firstName: 'A',
      lastName: 'V',
      email: null,
      phone: null,
      source: 'direct',
      cvUrl: null,
      notes: null,
    });
    const app = await appRepo.insert({
      companyId: 1,
      candidateId: cand.id,
      positionId: pos.id,
      stage,
      stageChangedBy: null,
      rejectionReason: null,
      salaryExpectation: null,
      notes: null,
    });
    return app.id;
  }

  it('findByApplication: trigger INSERT (from=NULL) satırını döner', async () => {
    const appId = await seedApplication('new');
    const repo = new PgApplicationStageHistoryRepository(ctx.pool);

    const history = await repo.findByApplication(appId);
    assert.equal(history.length, 1);
    assert.equal(history[0]?.fromStage, null);
    assert.equal(history[0]?.toStage, 'new');
  });

  it('findByApplication: çoklu stage transition zincirini kronolojik döner', async () => {
    const appId = await seedApplication('new');
    const appRepo = new PgApplicationRepository(ctx.pool);
    const histRepo = new PgApplicationStageHistoryRepository(ctx.pool);

    // INSERT trigger'ı şu an (NOW()) yazdı. Update'lerin changed_at'i
    // INSERT'ten SONRA olmalı ki ORDER BY changed_at ASC sıralaması:
    // [insert(now), update1(now+1s), update2(now+2s)] sırasıyla gelsin.
    const baseTime = Date.now() + 1000; // INSERT'ten yeterince sonra

    let current = await appRepo.findById(appId, 1);
    assert.ok(current);
    current = current.transitionTo('screening', new Date(baseTime), null);
    await appRepo.update(current);

    current = current.transitionTo('interview', new Date(baseTime + 1000), null);
    await appRepo.update(current);

    const history = await histRepo.findByApplication(appId);
    // INSERT trigger (from=NULL→new) + 2 UPDATE trigger = 3 satır
    assert.equal(history.length, 3);
    assert.deepEqual(
      history.map((h) => ({ from: h.fromStage, to: h.toStage })),
      [
        { from: null, to: 'new' },
        { from: 'new', to: 'screening' },
        { from: 'screening', to: 'interview' },
      ],
    );
  });

  it('record(): manuel history satırı ekler (note ile)', async () => {
    const appId = await seedApplication('new');
    const repo = new PgApplicationStageHistoryRepository(ctx.pool);

    const entry = await repo.record({
      applicationId: appId,
      fromStage: 'new',
      toStage: 'screening',
      changedBy: null,
      changedAt: new Date(Date.now() + 1000),
      note: 'CV güçlü — fast track',
    });

    assert.ok(entry.id > 0);
    assert.equal(entry.note, 'CV güçlü — fast track');

    const history = await repo.findByApplication(appId);
    // INSERT trigger (1) + explicit record (1) = 2
    assert.equal(history.length, 2);
    const manuel = history.find((h) => h.note !== null);
    assert.ok(manuel);
    assert.equal(manuel.note, 'CV güçlü — fast track');
  });

  it("findByApplication: farklı application'lar arasında izolasyon doğru", async () => {
    const appA = await seedApplication('new');
    const appB = await seedApplication('new');
    const repo = new PgApplicationStageHistoryRepository(ctx.pool);

    const histA = await repo.findByApplication(appA);
    const histB = await repo.findByApplication(appB);

    assert.equal(histA.length, 1);
    assert.equal(histB.length, 1);
    assert.notEqual(appA, appB);
    assert.notEqual(histA[0]?.id, histB[0]?.id);
  });
});
