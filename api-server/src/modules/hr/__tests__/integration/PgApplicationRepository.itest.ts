/**
 * PgApplicationRepository integration test — gerçek PostgreSQL üzerinde.
 *
 * Doğrulanan davranışlar:
 *   - insert/update/findById/listByCompany/countByStage
 *   - Stage transition'ları (entity.transitionTo + repo.update) — terminal
 *     stage'lere doğru sırada gider.
 *   - DB trigger `applications_stage_history`: INSERT'te (from=NULL) ve UPDATE
 *     of stage'de (from=OLD) otomatik history satırı düşer.
 *   - hasActiveApplicationsForCandidate: terminal stage'ler aktif sayılmaz.
 *   - listByCompany positionId / candidateId / stage filtreleri.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { PgApplicationRepository } from '../../infrastructure/persistence/PgApplicationRepository.js';
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

describe('PgApplicationRepository [integration]', () => {
  let ctx: HrPgContext;

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
  });

  /**
   * Test fixture'ı: bir candidate + open pozisyon + departman ağacı.
   * Her test bu seti çağırarak başlangıç noktasını oluşturur.
   */
  async function seedBaseFixture(): Promise<{ candidateId: number; positionId: number }> {
    const orgRepo = new PgOrgUnitRepository(ctx.pool);
    const deptRepo = new PgDepartmentRepository(ctx.pool);
    const posRepo = new PgPositionRepository(ctx.pool);
    const candRepo = new PgCandidateRepository(ctx.pool);

    const root = await orgRepo.insert({
      companyId: 1,
      parentId: null,
      name: 'HQ',
      code: 'HQ',
      sortOrder: 0,
      active: true,
    });
    const dept = await deptRepo.insert({
      companyId: 1,
      orgUnitId: root.id,
      name: 'Engineering',
      code: 'ENG',
      managerEmployeeId: null,
      active: true,
    });
    const pos = await posRepo.insert({
      companyId: 1,
      departmentId: dept.id,
      title: 'Software Engineer',
      description: null,
      status: 'open',
      headcountTarget: 1,
      minSalary: 50000,
      maxSalary: 80000,
    });
    const cand = await candRepo.insert({
      companyId: 1,
      firstName: 'Ali',
      lastName: 'Veli',
      email: 'ali@example.com',
      phone: null,
      source: 'linkedin',
      cvUrl: null,
      notes: null,
    });
    return { candidateId: cand.id, positionId: pos.id };
  }

  it("insert: başvuru oluşturur; trigger application_stage_history'ye INSERT satırı düşer (from=NULL)", async () => {
    const { candidateId, positionId } = await seedBaseFixture();
    const repo = new PgApplicationRepository(ctx.pool);

    const app = await repo.insert({
      companyId: 1,
      candidateId,
      positionId,
      stage: 'new',
      stageChangedBy: null,
      rejectionReason: null,
      salaryExpectation: 70000,
      notes: 'CV iyi',
    });

    assert.ok(app.id > 0);
    assert.equal(app.stage, 'new');
    assert.equal(app.salaryExpectation, 70000);

    // Trigger doğrulaması: 1 history satırı, from_stage NULL
    const r = await ctx.pool.query<{ from_stage: string | null; to_stage: string }>(
      `SELECT from_stage, to_stage FROM application_stage_history
        WHERE application_id = $1 ORDER BY id ASC`,
      [app.id],
    );
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0]?.from_stage, null);
    assert.equal(r.rows[0]?.to_stage, 'new');
  });

  it("update: stage transition new→screening trigger history'ye from=new ekler", async () => {
    const { candidateId, positionId } = await seedBaseFixture();
    const repo = new PgApplicationRepository(ctx.pool);

    const app = await repo.insert({
      companyId: 1,
      candidateId,
      positionId,
      stage: 'new',
      stageChangedBy: null,
      rejectionReason: null,
      salaryExpectation: null,
      notes: null,
    });

    const screening = app.transitionTo('screening', new Date(), null);
    await repo.update(screening);

    const found = await repo.findById(app.id, 1);
    assert.equal(found?.stage, 'screening');

    // Trigger: artık 2 history satırı, ikincisi from=new to=screening
    const r = await ctx.pool.query<{ from_stage: string | null; to_stage: string }>(
      `SELECT from_stage, to_stage FROM application_stage_history
        WHERE application_id = $1 ORDER BY id ASC`,
      [app.id],
    );
    assert.equal(r.rows.length, 2);
    assert.equal(r.rows[1]?.from_stage, 'new');
    assert.equal(r.rows[1]?.to_stage, 'screening');
  });

  it('listByCompany: stage / candidateId / positionId filtreleri', async () => {
    const { candidateId, positionId } = await seedBaseFixture();
    const repo = new PgApplicationRepository(ctx.pool);
    const candRepo = new PgCandidateRepository(ctx.pool);
    const cand2 = await candRepo.insert({
      companyId: 1,
      firstName: 'Bob',
      lastName: 'Jones',
      email: null,
      phone: null,
      source: 'referral',
      cvUrl: null,
      notes: null,
    });

    await repo.insert({
      companyId: 1,
      candidateId,
      positionId,
      stage: 'screening',
      stageChangedBy: null,
      rejectionReason: null,
      salaryExpectation: null,
      notes: null,
    });
    await repo.insert({
      companyId: 1,
      candidateId: cand2.id,
      positionId,
      stage: 'interview',
      stageChangedBy: null,
      rejectionReason: null,
      salaryExpectation: null,
      notes: null,
    });

    const byStage = await repo.listByCompany(1, { stage: 'interview' });
    assert.equal(byStage.length, 1);
    assert.equal(byStage[0]?.candidateId, cand2.id);

    const byCandidate = await repo.listByCompany(1, { candidateId });
    assert.equal(byCandidate.length, 1);
    assert.equal(byCandidate[0]?.candidateId, candidateId);

    const byPosition = await repo.listByCompany(1, { positionId });
    assert.equal(byPosition.length, 2);
  });

  it("countByStage: stage başına dağılım map'i döner", async () => {
    const { candidateId, positionId } = await seedBaseFixture();
    const repo = new PgApplicationRepository(ctx.pool);
    const candRepo = new PgCandidateRepository(ctx.pool);
    const cand2 = await candRepo.insert({
      companyId: 1,
      firstName: 'C2',
      lastName: 'L2',
      email: null,
      phone: null,
      source: 'direct',
      cvUrl: null,
      notes: null,
    });
    const cand3 = await candRepo.insert({
      companyId: 1,
      firstName: 'C3',
      lastName: 'L3',
      email: null,
      phone: null,
      source: 'direct',
      cvUrl: null,
      notes: null,
    });

    await repo.insert({
      companyId: 1,
      candidateId,
      positionId,
      stage: 'new',
      stageChangedBy: null,
      rejectionReason: null,
      salaryExpectation: null,
      notes: null,
    });
    await repo.insert({
      companyId: 1,
      candidateId: cand2.id,
      positionId,
      stage: 'new',
      stageChangedBy: null,
      rejectionReason: null,
      salaryExpectation: null,
      notes: null,
    });
    await repo.insert({
      companyId: 1,
      candidateId: cand3.id,
      positionId,
      stage: 'interview',
      stageChangedBy: null,
      rejectionReason: null,
      salaryExpectation: null,
      notes: null,
    });

    const counts = await repo.countByStage(1);
    assert.equal(counts.get('new'), 2);
    assert.equal(counts.get('interview'), 1);
    assert.equal(counts.get('offer') ?? 0, 0);
  });

  it('hasActiveApplicationsForCandidate: rejected/withdrawn/hired aktif sayılmaz', async () => {
    const { candidateId, positionId } = await seedBaseFixture();
    const repo = new PgApplicationRepository(ctx.pool);

    // 1) Aktif başvuru yokken → false
    assert.equal(await repo.hasActiveApplicationsForCandidate(candidateId, 1), false);

    // 2) new başvuru → true
    const a = await repo.insert({
      companyId: 1,
      candidateId,
      positionId,
      stage: 'new',
      stageChangedBy: null,
      rejectionReason: null,
      salaryExpectation: null,
      notes: null,
    });
    assert.equal(await repo.hasActiveApplicationsForCandidate(candidateId, 1), true);

    // 3) reject → terminal → false (yeniden başvurabilir)
    const rejected = a.transitionTo('rejected', new Date(), null);
    await repo.update(rejected);
    assert.equal(await repo.hasActiveApplicationsForCandidate(candidateId, 1), false);
  });

  it('multi-tenant: farklı şirketten findById null döner', async () => {
    const { candidateId, positionId } = await seedBaseFixture();
    await seedCompany(ctx.pool, { id: 2, name: 'Diğer Şirket' });
    const repo = new PgApplicationRepository(ctx.pool);

    const a = await repo.insert({
      companyId: 1,
      candidateId,
      positionId,
      stage: 'new',
      stageChangedBy: null,
      rejectionReason: null,
      salaryExpectation: null,
      notes: null,
    });

    const fromOther = await repo.findById(a.id, 2);
    assert.equal(fromOther, null);
  });
});
