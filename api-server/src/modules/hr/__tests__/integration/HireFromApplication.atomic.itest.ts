/**
 * HireFromApplication atomik rollback integration test.
 *
 * Faz 4-bis: PgUnitOfWork ile sarılmış HireFromApplicationUseCase'in gerçek
 * PG transaction'ı altında atomik garanti verdiğini kanıtlar.
 *
 * Test senaryoları:
 *   1) Happy path — Application 'offer' → hired VE Employee insert, ikisi de
 *      COMMIT olur. Application 'hired' durumda, Employee tablosunda kayıt
 *      var.
 *   2) Rollback (UNIQUE çakışma) — Aynı employee_no daha önce başka bir
 *      Employee'ye verilmiş olsun. HireFromApplication aynı employee_no ile
 *      çağrılırsa employees.insert PG '23505' fırlatır → UoW ROLLBACK.
 *      Application 'offer' durumunda KALMALI ve Employee insert OLMAMALI.
 *
 * Bu test, manuel try/catch rollback (PR 3) ile yapılması mümkün olmayan,
 * iki yazımdan biri-yarıda-kaldı durumunda tutarsızlık riskini ortadan
 * kaldırır. UoW gerçek BEGIN/ROLLBACK kullanır.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { HireFromApplicationUseCase } from '../../application/useCases/HireFromApplicationUseCase.js';
import { PgApplicationRepository } from '../../infrastructure/persistence/PgApplicationRepository.js';
import { PgCandidateRepository } from '../../infrastructure/persistence/PgCandidateRepository.js';
import { PgDepartmentRepository } from '../../infrastructure/persistence/PgDepartmentRepository.js';
import { PgEmployeeRepository } from '../../infrastructure/persistence/PgEmployeeRepository.js';
import { PgOrgUnitRepository } from '../../infrastructure/persistence/PgOrgUnitRepository.js';
import { PgPositionRepository } from '../../infrastructure/persistence/PgPositionRepository.js';
import { PgEmployeeNumberGenerator } from '../../infrastructure/sequences/PgEmployeeNumberGenerator.js';
import { PgUnitOfWork } from '../../infrastructure/unitOfWork/PgUnitOfWork.js';

import {
  seedCompany,
  startHrPgContainer,
  truncateAuthAndHrTables,
  type HrPgContext,
} from './setup.js';

/** Sabit Clock — testlerde audit timestamp deterministik olsun. */
const FIXED_NOW = new Date('2026-05-22T10:00:00Z');
const fixedClock = { now: (): Date => FIXED_NOW };

/** No-op AuditLogger — testlerde audit yan etkisi gerekli değil. */
const noopAudit = {
  log: async (): Promise<void> => {
    /* no-op */
  },
};

describe('HireFromApplication atomic rollback [integration]', () => {
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
   * Test fixture'ı: bir candidate + position + offer'a kadar gelmiş bir
   * application + department. HireFromApplication için gereken ön koşulları
   * hazırlar.
   */
  async function seedReadyToHire(): Promise<{
    departmentId: number;
    applicationId: number;
  }> {
    const orgRepo = new PgOrgUnitRepository(ctx.pool);
    const deptRepo = new PgDepartmentRepository(ctx.pool);
    const posRepo = new PgPositionRepository(ctx.pool);
    const candRepo = new PgCandidateRepository(ctx.pool);
    const appRepo = new PgApplicationRepository(ctx.pool);

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
      title: 'Senior Engineer',
      description: null,
      status: 'open',
      headcountTarget: 1,
      minSalary: 60000,
      maxSalary: 90000,
    });
    const cand = await candRepo.insert({
      companyId: 1,
      firstName: 'Ayşe',
      lastName: 'Yılmaz',
      email: 'ayse@example.com',
      phone: null,
      source: 'linkedin',
      cvUrl: null,
      notes: null,
    });
    // Application'ı doğrudan 'offer' stage'iyle oluştur (transition zincirini
    // burada tekrar test etmiyoruz; HireFromApplicationPolicy'nin tek
    // hareketini test ediyoruz).
    const app = await appRepo.insert({
      companyId: 1,
      candidateId: cand.id,
      positionId: pos.id,
      stage: 'offer',
      stageChangedBy: null,
      rejectionReason: null,
      salaryExpectation: 75000,
      notes: null,
    });
    return { departmentId: dept.id, applicationId: app.id };
  }

  function buildUseCase(): HireFromApplicationUseCase {
    const uow = new PgUnitOfWork(ctx.pool);
    const candRepo = new PgCandidateRepository(ctx.pool);
    const deptRepo = new PgDepartmentRepository(ctx.pool);
    const empNoGen = new PgEmployeeNumberGenerator(ctx.pool, { prefix: 'EMP', width: 4 });
    return new HireFromApplicationUseCase(uow, candRepo, deptRepo, empNoGen, fixedClock, noopAudit);
  }

  it('happy path: Application offer→hired + Employee insert ikisi de COMMIT', async () => {
    const { departmentId, applicationId } = await seedReadyToHire();
    const useCase = buildUseCase();
    const empRepo = new PgEmployeeRepository(ctx.pool);
    const appRepo = new PgApplicationRepository(ctx.pool);

    const employeeDto = await useCase.execute({
      actorUserId: null,
      actorUsername: 'test',
      companyId: 1,
      applicationId,
      departmentId,
      hireDate: '2026-06-01',
    });

    assert.ok(employeeDto.id > 0);
    assert.equal(employeeDto.firstName, 'Ayşe');
    assert.equal(employeeDto.lastName, 'Yılmaz');

    // Application 'hired' olmalı
    const app = await appRepo.findById(applicationId, 1);
    assert.equal(app?.stage, 'hired');

    // Employee insert edilmiş olmalı
    const emp = await empRepo.findById(employeeDto.id, 1);
    assert.ok(emp);
    assert.equal(emp.sourceApplicationId, applicationId);
  });

  it("rollback: aynı employee_no UNIQUE violation → Application offer'da kalır, Employee insert YOK", async () => {
    const { departmentId, applicationId } = await seedReadyToHire();
    const useCase = buildUseCase();
    const empRepo = new PgEmployeeRepository(ctx.pool);
    const appRepo = new PgApplicationRepository(ctx.pool);

    // Önce başka bir employee'yi aynı employee_no ile oluştur — çakışma için.
    // (departmentId'ye doğrudan bir Employee insert ediyoruz; bu işe alım
    // sürecinin dışında bir "pre-existing" çalışan simülasyonu.)
    const COLLISION_NO = 'EMP-COLLIDE-001';
    await empRepo.insert({
      companyId: 1,
      userId: null,
      departmentId,
      positionId: null,
      employeeNo: COLLISION_NO,
      firstName: 'Önce',
      lastName: 'Var',
      tcKimlik: null,
      email: null,
      phone: null,
      hireDate: '2026-01-01',
      status: 'active',
      employmentType: 'full_time',
      sourceApplicationId: null,
    });

    let thrown: Error | null = null;
    try {
      await useCase.execute({
        actorUserId: null,
        actorUsername: 'test',
        companyId: 1,
        applicationId,
        departmentId,
        employeeNo: COLLISION_NO, // ← çakışmayı tetikleyecek
        hireDate: '2026-06-01',
      });
    } catch (err) {
      thrown = err as Error;
    }

    assert.ok(thrown, 'Use case bir hata fırlatmalıydı (UNIQUE violation)');
    assert.match(thrown.message, /employee/i);

    // Application 'offer'da KALMALI (UoW ROLLBACK çalıştı)
    const appAfter = await appRepo.findById(applicationId, 1);
    assert.equal(
      appAfter?.stage,
      'offer',
      'UoW ROLLBACK çalışmadı: Application hala "hired" — atomik garanti ihlal',
    );

    // Yeni bir Employee (collision'ın dışında) insert OLMAMALI
    const allEmps = await empRepo.listByCompany(1);
    assert.equal(
      allEmps.length,
      1,
      "Beklenen: yalnız pre-existing collision employee. Yeni hire transaction'ı rollback olmalıydı.",
    );
    assert.equal(allEmps[0]?.employeeNo.value, COLLISION_NO);
  });

  it('rollback: aynı transaction içinde application_stage_history\'de de "hired" satırı oluşmaz', async () => {
    // Bu test, trigger'ın UoW ROLLBACK ile birlikte geri sarıldığını kanıtlar.
    const { departmentId, applicationId } = await seedReadyToHire();
    const useCase = buildUseCase();
    const empRepo = new PgEmployeeRepository(ctx.pool);

    const COLLISION_NO = 'EMP-COLLIDE-002';
    await empRepo.insert({
      companyId: 1,
      userId: null,
      departmentId,
      positionId: null,
      employeeNo: COLLISION_NO,
      firstName: 'A',
      lastName: 'B',
      tcKimlik: null,
      email: null,
      phone: null,
      hireDate: '2026-01-01',
      status: 'active',
      employmentType: 'full_time',
      sourceApplicationId: null,
    });

    let thrown: Error | null = null;
    try {
      await useCase.execute({
        actorUserId: null,
        actorUsername: 'test',
        companyId: 1,
        applicationId,
        departmentId,
        employeeNo: COLLISION_NO,
        hireDate: '2026-06-01',
      });
    } catch (err) {
      thrown = err as Error;
    }
    assert.ok(thrown);

    // Trigger 'hired' satırı yazmış olmamalı — ROLLBACK ile birlikte geri alındı.
    const r = await ctx.pool.query<{ to_stage: string }>(
      `SELECT to_stage FROM application_stage_history
        WHERE application_id = $1`,
      [applicationId],
    );
    const stages = r.rows.map((row) => row.to_stage);
    // Yalnız ilk INSERT trigger'ından gelen 'offer' satırı (seedReadyToHire'da
    // application 'offer' stage'iyle insert edildi) olmalı; 'hired' yok.
    assert.ok(
      !stages.includes('hired'),
      `'hired' satırı history'de bulunmamalı, ama bulundu: ${JSON.stringify(stages)}`,
    );
  });
});
