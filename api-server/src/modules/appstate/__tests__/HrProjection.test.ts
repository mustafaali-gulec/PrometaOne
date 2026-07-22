/**
 * HrProjection birim testleri — blob→hr tablo eşlemesi, FK zinciri (org unit →
 * departman → pozisyon/çalışan → detaylar), enum haritaları, şema uyum
 * kırpmaları ve düşürme sayaçları.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { APPLICATION_STAGE_MAP, projectHr } from '../domain/HrProjection.js';

/** companyData['2'] altına HR alanları koyan yardımcı. */
function blob(fields: Record<string, unknown>, cid = '2'): unknown {
  return { companyData: { [cid]: fields } };
}

const dept = (id: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  name: 'Departman ' + id,
  orgUnitId: 'ou_1',
  ...over,
});

const emp = (id: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  firstName: 'Ali',
  lastName: 'Veli',
  status: 'active',
  departmentId: 'dept_1',
  startDate: '2025-03-01',
  ...over,
});

describe('projectHr — genel & şirket çözümü', () => {
  it('boş/geçersiz blob → boş projeksiyon (prune sinyali), sayaç yok', () => {
    for (const v of [undefined, null, 42, 'x', [], {}, { companyData: 'bozuk' }]) {
      const p = projectHr(v);
      assert.deepEqual(p.orgUnits, []);
      assert.deepEqual(p.employees, []);
      assert.deepEqual(p.payrollItems, []);
      assert.deepEqual(p.assetAssignments, []);
      assert.deepEqual(p.dropped, {});
    }
  });

  it('şirket anahtarı: sayısal cid → o, sayısal olmayan → 1 (öndeğer)', () => {
    const p = projectHr({
      companyData: {
        '7': { hrOrgUnits: [{ id: 'ou_a', name: 'A' }] },
        comp_promet: { hrOrgUnits: [{ id: 'ou_b', name: 'B' }] },
      },
    });
    assert.equal(p.orgUnits.find((o) => o.clientId === 'ou_a')?.companyId, 7);
    assert.equal(p.orgUnits.find((o) => o.clientId === 'ou_b')?.companyId, 1);
  });

  it('happy: FK zinciri — org unit → departman → pozisyon + çalışan client_id bağları', () => {
    const p = projectHr(
      blob({
        hrOrgUnits: [{ id: 'ou_1', name: 'Genel Müdürlük', code: 'GM-001', parentId: null }],
        hrDepartments: [dept('dept_1', { code: 'YZL', managerEmployeeId: 'emp_1' })],
        hrPositions: [
          {
            id: 'pos_1',
            title: 'Backend Dev',
            departmentId: 'dept_1',
            status: 'open',
            headcount: 2,
            brutMinSalary: 100,
            brutMaxSalary: 200,
            jobDescription: 'Hono',
          },
        ],
        hrEmployees: [emp('emp_1', { sicilNo: 'S-1', email: 'a@b.c', tcNo: '12345678901' })],
      }),
    );

    assert.equal(p.orgUnits.length, 1);
    assert.deepEqual(p.orgUnits[0], {
      companyId: 2,
      clientId: 'ou_1',
      parentClientId: null,
      name: 'Genel Müdürlük',
      code: 'GM-001',
    });

    assert.equal(p.departments.length, 1);
    assert.equal(p.departments[0]!.orgUnitClientId, 'ou_1');
    assert.equal(p.departments[0]!.managerEmployeeClientId, 'emp_1'); // çalışan çözüldü

    assert.equal(p.positions.length, 1);
    assert.deepEqual(p.positions[0], {
      companyId: 2,
      clientId: 'pos_1',
      departmentClientId: 'dept_1',
      title: 'Backend Dev',
      description: 'Hono',
      status: 'open',
      headcountTarget: 2,
      minSalary: 100,
      maxSalary: 200,
    });

    assert.equal(p.employees.length, 1);
    assert.deepEqual(p.employees[0], {
      companyId: 2,
      clientId: 'emp_1',
      departmentClientId: 'dept_1',
      employeeNo: 'S-1',
      firstName: 'Ali',
      lastName: 'Veli',
      tcKimlik: '12345678901',
      email: 'a@b.c',
      phone: null,
      hireDate: '2025-03-01',
      terminationDate: null,
      status: 'active',
      employmentType: 'full_time',
    });
    assert.deepEqual(p.dropped, {});
  });

  it('org unit: self-parent ve cycle kırılır (sayaç), küme dışı parent NULL', () => {
    const p = projectHr(
      blob({
        hrOrgUnits: [
          { id: 'ou_self', name: 'Kendisi', parentId: 'ou_self' },
          { id: 'ou_a', name: 'A', parentId: 'ou_b' },
          { id: 'ou_b', name: 'B', parentId: 'ou_a' }, // a↔b cycle
          { id: 'ou_yetim', name: 'Yetim', parentId: 'ou_yok' },
        ],
      }),
    );
    for (const ou of p.orgUnits) {
      if (ou.clientId === 'ou_self' || ou.clientId === 'ou_yetim') {
        assert.equal(ou.parentClientId, null);
      }
    }
    // Cycle'da en az bir bağ kesilmiş olmalı (a→b→a zinciri kopar).
    const a = p.orgUnits.find((o) => o.clientId === 'ou_a')!;
    const b = p.orgUnits.find((o) => o.clientId === 'ou_b')!;
    assert.ok(a.parentClientId === null || b.parentClientId === null);
    assert.ok((p.dropped['orgUnits.parentCycle'] ?? 0) >= 2); // self + cycle
  });

  it('org unit/departman (company, code) batch içi çift kodda öncekiler NULL (partial unique)', () => {
    const p = projectHr(
      blob({
        hrOrgUnits: [
          { id: 'ou_1', name: 'Bir', code: 'GM' },
          { id: 'ou_2', name: 'İki', code: 'GM' },
        ],
        hrDepartments: [dept('dept_1', { code: 'FIN' }), dept('dept_2', { code: 'FIN' })],
      }),
    );
    const codes = p.orgUnits.map((o) => o.code).sort();
    assert.deepEqual(codes, ['GM', null].sort());
    const dcodes = p.departments.map((d) => d.code).sort();
    assert.deepEqual(dcodes, ['FIN', null].sort());
    assert.equal(p.dropped['orgUnits.duplicateCode'], 1);
    assert.equal(p.dropped['departments.duplicateCode'], 1);
  });
});

describe('projectHr — çalışanlar', () => {
  it('status haritası: maternity/military/suspended→on_leave, bilinmeyen→active', () => {
    const p = projectHr(
      blob({
        hrDepartments: [dept('dept_1')],
        hrEmployees: [
          emp('e1', { status: 'maternity' }),
          emp('e2', { status: 'military' }),
          emp('e3', { status: 'suspended' }),
          emp('e4', { status: 'probation' }),
          emp('e5', { status: 'uydurma' }),
        ],
      }),
    );
    const statusOf = (id: string): string | undefined =>
      p.employees.find((e) => e.clientId === id)?.status;
    assert.equal(statusOf('e1'), 'on_leave');
    assert.equal(statusOf('e2'), 'on_leave');
    assert.equal(statusOf('e3'), 'on_leave');
    assert.equal(statusOf('e4'), 'probation');
    assert.equal(statusOf('e5'), 'active');
  });

  it('terminated + endDate yok → termination_date = hire_date (CHECK uyumu); endDate < startDate kırpılır', () => {
    const p = projectHr(
      blob({
        hrDepartments: [dept('dept_1')],
        hrEmployees: [
          emp('e1', { status: 'terminated' }),
          emp('e2', { endDate: '2024-01-01' }), // startDate 2025-03-01'den önce
        ],
      }),
    );
    const e1 = p.employees.find((e) => e.clientId === 'e1')!;
    assert.equal(e1.status, 'terminated');
    assert.equal(e1.terminationDate, '2025-03-01');
    const e2 = p.employees.find((e) => e.clientId === 'e2')!;
    assert.equal(e2.terminationDate, '2025-03-01'); // hire_date'e kırpıldı
  });

  it('departman zinciri: direkt departmentId yoksa jobTitle üzerinden; o da yoksa DÜŞER (sayaç)', () => {
    const p = projectHr(
      blob({
        hrDepartments: [dept('dept_1')],
        hrJobTitles: [{ id: 'jt_1', title: 'Dev', departmentId: 'dept_1' }],
        hrEmployees: [
          emp('e1', { departmentId: undefined, jobTitleId: 'jt_1' }), // zincirle çözülür
          emp('e2', { departmentId: 'dept_yok', jobTitleId: 'jt_yok' }), // çözülemez
        ],
      }),
    );
    assert.equal(p.employees.length, 1);
    assert.equal(p.employees[0]!.clientId, 'e1');
    assert.equal(p.employees[0]!.departmentClientId, 'dept_1');
    assert.equal(p.dropped['employees.department'], 1);
  });

  it('hire_date: startDate yoksa createdAt(ilk 10); ikisi de yoksa DÜŞER (sayaç)', () => {
    const p = projectHr(
      blob({
        hrDepartments: [dept('dept_1')],
        hrEmployees: [
          emp('e1', { startDate: undefined, createdAt: '2025-06-15T10:00:00.000Z' }),
          emp('e2', { startDate: 'bozuk-tarih', createdAt: undefined }),
        ],
      }),
    );
    assert.equal(p.employees.length, 1);
    assert.equal(p.employees[0]!.hireDate, '2025-06-15');
    assert.equal(p.dropped['employees.hireDate'], 1);
  });

  it('employee_no: sicilNo → clientId fallback; şirket içi çift sicilNo sonrakinde clientId; tc 11 hane değilse NULL + çiftte SON kazanır', () => {
    const p = projectHr(
      blob({
        hrDepartments: [dept('dept_1')],
        hrEmployees: [
          emp('emp_a', { sicilNo: 'S-1', tcNo: '11111111111' }),
          emp('emp_b', { sicilNo: 'S-1', tcNo: '123' }), // çift sicil + kısa tc
          emp('emp_c', { tcNo: '11111111111' }), // tc çifti — SON kazanır
        ],
      }),
    );
    const byId = new Map(p.employees.map((e) => [e.clientId, e]));
    assert.equal(byId.get('emp_a')!.employeeNo, 'S-1');
    assert.equal(byId.get('emp_b')!.employeeNo, 'emp_b'); // clientId'ye düştü
    assert.equal(byId.get('emp_b')!.tcKimlik, null); // 11 hane değil
    assert.equal(byId.get('emp_c')!.employeeNo, 'emp_c'); // sicilNo yok
    assert.equal(byId.get('emp_a')!.tcKimlik, null); // çift tc: önceki NULL'landı
    assert.equal(byId.get('emp_c')!.tcKimlik, '11111111111');
    assert.equal(p.dropped['employees.duplicateEmployeeNo'], 1);
    assert.equal(p.dropped['employees.duplicateTcKimlik'], 1);
  });
});

describe('projectHr — pozisyon / aday / başvuru', () => {
  it('pozisyon status haritası (open→open, on_hold→draft, filled→closed, ?→draft) + min>max takası', () => {
    const p = projectHr(
      blob({
        hrPositions: [
          { id: 'p1', title: 'A', status: 'open' },
          { id: 'p2', title: 'B', status: 'on_hold' },
          { id: 'p3', title: 'C', status: 'filled' },
          { id: 'p4', title: 'D', status: 'garip', brutMinSalary: 300, brutMaxSalary: 100 },
        ],
      }),
    );
    const statusOf = (id: string): string | undefined =>
      p.positions.find((x) => x.clientId === id)?.status;
    assert.equal(statusOf('p1'), 'open');
    assert.equal(statusOf('p2'), 'draft');
    assert.equal(statusOf('p3'), 'closed');
    assert.equal(statusOf('p4'), 'draft');
    const p4 = p.positions.find((x) => x.clientId === 'p4')!;
    assert.equal(p4.minSalary, 100); // CHECK positions_salary_order
    assert.equal(p4.maxSalary, 300);
    // Küme dışı departman bağı NULL'lanır (nullable FK).
    assert.equal(p.positions[0]!.departmentClientId, null);
  });

  it('aday source haritası: kariyer_net→jobboard, university→other, yok→direct', () => {
    const p = projectHr(
      blob({
        hrCandidates: [
          { id: 'c1', firstName: 'A', lastName: 'B', source: 'kariyer_net' },
          { id: 'c2', firstName: 'C', lastName: 'D', source: 'university' },
          { id: 'c3', firstName: 'E', lastName: 'F' },
          { id: 'c4', firstName: '', lastName: 'Adsız' }, // düşer (NOT NULL + CHECK)
        ],
      }),
    );
    const srcOf = (id: string): string | undefined =>
      p.candidates.find((c) => c.clientId === id)?.source;
    assert.equal(srcOf('c1'), 'jobboard');
    assert.equal(srcOf('c2'), 'other');
    assert.equal(srcOf('c3'), 'direct');
    assert.equal(p.candidates.length, 3);
  });

  it('başvuru stage eşleme tablosu: blob RECRUITMENT_STAGES → DB recruitment_stage', () => {
    // Görevde verilen blob stage id'leri birebir kontrol edilir.
    assert.equal(APPLICATION_STAGE_MAP['cv_review'], 'screening');
    assert.equal(APPLICATION_STAGE_MAP['phone_screen'], 'screening');
    assert.equal(APPLICATION_STAGE_MAP['technical'], 'interview');
    assert.equal(APPLICATION_STAGE_MAP['hr_interview'], 'interview');
    assert.equal(APPLICATION_STAGE_MAP['reference'], 'interview');
    assert.equal(APPLICATION_STAGE_MAP['offer'], 'offer');
    assert.equal(APPLICATION_STAGE_MAP['hired'], 'hired');
    assert.equal(APPLICATION_STAGE_MAP['rejected'], 'rejected');
    assert.equal(APPLICATION_STAGE_MAP['withdrawn'], 'withdrawn');

    const p = projectHr(
      blob({
        hrPositions: [
          { id: 'pos_1', title: 'Dev' },
          { id: 'pos_2', title: 'Ops' }, // ayrı çift — aktif dedup tetiklenmesin
        ],
        hrCandidates: [{ id: 'cand_1', firstName: 'A', lastName: 'B' }],
        hrApplications: [
          {
            id: 'app_1',
            candidateId: 'cand_1',
            positionId: 'pos_1',
            stage: 'hr_interview',
            createdAt: '2026-01-01T00:00:00Z',
          },
          { id: 'app_bilinmez', candidateId: 'cand_1', positionId: 'pos_2', stage: 'tuhaf' },
        ],
      }),
    );
    const a1 = p.applications.find((a) => a.clientId === 'app_1')!;
    assert.equal(a1.stage, 'interview');
    assert.equal(a1.stageChangedAt, '2026-01-01T00:00:00Z');
    assert.equal(p.applications.find((a) => a.clientId === 'app_bilinmez')!.stage, 'new');
  });

  it('başvuru FK: candidate/position çözülemeyen düşer; aynı (aday, pozisyon) aktif çiftinde SON kazanır (partial unique)', () => {
    const p = projectHr(
      blob({
        hrPositions: [{ id: 'pos_1', title: 'Dev' }],
        hrCandidates: [{ id: 'cand_1', firstName: 'A', lastName: 'B' }],
        hrApplications: [
          { id: 'app_yetim', candidateId: 'cand_yok', positionId: 'pos_1', stage: 'cv_review' },
          { id: 'app_inbox' }, // ilan-inbox başvurusu: candidateId/positionId yok
          { id: 'app_eski', candidateId: 'cand_1', positionId: 'pos_1', stage: 'cv_review' },
          { id: 'app_terminal', candidateId: 'cand_1', positionId: 'pos_1', stage: 'rejected' },
          { id: 'app_yeni', candidateId: 'cand_1', positionId: 'pos_1', stage: 'offer' },
        ],
      }),
    );
    const ids = p.applications.map((a) => a.clientId).sort();
    // Terminal (rejected) satır partial index'e girmez → kalır; aktiflerden SON kazanır.
    assert.deepEqual(ids, ['app_terminal', 'app_yeni']);
    assert.equal(p.dropped['applications.fk'], 2);
    assert.equal(p.dropped['applications.duplicateActive'], 1);
  });
});

describe('projectHr — izin / bordro / zimmet', () => {
  it('izin: tür haritası (leave_ öneki + paternity→other), durum, gün fallback, tarih kırpma, çözülemeyen çalışan düşer', () => {
    const p = projectHr(
      blob({
        hrDepartments: [dept('dept_1')],
        hrEmployees: [emp('emp_1')],
        hrLeaveRequests: [
          {
            id: 'lr_1',
            employeeId: 'emp_1',
            leaveType: 'leave_annual',
            startDate: '2026-07-01',
            endDate: '2026-07-05',
            totalDays: 3,
            status: 'approved',
            approvedAt: '2026-06-20T09:00:00Z',
            approverNote: 'iyi tatiller',
          },
          {
            id: 'lr_2',
            employeeId: 'emp_1',
            leaveType: 'paternity',
            startDate: '2026-08-10',
            endDate: '2026-08-12', // totalDays yok → takvim farkı 3
            status: 'uydurma',
          },
          {
            id: 'lr_3',
            employeeId: 'emp_1',
            leaveType: 'sick',
            startDate: '2026-09-05',
            endDate: '2026-09-01', // end < start → start'a kırpılır, 1 gün
            status: 'rejected',
            rejectedAt: '2026-09-06T00:00:00Z',
            rejectionReason: 'rapor yok',
          },
          { id: 'lr_yetim', employeeId: 'emp_yok', startDate: '2026-01-01', endDate: '2026-01-02' },
        ],
      }),
    );
    const byId = new Map(p.leaveRequests.map((l) => [l.clientId, l]));
    assert.equal(p.leaveRequests.length, 3);

    const l1 = byId.get('lr_1')!;
    assert.equal(l1.leaveType, 'annual');
    assert.equal(l1.days, 3);
    assert.equal(l1.status, 'approved');
    assert.equal(l1.decidedAt, '2026-06-20T09:00:00Z');
    assert.equal(l1.decisionNote, 'iyi tatiller');

    const l2 = byId.get('lr_2')!;
    assert.equal(l2.leaveType, 'other'); // paternity → other
    assert.equal(l2.days, 3); // fallback: takvim günü farkı (dahil)
    assert.equal(l2.status, 'pending'); // bilinmeyen → pending

    const l3 = byId.get('lr_3')!;
    assert.equal(l3.endDate, '2026-09-05'); // CHECK date_order kırpması
    assert.equal(l3.days, 1);
    assert.equal(l3.decisionNote, 'rapor yok');

    assert.equal(p.dropped['leaveRequests.employee'], 1);
  });

  it('bordro: dönem doğrulama + confirmed→finalized + (şirket, yıl, ay) çiftinde SON kazanır; items alan eşlemesi + other_deductions türetimi', () => {
    const p = projectHr(
      blob({
        hrDepartments: [dept('dept_1')],
        hrEmployees: [emp('emp_1'), emp('emp_2', { sicilNo: 'S-2' })],
        hrPayrollRuns: [
          {
            id: 'pr_eski',
            period: { year: 2026, month: 6 },
            status: 'draft',
            results: [{ employee: { id: 'emp_1' }, totals: { gross: 1, net: 1 }, taxes: {} }],
          },
          {
            id: 'pr_yeni',
            period: { year: 2026, month: 6 }, // aynı dönem → öncekini eler
            status: 'confirmed',
            confirmedAt: '2026-07-01T00:00:00Z',
            results: [
              {
                employee: { id: 'emp_1' },
                totals: { gross: 1000, net: 700, totalDeductions: 300 },
                taxes: { sgkEmployee: 140, unempEmployee: 10, incomeTax: 90, stampDuty: 10 },
              },
              { employee: { id: 'emp_yok' }, totals: {}, taxes: {} }, // düşer
            ],
          },
          { id: 'pr_bozuk', period: { year: 2026, month: 13 } }, // ay aralık dışı
        ],
      }),
    );
    assert.equal(p.payrollRuns.length, 1);
    const run = p.payrollRuns[0]!;
    assert.equal(run.clientId, 'pr_yeni');
    assert.equal(run.status, 'finalized');
    assert.equal(run.finalizedAt, '2026-07-01T00:00:00Z');
    assert.equal(run.periodYear, 2026);
    assert.equal(run.periodMonth, 6);

    assert.equal(p.payrollItems.length, 1); // eski koşunun item'ları da elendi
    const item = p.payrollItems[0]!;
    assert.equal(item.clientId, 'pr_yeni:emp_1');
    assert.equal(item.grossSalary, 1000);
    assert.equal(item.sgkEmployee, 140);
    assert.equal(item.unemployment, 10);
    assert.equal(item.incomeTax, 90);
    assert.equal(item.stampTax, 10);
    assert.equal(item.otherDeductions, 50); // 300 - (140+10+90+10)
    assert.equal(item.netSalary, 700);

    assert.equal(p.dropped['payrollRuns.period'], 1);
    assert.equal(p.dropped['payrollRuns.duplicatePeriod'], 1);
    assert.equal(p.dropped['payrollItems.employee'], 1);
  });

  it('zimmet: tür/durum haritası (bilinmeyen→other/in_stock), ad fallback zinciri, açık atama sentezi; çözülemeyen atama NULL', () => {
    const p = projectHr(
      blob({
        hrDepartments: [dept('dept_1')],
        hrEmployees: [emp('emp_1')],
        hrAssets: [
          {
            id: 'as_1',
            assetType: 'laptop',
            brand: 'Dell',
            model: 'XPS',
            status: 'assigned',
            assignedEmployeeId: 'emp_1',
            assignedDate: '2026-05-01',
          },
          { id: 'as_2', assetType: 'ışın kılıcı', status: 'kayıp gibi' }, // bilinmeyenler
          { id: 'as_3', assetType: 'phone', status: 'assigned', assignedEmployeeId: 'emp_yok' },
        ],
      }),
    );
    const byId = new Map(p.assets.map((a) => [a.clientId, a]));
    const a1 = byId.get('as_1')!;
    assert.equal(a1.assetType, 'laptop');
    assert.equal(a1.status, 'assigned');
    assert.equal(a1.name, 'Dell XPS'); // name yok → "marka model"
    assert.equal(a1.assignedEmployeeClientId, 'emp_1');

    const a2 = byId.get('as_2')!;
    assert.equal(a2.assetType, 'other');
    assert.equal(a2.status, 'in_stock');
    assert.equal(a2.name, 'other'); // marka/model de yok → assetType

    const a3 = byId.get('as_3')!;
    assert.equal(a3.assignedEmployeeClientId, null); // çözülemedi → NULL (nullable FK)

    // Açık atama yalnız assigned + çözülen çalışan için sentezlenir.
    assert.equal(p.assetAssignments.length, 1);
    assert.deepEqual(p.assetAssignments[0], {
      companyId: 2,
      clientId: 'as_1',
      assetClientId: 'as_1',
      employeeClientId: 'emp_1',
      assignedAt: '2026-05-01',
    });
    assert.equal(p.dropped['assets.assignedEmployee'], 1);
  });
});
