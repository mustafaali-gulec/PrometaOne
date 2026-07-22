/**
 * AdoptBlobHrOrgUseCase birim testleri — blob normalizasyonu, idempotens,
 * referans çözümü (clientId → serverId), cycle kırma, boş gövde.
 *
 * FakeAdoptHrOrgRepository, PgAdoptHrOrgRepository ile aynı sözleşmeyi
 * in-memory uygular: (companyId, clientId) upsert; parent/orgUnit referansları
 * önce bu çağrının haritasından, sonra "DB"deki mevcut kayıtlardan çözülür;
 * manager yalnız "DB"deki çalışan client_id'lerine bağlanır.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  NormalizedAdoptDepartment,
  NormalizedAdoptOrgUnit,
} from '../../application/dto/AdoptHrOrgDtos.js';
import type {
  AdoptHrOrgOutcome,
  AdoptHrOrgPayload,
  AdoptHrOrgRepository,
} from '../../application/ports/AdoptHrOrgRepository.js';
import { AdoptBlobHrOrgUseCase } from '../../application/useCases/AdoptBlobHrOrgUseCase.js';

class FakeAdoptHrOrgRepository implements AdoptHrOrgRepository {
  private nextId = 1;
  readonly orgUnits = new Map<
    string,
    { id: number; row: NormalizedAdoptOrgUnit; parentId: number | null }
  >();
  readonly departments = new Map<
    string,
    {
      id: number;
      row: NormalizedAdoptDepartment;
      orgUnitId: number | null;
      managerId: number | null;
    }
  >();
  /** "DB"deki çalışanlar: clientId → id (manager çözümü için). */
  readonly employeesByClientId = new Map<string, number>();
  calls = 0;

  private key(companyId: number, clientId: string): string {
    return `${companyId} ${clientId}`;
  }

  adoptAll(companyId: number, payload: AdoptHrOrgPayload): Promise<AdoptHrOrgOutcome> {
    this.calls += 1;
    const orgUnitIdByClient: Record<string, number> = {};
    const departmentIdByClient: Record<string, number> = {};

    // 1. geçiş: org unit upsert (dupe üretmez).
    for (const ou of payload.orgUnits) {
      const k = this.key(companyId, ou.clientId);
      const existing = this.orgUnits.get(k);
      const id = existing?.id ?? this.nextId++;
      this.orgUnits.set(k, { id, row: ou, parentId: null });
      orgUnitIdByClient[ou.clientId] = id;
    }
    // 2. geçiş: parent — önce bu çağrı, sonra "DB" (önceki adopt).
    for (const ou of payload.orgUnits) {
      if (ou.parentClientId === null) continue;
      const parentId =
        orgUnitIdByClient[ou.parentClientId] ??
        this.orgUnits.get(this.key(companyId, ou.parentClientId))?.id ??
        null;
      this.orgUnits.get(this.key(companyId, ou.clientId))!.parentId = parentId;
    }

    for (const d of payload.departments) {
      const orgUnitId =
        d.orgUnitClientId !== null
          ? (orgUnitIdByClient[d.orgUnitClientId] ??
            this.orgUnits.get(this.key(companyId, d.orgUnitClientId))?.id ??
            null)
          : null;
      const managerId =
        d.managerEmployeeClientId !== null
          ? (this.employeesByClientId.get(d.managerEmployeeClientId) ?? null)
          : null;
      const k = this.key(companyId, d.clientId);
      const existing = this.departments.get(k);
      const id = existing?.id ?? this.nextId++;
      this.departments.set(k, { id, row: d, orgUnitId, managerId });
      departmentIdByClient[d.clientId] = id;
    }

    return Promise.resolve({ orgUnitIdByClient, departmentIdByClient });
  }
}

/** Blob'daki gerçek şekillerle örnek gövde (HrProjection.ts doğrulanmış eşlemesi). */
const blobBody = () => ({
  companyId: 1,
  orgUnits: [
    { id: 'ou_1719912345678_gm', name: 'Genel Müdürlük', code: 'GM', parentId: null, type: 'hq' },
    {
      id: 'ou_1719912345679_sube',
      name: 'İstanbul Şube',
      code: 'IST',
      parentId: 'ou_1719912345678_gm',
      managerEmployeeId: 'emp_1', // org_units'ta kolon yok → taşınmaz
      authorizedUsers: ['ali'],
    },
  ],
  departments: [
    {
      id: 'dept_1719912345680_yzl',
      name: 'Yazılım',
      code: 'YZL',
      color: '#f00', // kolon yok → taşınmaz
      orgUnitId: 'ou_1719912345679_sube',
      parentDeptId: null, // kolon yok → taşınmaz
      managerEmployeeId: 'emp_1719912345681_ali',
    },
  ],
});

describe('AdoptBlobHrOrgUseCase', () => {
  it('happy: blob alanları normalize edilir; parent/orgUnit/manager referansları çözülür', async () => {
    const repo = new FakeAdoptHrOrgRepository();
    repo.employeesByClientId.set('emp_1719912345681_ali', 77);
    const sut = new AdoptBlobHrOrgUseCase(repo);

    const res = await sut.execute(blobBody());

    assert.deepEqual(res.adopted, { orgUnits: 2, departments: 1 });
    const gmId = res.idMap.orgUnits['ou_1719912345678_gm'];
    const subeId = res.idMap.orgUnits['ou_1719912345679_sube'];
    const deptId = res.idMap.departments['dept_1719912345680_yzl'];
    assert.ok(gmId !== undefined && subeId !== undefined && deptId !== undefined);

    const sube = repo.orgUnits.get('1 ou_1719912345679_sube')!;
    assert.equal(sube.row.name, 'İstanbul Şube');
    assert.equal(sube.row.code, 'IST');
    assert.equal(sube.parentId, gmId); // çağrı-içi harita ile çözüldü

    const dept = repo.departments.get('1 dept_1719912345680_yzl')!;
    assert.equal(dept.row.name, 'Yazılım');
    assert.equal(dept.orgUnitId, subeId);
    assert.equal(dept.managerId, 77); // employees.client_id eşleşti
  });

  it('idempotens: aynı gövde ikinci kez → aynı idMap, dupe yok', async () => {
    const repo = new FakeAdoptHrOrgRepository();
    const sut = new AdoptBlobHrOrgUseCase(repo);

    const first = await sut.execute(blobBody());
    const second = await sut.execute(blobBody());

    assert.deepEqual(second.adopted, { orgUnits: 2, departments: 1 });
    assert.deepEqual(second.idMap, first.idMap); // serverId'ler kararlı
    assert.equal(repo.orgUnits.size, 2);
    assert.equal(repo.departments.size, 1);
  });

  it("referans çözümü: departman, ÖNCEKİ adopt çağrısında yazılmış org unit'e bağlanabilir", async () => {
    const repo = new FakeAdoptHrOrgRepository();
    const sut = new AdoptBlobHrOrgUseCase(repo);

    const body = blobBody();
    const first = await sut.execute({ companyId: 1, orgUnits: body.orgUnits });
    const second = await sut.execute({ companyId: 1, departments: body.departments });

    assert.deepEqual(second.adopted, { orgUnits: 0, departments: 1 });
    const dept = repo.departments.get('1 dept_1719912345680_yzl')!;
    assert.equal(dept.orgUnitId, first.idMap.orgUnits['ou_1719912345679_sube']);
    assert.equal(dept.managerId, null); // employees'ta eşleşme yok → NULL
  });

  it("parent self/cycle çağrı-içi kümede kırılır (DB cycle trigger'ı tetiklenmesin)", async () => {
    const repo = new FakeAdoptHrOrgRepository();
    const sut = new AdoptBlobHrOrgUseCase(repo);

    await sut.execute({
      companyId: 1,
      orgUnits: [
        { id: 'ou_self', name: 'Kendisi', parentId: 'ou_self' },
        { id: 'ou_a', name: 'A', parentId: 'ou_b' },
        { id: 'ou_b', name: 'B', parentId: 'ou_a' }, // a↔b cycle
        { id: 'ou_dis', name: 'Dış', parentId: 'ou_db' }, // çağrı dışı → repo çözer
      ],
    });

    assert.equal(repo.orgUnits.get('1 ou_self')!.row.parentClientId, null);
    const a = repo.orgUnits.get('1 ou_a')!.row;
    const b = repo.orgUnits.get('1 ou_b')!.row;
    assert.ok(a.parentClientId === null || b.parentClientId === null); // zincir koptu
    assert.equal(repo.orgUnits.get('1 ou_dis')!.row.parentClientId, 'ou_db'); // korunur
  });

  it('boş gövde → sıfır sonuç, repo hiç çağrılmaz (idempotent no-op)', async () => {
    const repo = new FakeAdoptHrOrgRepository();
    const sut = new AdoptBlobHrOrgUseCase(repo);

    const res = await sut.execute({ companyId: 1 });

    assert.deepEqual(res, {
      adopted: { orgUnits: 0, departments: 0 },
      idMap: { orgUnits: {}, departments: {} },
    });
    assert.equal(repo.calls, 0);
  });

  it("gevşek coercion: id'siz/adsız kayıt atlanır; clientId dupe'unda SON kazanır; batch içi çift kodda öncekiler NULL", async () => {
    const repo = new FakeAdoptHrOrgRepository();
    const sut = new AdoptBlobHrOrgUseCase(repo);

    const res = await sut.execute({
      companyId: 1,
      orgUnits: [
        { name: 'idsiz — atlanır' },
        { id: 'ou_adsiz', name: '   ' }, // adsız — atlanır (NOT NULL + CHECK)
        { id: 'ou_1', name: 'Eski Ad', code: 'GM' },
        { id: 'ou_1', name: 'Yeni Ad', code: 'GM' }, // aynı clientId → SON kazanır
        { id: 'ou_2', name: 'İki', code: 'GM' }, // çift kod → önceki NULL'lanır
      ],
      departments: [
        { id: 'dept_1', name: 'Fin', code: 'FIN' },
        { id: 'dept_2', name: 'Fin 2', code: 'FIN' }, // çift kod → önceki NULL'lanır
      ],
    });

    assert.deepEqual(res.adopted, { orgUnits: 2, departments: 2 });
    assert.equal(repo.orgUnits.size, 2);
    const ou1 = repo.orgUnits.get('1 ou_1')!.row;
    assert.equal(ou1.name, 'Yeni Ad'); // SON kazandı
    assert.equal(ou1.code, null); // çift kodda önceki NULL'landı
    assert.equal(repo.orgUnits.get('1 ou_2')!.row.code, 'GM');
    assert.equal(repo.departments.get('1 dept_1')!.row.code, null);
    assert.equal(repo.departments.get('1 dept_2')!.row.code, 'FIN');
  });
});
