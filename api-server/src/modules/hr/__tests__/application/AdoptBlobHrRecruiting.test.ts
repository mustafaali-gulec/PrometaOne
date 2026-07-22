/**
 * AdoptBlobHrRecruitingUseCase birim testleri — blob normalizasyonu, enum
 * haritaları (HrProjection TEK KAYNAK), idempotens, referans çözümü
 * (clientId → serverId; çağrı-içi + DB-önceki), aktif (candidate, position)
 * çifti çağrı-içi dedupe, boş gövde.
 *
 * FakeAdoptHrRecruitingRepository, PgAdoptHrRecruitingRepository ile aynı
 * sözleşmeyi in-memory uygular: (companyId, clientId) upsert; başvuru
 * referansları önce bu çağrının haritasından, sonra "DB"deki mevcut
 * kayıtlardan çözülür; çözülemeyen başvuru düşer (transaction bozulmaz).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  NormalizedAdoptApplication,
  NormalizedAdoptCandidate,
  NormalizedAdoptPosition,
} from '../../application/dto/AdoptHrRecruitingDtos.js';
import type {
  AdoptHrRecruitingOutcome,
  AdoptHrRecruitingPayload,
  AdoptHrRecruitingRepository,
} from '../../application/ports/AdoptHrRecruitingRepository.js';
import { AdoptBlobHrRecruitingUseCase } from '../../application/useCases/AdoptBlobHrRecruitingUseCase.js';

class FakeAdoptHrRecruitingRepository implements AdoptHrRecruitingRepository {
  private nextId = 1;
  readonly positions = new Map<string, { id: number; row: NormalizedAdoptPosition }>();
  readonly candidates = new Map<string, { id: number; row: NormalizedAdoptCandidate }>();
  readonly applications = new Map<
    string,
    { id: number; row: NormalizedAdoptApplication; candidateId: number; positionId: number }
  >();
  calls = 0;

  private key(companyId: number, clientId: string): string {
    return `${companyId} ${clientId}`;
  }

  adoptAll(
    companyId: number,
    payload: AdoptHrRecruitingPayload,
  ): Promise<AdoptHrRecruitingOutcome> {
    this.calls += 1;
    const positionIdByClient: Record<string, number> = {};
    const candidateIdByClient: Record<string, number> = {};
    const applicationIdByClient: Record<string, number> = {};

    for (const p of payload.positions) {
      const k = this.key(companyId, p.clientId);
      const id = this.positions.get(k)?.id ?? this.nextId++;
      this.positions.set(k, { id, row: p });
      positionIdByClient[p.clientId] = id;
    }
    for (const c of payload.candidates) {
      const k = this.key(companyId, c.clientId);
      const id = this.candidates.get(k)?.id ?? this.nextId++;
      this.candidates.set(k, { id, row: c });
      candidateIdByClient[c.clientId] = id;
    }
    for (const a of payload.applications) {
      // Referans çözümü: önce bu çağrının haritası, sonra "DB" (önceki adopt).
      const candidateId =
        candidateIdByClient[a.candidateRef] ??
        this.candidates.get(this.key(companyId, a.candidateRef))?.id;
      const positionId =
        positionIdByClient[a.positionRef] ??
        this.positions.get(this.key(companyId, a.positionRef))?.id;
      if (candidateId === undefined || positionId === undefined) continue; // düşer
      const k = this.key(companyId, a.clientId);
      const id = this.applications.get(k)?.id ?? this.nextId++;
      this.applications.set(k, { id, row: a, candidateId, positionId });
      applicationIdByClient[a.clientId] = id;
    }

    return Promise.resolve({ positionIdByClient, candidateIdByClient, applicationIdByClient });
  }
}

/** Blob'daki gerçek şekillerle örnek gövde (HrProjection.ts doğrulanmış eşlemesi). */
const blobBody = () => ({
  companyId: 1,
  positions: [
    {
      id: 'pos_1719912345678_dev',
      title: 'Backend Developer',
      departmentId: 'dept_1719912345680_yzl', // MEZUN departman referansı — repo çözer
      status: 'open',
      headcount: 2,
      brutMinSalary: 100_000,
      brutMaxSalary: 200_000,
      jobDescription: 'Hono + PostgreSQL',
      requirements: 'kolon yok — taşınmaz',
      location: 'İstanbul', // kolon yok — taşınmaz
    },
  ],
  candidates: [
    {
      id: 'cand_1719912345681_ayse',
      firstName: 'Ayşe',
      lastName: 'Kaya',
      email: 'ayse@example.com',
      phone: '+90 555 111 22 33',
      source: 'kariyer_net', // → jobboard
      cvUrl: 'https://cv.example.com/ayse.pdf',
      notes: 'güçlü aday',
    },
  ],
  applications: [
    {
      id: 'app_1719912345682_1',
      candidateId: 'cand_1719912345681_ayse',
      positionId: 'pos_1719912345678_dev',
      stage: 'hr_interview', // → interview
      salaryExpectation: 150_000,
      notes: 'ikinci tur bekleniyor',
      createdAt: '2026-07-01T09:00:00Z',
      updatedAt: '2026-07-10T10:00:00Z',
    },
  ],
});

describe('AdoptBlobHrRecruitingUseCase', () => {
  it('happy: blob alanları normalize edilir; enum haritaları uygulanır; başvuru referansları çağrı-içi çözülür', async () => {
    const repo = new FakeAdoptHrRecruitingRepository();
    const sut = new AdoptBlobHrRecruitingUseCase(repo);

    const res = await sut.execute(blobBody());

    assert.deepEqual(res.adopted, { positions: 1, candidates: 1, applications: 1 });
    const posId = res.idMap.positions['pos_1719912345678_dev'];
    const candId = res.idMap.candidates['cand_1719912345681_ayse'];
    const appId = res.idMap.applications['app_1719912345682_1'];
    assert.ok(posId !== undefined && candId !== undefined && appId !== undefined);

    const pos = repo.positions.get('1 pos_1719912345678_dev')!.row;
    assert.equal(pos.title, 'Backend Developer');
    assert.equal(pos.status, 'open');
    assert.equal(pos.headcountTarget, 2);
    assert.equal(pos.minSalary, 100_000);
    assert.equal(pos.maxSalary, 200_000);
    assert.equal(pos.description, 'Hono + PostgreSQL'); // jobDescription önce
    assert.equal(pos.departmentRef, 'dept_1719912345680_yzl'); // olduğu gibi — repo çözer

    const cand = repo.candidates.get('1 cand_1719912345681_ayse')!.row;
    assert.equal(cand.firstName, 'Ayşe');
    assert.equal(cand.source, 'jobboard'); // kariyer_net → jobboard
    assert.equal(cand.cvUrl, 'https://cv.example.com/ayse.pdf');

    const app = repo.applications.get('1 app_1719912345682_1')!;
    assert.equal(app.row.stage, 'interview'); // hr_interview → interview
    assert.equal(app.row.stageChangedAt, '2026-07-10T10:00:00Z'); // updatedAt önce
    assert.equal(app.row.salaryExpectation, 150_000);
    assert.equal(app.candidateId, candId); // çağrı-içi harita ile çözüldü
    assert.equal(app.positionId, posId);
  });

  it('idempotens: aynı gövde ikinci kez → aynı idMap, dupe yok', async () => {
    const repo = new FakeAdoptHrRecruitingRepository();
    const sut = new AdoptBlobHrRecruitingUseCase(repo);

    const first = await sut.execute(blobBody());
    const second = await sut.execute(blobBody());

    assert.deepEqual(second.adopted, { positions: 1, candidates: 1, applications: 1 });
    assert.deepEqual(second.idMap, first.idMap); // serverId'ler kararlı
    assert.equal(repo.positions.size, 1);
    assert.equal(repo.candidates.size, 1);
    assert.equal(repo.applications.size, 1);
  });

  it('referans çözümü: başvuru, ÖNCEKİ adopt çağrısında yazılmış candidate/position kayıtlarına bağlanabilir', async () => {
    const repo = new FakeAdoptHrRecruitingRepository();
    const sut = new AdoptBlobHrRecruitingUseCase(repo);

    const body = blobBody();
    const first = await sut.execute({
      companyId: 1,
      positions: body.positions,
      candidates: body.candidates,
    });
    const second = await sut.execute({ companyId: 1, applications: body.applications });

    assert.deepEqual(second.adopted, { positions: 0, candidates: 0, applications: 1 });
    const app = repo.applications.get('1 app_1719912345682_1')!;
    assert.equal(app.candidateId, first.idMap.candidates['cand_1719912345681_ayse']);
    assert.equal(app.positionId, first.idMap.positions['pos_1719912345678_dev']);
  });

  it('çözülemeyen candidate/position referansı: başvuru DÜŞER (adopted/idMap dışı), hata fırlamaz', async () => {
    const repo = new FakeAdoptHrRecruitingRepository();
    const sut = new AdoptBlobHrRecruitingUseCase(repo);

    const res = await sut.execute({
      companyId: 1,
      applications: [
        { id: 'app_yetim', candidateId: 'cand_yok', positionId: 'pos_yok', stage: 'offer' },
        { id: 'app_inbox', stage: 'cv_review' }, // ilan-inbox: candidateId/positionId yok
      ],
    });

    assert.deepEqual(res.adopted, { positions: 0, candidates: 0, applications: 0 });
    assert.deepEqual(res.idMap.applications, {});
    assert.equal(repo.applications.size, 0);
    assert.equal(repo.calls, 1); // app_yetim repo'ya gitti ama orada düştü
  });

  it('stage haritası (HrProjection TEK KAYNAK): cv_review/phone_screen→screening, technical/reference→interview, terminal→aynı, bilinmeyen→new', async () => {
    const repo = new FakeAdoptHrRecruitingRepository();
    const sut = new AdoptBlobHrRecruitingUseCase(repo);

    // Her başvuru ayrı çift — aktif dedup tetiklenmesin.
    const mk = (n: number, stage: string) => ({
      id: `app_${n}`,
      candidateId: `cand_${n}`,
      positionId: `pos_${n}`,
      stage,
    });
    await sut.execute({
      companyId: 1,
      positions: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `pos_${n}`, title: `P${n}` })),
      candidates: [1, 2, 3, 4, 5, 6].map((n) => ({
        id: `cand_${n}`,
        firstName: 'A',
        lastName: `${n}`,
      })),
      applications: [
        mk(1, 'cv_review'),
        mk(2, 'phone_screen'),
        mk(3, 'technical'),
        mk(4, 'reference'),
        mk(5, 'hired'),
        mk(6, 'tuhaf-stage'),
      ],
    });

    const stageOf = (id: string): string => repo.applications.get(`1 ${id}`)!.row.stage;
    assert.equal(stageOf('app_1'), 'screening');
    assert.equal(stageOf('app_2'), 'screening');
    assert.equal(stageOf('app_3'), 'interview');
    assert.equal(stageOf('app_4'), 'interview');
    assert.equal(stageOf('app_5'), 'hired');
    assert.equal(stageOf('app_6'), 'new');
  });

  it("aktif (candidate, position) çiftinde çağrı-içi SON kazanır; terminal stage'ler partial index dışı — kalır", async () => {
    const repo = new FakeAdoptHrRecruitingRepository();
    const sut = new AdoptBlobHrRecruitingUseCase(repo);

    const res = await sut.execute({
      companyId: 1,
      positions: [{ id: 'pos_1', title: 'Dev' }],
      candidates: [{ id: 'cand_1', firstName: 'A', lastName: 'B' }],
      applications: [
        { id: 'app_eski', candidateId: 'cand_1', positionId: 'pos_1', stage: 'cv_review' },
        { id: 'app_terminal', candidateId: 'cand_1', positionId: 'pos_1', stage: 'rejected' },
        { id: 'app_yeni', candidateId: 'cand_1', positionId: 'pos_1', stage: 'offer' },
      ],
    });

    const ids = Object.keys(res.idMap.applications).sort();
    assert.deepEqual(ids, ['app_terminal', 'app_yeni']); // aktiflerden SON kazandı
    assert.equal(repo.applications.has('1 app_eski'), false);
  });

  it("gevşek coercion: id'siz/başlıksız/adsız kayıt atlanır; clientId dupe'unda SON kazanır; min>max takası; headcount tabanı; bilinmeyen enum fallback", async () => {
    const repo = new FakeAdoptHrRecruitingRepository();
    const sut = new AdoptBlobHrRecruitingUseCase(repo);

    const res = await sut.execute({
      companyId: 1,
      positions: [
        { title: 'idsiz — atlanır' },
        { id: 'pos_bassiz', title: '   ' }, // başlıksız — atlanır (NOT NULL + CHECK)
        { id: 'pos_1', title: 'Eski Başlık', status: 'on_hold' },
        {
          id: 'pos_1', // aynı clientId → SON kazanır
          title: 'Yeni Başlık',
          status: 'filled',
          brutMinSalary: 300,
          brutMaxSalary: 100, // min>max → takas (CHECK positions_salary_order)
          headcount: 2.9, // → 2 (floor)
        },
      ],
      candidates: [
        { id: 'cand_adsiz', firstName: '', lastName: 'X' }, // atlanır
        { id: 'cand_1', firstName: 'A', lastName: 'B', source: 'uzaylı-kaynak' }, // → direct
      ],
    });

    assert.deepEqual(res.adopted, { positions: 1, candidates: 1, applications: 0 });
    const pos = repo.positions.get('1 pos_1')!.row;
    assert.equal(pos.title, 'Yeni Başlık'); // SON kazandı
    assert.equal(pos.status, 'closed'); // filled → closed
    assert.equal(pos.minSalary, 100);
    assert.equal(pos.maxSalary, 300);
    assert.equal(pos.headcountTarget, 2);
    assert.equal(repo.candidates.get('1 cand_1')!.row.source, 'direct');
  });

  it('boş gövde → sıfır sonuç, repo hiç çağrılmaz (idempotent no-op)', async () => {
    const repo = new FakeAdoptHrRecruitingRepository();
    const sut = new AdoptBlobHrRecruitingUseCase(repo);

    const res = await sut.execute({ companyId: 1 });

    assert.deepEqual(res, {
      adopted: { positions: 0, candidates: 0, applications: 0 },
      idMap: { positions: {}, candidates: {}, applications: {} },
    });
    assert.equal(repo.calls, 0);
  });
});
