/**
 * FAZ 2 — Fiziksel ilerleme takibi testleri (node:test runner).
 *
 * Referans sayılar Imperium demo projesinden alındı ve elle doğrulandı:
 *   Temel(40): işler 4/1/72/23, durumlar 100/100/50/50 → grup %52,5
 *   Kaba(40) : 5×20, üçü tamam + biri eksikli(%75)     → grup %75,0
 *   Çatı(20) : 50/30/20, karkas %30 kısmi              → grup %15,0
 *   Lokasyon = 52,5×0,4 + 75×0,4 + 15×0,2 = %54,0
 *   Proje (etki %45) = %24,30
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { buildTrackingBoard } from '../../application/dto/TrackingDtos.js';
import {
  AddTrackingLocationsUseCase,
  ChangeTrackingStatusUseCase,
  CreateProgressTemplateUseCase,
  CreateTrackingUseCase,
  GetProjectPhysicalProgressUseCase,
  GetTrackingBoardUseCase,
  GetTrackingItemHistoryUseCase,
  ListTrackingsUseCase,
  RemoveTrackingLocationUseCase,
  SaveTemplateBodyUseCase,
  SetTrackingItemStateUseCase,
  SyncTrackingWithTemplateUseCase,
} from '../../application/useCases/TrackingUseCases.js';
import { Tracking } from '../../domain/entities/Tracking.js';
import {
  DuplicateProgressTemplateCodeError,
  InvalidStatusTransitionError,
  InvalidTrackingScopeError,
  TrackingItemNotFoundError,
  TrackingNotActiveError,
} from '../../domain/errors/ConstructionErrors.js';
import { itemStatePct, rollupWeighted } from '../../domain/valueObjects/ItemState.js';
import {
  canTransitionTracking,
  scopeAcceptsKind,
} from '../../domain/valueObjects/TrackingStatus.js';
import { FixedClock, InMemoryProjectRepository } from '../fakes.js';
import {
  InMemoryLocationRepository,
  InMemoryProgressTemplateRepository,
  InMemoryTrackingRepository,
} from '../locationTrackingFakes.js';

const DEMO_BODY = {
  groups: [
    {
      code: 'TML',
      name: 'Temel',
      weightPct: 40,
      sortOrder: 0,
      items: [
        { code: 'T1', name: 'Dolgu İşleri', weightPct: 4, sortOrder: 0, pozId: null },
        { code: 'T2', name: 'Temel Drenajı', weightPct: 1, sortOrder: 1, pozId: null },
        { code: 'T3', name: 'Temel Grobetonu ve Radye', weightPct: 72, sortOrder: 2, pozId: null },
        { code: 'T4', name: 'Temel Kazısı', weightPct: 23, sortOrder: 3, pozId: null },
      ],
    },
    {
      code: 'KBA',
      name: 'Kaba İnşaat',
      weightPct: 40,
      sortOrder: 1,
      items: [
        { code: 'K1', name: 'Zemin Kalıp', weightPct: 20, sortOrder: 0, pozId: null },
        { code: 'K2', name: 'Zemin Demir', weightPct: 20, sortOrder: 1, pozId: null },
        { code: 'K3', name: 'Zemin Beton', weightPct: 20, sortOrder: 2, pozId: null },
        { code: 'K4', name: '1.Kat Kalıp', weightPct: 20, sortOrder: 3, pozId: null },
        { code: 'K5', name: '1.Kat Demir', weightPct: 20, sortOrder: 4, pozId: null },
      ],
    },
    {
      code: 'CTI',
      name: 'Çatı',
      weightPct: 20,
      sortOrder: 2,
      items: [
        { code: 'C1', name: 'Çatı Karkas', weightPct: 50, sortOrder: 0, pozId: null },
        { code: 'C2', name: 'Çatı Örtüsü', weightPct: 30, sortOrder: 1, pozId: null },
        { code: 'C3', name: 'İzolasyon İşleri', weightPct: 20, sortOrder: 2, pozId: null },
      ],
    },
  ],
} as const;

describe('ItemState — durum → yüzde', () => {
  it('not_started 0, completed 100 sabittir', () => {
    assert.equal(itemStatePct('not_started'), 0);
    assert.equal(itemStatePct('completed'), 100);
  });

  it('ara durumlar şablonun eşlemesinden gelir', () => {
    assert.equal(itemStatePct('in_progress'), 50);
    assert.equal(itemStatePct('has_defects'), 75);
    assert.equal(itemStatePct('in_progress', { inProgress: 30, hasDefects: 90 }), 30);
    assert.equal(itemStatePct('has_defects', { inProgress: 30, hasDefects: 90 }), 90);
  });

  it('override yüzdesi durumu ezer', () => {
    assert.equal(itemStatePct('in_progress', { inProgress: 50, hasDefects: 75 }, 30), 30);
    // 0 geçerli bir override; null/undefined ile karıştırılmamalı
    assert.equal(itemStatePct('completed', { inProgress: 50, hasDefects: 75 }, 0), 0);
  });
});

describe('rollupWeighted', () => {
  it('Temel grubu: 4/1/72/23 ağırlıkla 100/100/50/50 → %52,5', () => {
    const pct = rollupWeighted([
      { pct: 100, itemWeight: 4, groupWeight: 1 },
      { pct: 100, itemWeight: 1, groupWeight: 1 },
      { pct: 50, itemWeight: 72, groupWeight: 1 },
      { pct: 50, itemWeight: 23, groupWeight: 1 },
    ]);
    assert.equal(pct, 52.5);
  });

  it('ağırlık toplamı 100 değilse de normalize eder', () => {
    // Ağırlıklar 50 topluyor ama oran korunur
    const pct = rollupWeighted([
      { pct: 100, itemWeight: 25, groupWeight: 1 },
      { pct: 0, itemWeight: 25, groupWeight: 1 },
    ]);
    assert.equal(pct, 50);
  });

  it('ağırlık toplamı 0 ise 0 döner (bölme hatası yok)', () => {
    assert.equal(rollupWeighted([{ pct: 100, itemWeight: 0, groupWeight: 0 }]), 0);
    assert.equal(rollupWeighted([]), 0);
  });
});

describe('TrackingStatus — geçişler ve kapsam', () => {
  it('taslak → aktif → tamamlandı akışı', () => {
    assert.equal(canTransitionTracking('draft', 'active'), true);
    assert.equal(canTransitionTracking('active', 'completed'), true);
  });

  it('tamamlanan takip yeniden açılabilir (kabulde eksik çıkarsa)', () => {
    assert.equal(canTransitionTracking('completed', 'active'), true);
  });

  it('iptal terminaldir', () => {
    assert.equal(canTransitionTracking('cancelled', 'active'), false);
    assert.equal(canTransitionTracking('cancelled', 'draft'), false);
  });

  it('taslaktan doğrudan tamamlandıya geçilemez', () => {
    assert.equal(canTransitionTracking('draft', 'completed'), false);
  });

  it('kapsam yalnız kendi lokasyon tipini kabul eder', () => {
    assert.equal(scopeAcceptsKind('block', 'block'), true);
    assert.equal(scopeAcceptsKind('block', 'unit'), false);
    assert.equal(scopeAcceptsKind('unit', 'unit'), true);
    assert.equal(scopeAcceptsKind('general', 'site'), true);
    assert.equal(scopeAcceptsKind('general', 'block'), false);
  });
});

describe('Tracking.plannedPctAt — takvim bazlı beklenen ilerleme', () => {
  const make = (plannedStart: string | null, plannedEnd: string | null): Tracking =>
    Tracking.create({
      id: 1,
      companyId: 1,
      projectId: 1,
      templateId: 1,
      code: 'GDT-001',
      name: 'T',
      projectWeightPct: 50,
      plannedStart,
      plannedEnd,
      status: 'active',
      assignedUserId: null,
      visibleAll: true,
      note: null,
      createdBy: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });

  it('başlangıçta 0, bitişte 100', () => {
    const t = make('2026-01-01', '2026-12-31');
    assert.equal(t.plannedPctAt('2026-01-01'), 0);
    assert.equal(t.plannedPctAt('2026-12-31'), 100);
  });

  it('aralık dışında sınırlara oturur', () => {
    const t = make('2026-01-01', '2026-12-31');
    assert.equal(t.plannedPctAt('2025-06-01'), 0);
    assert.equal(t.plannedPctAt('2027-06-01'), 100);
  });

  it('ortada doğrusal', () => {
    const t = make('2026-01-01', '2026-01-11'); // 10 gün
    assert.equal(t.plannedPctAt('2026-01-06'), 50);
  });

  it('plan tarihi yoksa null döner — 0 varsayıp "önde" göstermez', () => {
    assert.equal(make(null, '2026-12-31').plannedPctAt('2026-06-01'), null);
    assert.equal(make('2026-01-01', null).plannedPctAt('2026-06-01'), null);
    assert.equal(make(null, null).plannedPctAt('2026-06-01'), null);
  });

  it('başlangıç bitişten sonraysa oluşturmayı reddeder', () => {
    assert.throws(() => make('2026-12-31', '2026-01-01'));
  });
});

describe('TrackingUseCases (uçtan uca fake repolarla)', () => {
  let locations: InMemoryLocationRepository;
  let templates: InMemoryProgressTemplateRepository;
  let trackings: InMemoryTrackingRepository;
  let projects: InMemoryProjectRepository;
  let clock: FixedClock;
  let projectId: number;
  let aBlokId: number;
  let bBlokId: number;
  let unitId: number;

  beforeEach(async () => {
    locations = new InMemoryLocationRepository();
    templates = new InMemoryProgressTemplateRepository();
    trackings = new InMemoryTrackingRepository(templates, locations);
    projects = new InMemoryProjectRepository();
    clock = new FixedClock(new Date('2026-06-06T00:00:00.000Z'));

    const p = await projects.insert({
      companyId: 1,
      code: 'PRJ-001',
      name: 'Demo Proje',
      projectType: 'private',
      status: 'active',
      orgUnitId: null,
      managerUserId: null,
      location: null,
      startDate: '2026-01-01',
      plannedEnd: '2026-12-31',
      budgetAmount: 0,
      currency: 'TRY',
      createdBy: null,
    });
    projectId = p.id;

    const site = await locations.insert({
      companyId: 1,
      projectId,
      parentId: null,
      kind: 'site',
      code: 'S',
      name: 'Saha',
      sortOrder: 0,
      unitType: null,
      grossArea: null,
      netArea: null,
      landShare: null,
      facade: null,
      createdBy: null,
    });
    const a = await locations.insert({
      companyId: 1,
      projectId,
      parentId: site.id,
      kind: 'block',
      code: 'A',
      name: 'A Blok',
      sortOrder: 0,
      unitType: null,
      grossArea: null,
      netArea: null,
      landShare: null,
      facade: null,
      createdBy: null,
    });
    const b = await locations.insert({
      companyId: 1,
      projectId,
      parentId: site.id,
      kind: 'block',
      code: 'B',
      name: 'B Blok',
      sortOrder: 1,
      unitType: null,
      grossArea: null,
      netArea: null,
      landShare: null,
      facade: null,
      createdBy: null,
    });
    const floor = await locations.insert({
      companyId: 1,
      projectId,
      parentId: a.id,
      kind: 'floor',
      code: '2',
      name: '2',
      sortOrder: 0,
      unitType: null,
      grossArea: null,
      netArea: null,
      landShare: null,
      facade: null,
      createdBy: null,
    });
    const unit = await locations.insert({
      companyId: 1,
      projectId,
      parentId: floor.id,
      kind: 'unit',
      code: '18',
      name: '18',
      sortOrder: 0,
      unitType: '2+1',
      grossArea: null,
      netArea: null,
      landShare: null,
      facade: null,
      createdBy: null,
    });
    aBlokId = a.id;
    bBlokId = b.id;
    unitId = unit.id;
  });

  const makeTemplate = async (): Promise<number> => {
    const dto = await new CreateProgressTemplateUseCase(templates).execute({
      companyId: 1,
      name: 'Blok Bazlı Takip Şablonu',
      scope: 'block',
      body: DEMO_BODY,
    });
    return dto.id;
  };

  const makeActiveTracking = async (
    templateId: number,
    locationIds: number[],
    weight = 45,
  ): Promise<number> => {
    const t = await new CreateTrackingUseCase(trackings, templates, projects, locations).execute({
      companyId: 1,
      projectId,
      templateId,
      name: 'Blok Bazlı Takip',
      projectWeightPct: weight,
      locationIds,
    });
    await new ChangeTrackingStatusUseCase(trackings, clock).execute({
      trackingId: t.id,
      companyId: 1,
      status: 'active',
    });
    return t.id;
  };

  /** Board'dan iş kalemi id'sini şablon koduna göre bulur. */
  const itemIdByName = async (trackingId: number, itemName: string): Promise<number> => {
    const board = await new GetTrackingBoardUseCase(trackings, templates, clock).execute({
      trackingId,
      companyId: 1,
    });
    for (const loc of board.locations) {
      for (const g of loc.groups) {
        const found = g.items.find((i) => i.itemName === itemName);
        if (found) return found.trackingItemId;
      }
    }
    throw new Error(`iş bulunamadı: ${itemName}`);
  };

  it('şablon kodunu GDS-NNN olarak üretir ve ağırlık tutarlılığını raporlar', async () => {
    const dto = await new CreateProgressTemplateUseCase(templates).execute({
      companyId: 1,
      name: 'Şablon',
      body: DEMO_BODY,
    });
    assert.equal(dto.code, 'GDS-001');
    assert.equal(dto.itemCount, 12);
    assert.deepEqual(dto.weightIssues, [], 'demo şablon ağırlıkları 100e tümlenir');
    assert.deepEqual(dto.scopeLocationKinds, ['block']);
  });

  it('ağırlıkları 100e tümlenmeyen şablonu KAYDEDER ama uyarı üretir', async () => {
    const dto = await new CreateProgressTemplateUseCase(templates).execute({
      companyId: 1,
      name: 'Eksik',
      body: {
        groups: [
          {
            code: 'G1',
            name: 'Grup 1',
            weightPct: 30, // şablon toplamı 30 ≠ 100
            sortOrder: 0,
            items: [{ code: 'I1', name: 'İş 1', weightPct: 80, sortOrder: 0, pozId: null }], // grup içi 80 ≠ 100
          },
        ],
      },
    });
    assert.equal(dto.weightIssues.length, 2);
    assert.ok(dto.weightIssues.some((w) => w.level === 'template' && w.sum === 30));
    assert.ok(dto.weightIssues.some((w) => w.level === 'group' && w.sum === 80));
  });

  it('boş grup ağırlık uyarısı üretmez', async () => {
    const dto = await new CreateProgressTemplateUseCase(templates).execute({
      companyId: 1,
      name: 'Boş grup',
      body: { groups: [{ code: 'G', name: 'G', weightPct: 100, sortOrder: 0, items: [] }] },
    });
    assert.deepEqual(dto.weightIssues, []);
  });

  it('aynı şablon kodunu reddeder', async () => {
    const uc = new CreateProgressTemplateUseCase(templates);
    await uc.execute({ companyId: 1, name: 'A', code: 'GDS-X' });
    await assert.rejects(
      () => uc.execute({ companyId: 1, name: 'B', code: 'GDS-X' }),
      DuplicateProgressTemplateCodeError,
    );
  });

  it('gövde kaydederken etkilenecek takip sayısını bildirir', async () => {
    const templateId = await makeTemplate();
    templates.usageCounts.set(templateId, 3);
    const res = await new SaveTemplateBodyUseCase(templates).execute({
      templateId,
      companyId: 1,
      body: DEMO_BODY,
    });
    assert.equal(res.affectedTrackings, 3);
  });

  it('takip kurulunca şablonun tüm işleri her lokasyon için materyalize edilir', async () => {
    const templateId = await makeTemplate();
    const trackingId = await makeActiveTracking(templateId, [aBlokId, bBlokId]);
    const items = await trackings.listItems(trackingId, 1);
    assert.equal(items.length, 12 * 2, '12 iş × 2 blok');
    assert.ok(items.every((i) => i.state === 'not_started'));
  });

  it('kapsam tipine uymayan lokasyonu reddeder (blok şablonuna daire)', async () => {
    const templateId = await makeTemplate();
    await assert.rejects(
      () =>
        new CreateTrackingUseCase(trackings, templates, projects, locations).execute({
          companyId: 1,
          projectId,
          templateId,
          name: 'Hatalı',
          locationIds: [unitId],
        }),
      InvalidTrackingScopeError,
    );
  });

  it('takip tarihleri verilmezse projenin tarihlerini devralır', async () => {
    const templateId = await makeTemplate();
    const t = await new CreateTrackingUseCase(trackings, templates, projects, locations).execute({
      companyId: 1,
      projectId,
      templateId,
      name: 'T',
      locationIds: [aBlokId],
    });
    assert.equal(t.plannedStart, '2026-01-01');
    assert.equal(t.plannedEnd, '2026-12-31');
  });

  it('taslak takibe saha verisi girilemez', async () => {
    const templateId = await makeTemplate();
    const t = await new CreateTrackingUseCase(trackings, templates, projects, locations).execute({
      companyId: 1,
      projectId,
      templateId,
      name: 'T',
      locationIds: [aBlokId],
    });
    const items = await trackings.listItems(t.id, 1);
    await assert.rejects(
      () =>
        new SetTrackingItemStateUseCase(trackings).execute({
          trackingId: t.id,
          companyId: 1,
          updates: [{ trackingItemId: items[0]!.id, state: 'completed' }],
        }),
      TrackingNotActiveError,
    );
  });

  it('tamamlanmış takibe saha verisi girilemez', async () => {
    const templateId = await makeTemplate();
    const trackingId = await makeActiveTracking(templateId, [aBlokId]);
    await new ChangeTrackingStatusUseCase(trackings, clock).execute({
      trackingId,
      companyId: 1,
      status: 'completed',
    });
    const items = await trackings.listItems(trackingId, 1);
    await assert.rejects(
      () =>
        new SetTrackingItemStateUseCase(trackings).execute({
          trackingId,
          companyId: 1,
          updates: [{ trackingItemId: items[0]!.id, state: 'completed' }],
        }),
      TrackingNotActiveError,
    );
  });

  it('başka takibe ait iş kalemine yazmayı reddeder', async () => {
    const templateId = await makeTemplate();
    const t1 = await makeActiveTracking(templateId, [aBlokId]);
    const t2 = await new CreateTrackingUseCase(trackings, templates, projects, locations).execute({
      companyId: 1,
      projectId,
      templateId,
      name: 'İkinci',
      locationIds: [bBlokId],
    });
    await new ChangeTrackingStatusUseCase(trackings, clock).execute({
      trackingId: t2.id,
      companyId: 1,
      status: 'active',
    });
    const t2Items = await trackings.listItems(t2.id, 1);

    await assert.rejects(
      () =>
        new SetTrackingItemStateUseCase(trackings).execute({
          trackingId: t1,
          companyId: 1,
          updates: [{ trackingItemId: t2Items[0]!.id, state: 'completed' }],
        }),
      TrackingItemNotFoundError,
    );
  });

  it('geçersiz durum geçişini reddeder', async () => {
    const templateId = await makeTemplate();
    const t = await new CreateTrackingUseCase(trackings, templates, projects, locations).execute({
      companyId: 1,
      projectId,
      templateId,
      name: 'T',
      locationIds: [aBlokId],
    });
    await assert.rejects(
      () =>
        new ChangeTrackingStatusUseCase(trackings, clock).execute({
          trackingId: t.id,
          companyId: 1,
          status: 'completed',
        }),
      InvalidStatusTransitionError,
    );
  });

  describe('rollup — Imperium demo sayıları', () => {
    /** Demo senaryosunu A bloğa uygular. */
    const applyDemoStates = async (trackingId: number): Promise<void> => {
      const set = new SetTrackingItemStateUseCase(trackings);
      const id = (n: string): Promise<number> => itemIdByName(trackingId, n);
      await set.execute({
        trackingId,
        companyId: 1,
        changedBy: 7,
        updates: [
          { trackingItemId: await id('Dolgu İşleri'), state: 'completed' },
          { trackingItemId: await id('Temel Drenajı'), state: 'completed' },
          { trackingItemId: await id('Temel Grobetonu ve Radye'), state: 'in_progress' },
          { trackingItemId: await id('Temel Kazısı'), state: 'in_progress' },
          { trackingItemId: await id('Zemin Kalıp'), state: 'completed' },
          { trackingItemId: await id('Zemin Demir'), state: 'completed' },
          { trackingItemId: await id('Zemin Beton'), state: 'completed' },
          { trackingItemId: await id('1.Kat Kalıp'), state: 'has_defects' },
          { trackingItemId: await id('Çatı Karkas'), state: 'in_progress', overridePct: 30 },
        ],
      });
    };

    it('lokasyon %54,0 (21 + 30 + 3)', async () => {
      const templateId = await makeTemplate();
      const trackingId = await makeActiveTracking(templateId, [aBlokId]);
      await applyDemoStates(trackingId);

      const locProgress = await trackings.locationProgress(trackingId, 1);
      assert.equal(locProgress.length, 1);
      assert.equal(locProgress[0]!.progressPct, 54);
      assert.equal(locProgress[0]!.completedCount, 5);
      assert.equal(locProgress[0]!.defectCount, 1);
      assert.equal(locProgress[0]!.inProgressCount, 3);
    });

    it('proje fiziksel % = 54,0 × 0,45 = 24,30 ; weight_sum 45', async () => {
      const templateId = await makeTemplate();
      const trackingId = await makeActiveTracking(templateId, [aBlokId], 45);
      await applyDemoStates(trackingId);

      const summary = await new GetProjectPhysicalProgressUseCase(
        trackings,
        projects,
        clock,
      ).execute({ projectId, companyId: 1 });
      assert.equal(summary.progressPct, 24.3);
      assert.equal(summary.weightSum, 45);
      assert.equal(summary.unmeasuredWeight, 55, 'ölçülmeyen %55 ayrıca bildirilmeli');
    });

    it('iki lokasyonlu takipte eşit ağırlıklı ortalama: (54 + 0)/2 = %27', async () => {
      const templateId = await makeTemplate();
      const trackingId = await makeActiveTracking(templateId, [aBlokId, bBlokId]);
      await applyDemoStates(trackingId);

      const prog = await trackings.trackingProgress(trackingId, 1);
      assert.equal(prog?.progressPct, 27);
    });

    it('lokasyon ağırlığı farklıysa ağırlıklı ortalama alır', async () => {
      const templateId = await makeTemplate();
      const t = await new CreateTrackingUseCase(trackings, templates, projects, locations).execute({
        companyId: 1,
        projectId,
        templateId,
        name: 'Ağırlıklı',
        projectWeightPct: 100,
        locationIds: [aBlokId, bBlokId],
        // A bloğu 3 kat ağır
        locationWeights: { [String(aBlokId)]: 3, [String(bBlokId)]: 1 },
      });
      await new ChangeTrackingStatusUseCase(trackings, clock).execute({
        trackingId: t.id,
        companyId: 1,
        status: 'active',
      });
      await applyDemoStates(t.id);

      const prog = await trackings.trackingProgress(t.id, 1);
      // (54×3 + 0×1) / 4 = 40,5
      assert.equal(prog?.progressPct, 40.5);
    });

    it('iptal edilen takip proje yüzdesine katılmaz', async () => {
      const templateId = await makeTemplate();
      const t1 = await makeActiveTracking(templateId, [aBlokId], 45);
      await applyDemoStates(t1);

      const t2 = await new CreateTrackingUseCase(trackings, templates, projects, locations).execute(
        {
          companyId: 1,
          projectId,
          templateId,
          name: 'İptal edilecek',
          projectWeightPct: 55,
          locationIds: [bBlokId],
        },
      );

      const withBoth = await new GetProjectPhysicalProgressUseCase(
        trackings,
        projects,
        clock,
      ).execute({ projectId, companyId: 1 });
      assert.equal(withBoth.weightSum, 100);
      assert.equal(withBoth.progressPct, 24.3, 'ikinci takip %0 olduğu için toplam değişmez');

      await new ChangeTrackingStatusUseCase(trackings, clock).execute({
        trackingId: t2.id,
        companyId: 1,
        status: 'cancelled',
      });
      const afterCancel = await new GetProjectPhysicalProgressUseCase(
        trackings,
        projects,
        clock,
      ).execute({ projectId, companyId: 1 });
      assert.equal(afterCancel.weightSum, 45);
      assert.equal(afterCancel.trackingCount, 1);
    });
  });

  describe('saha ekranı (board)', () => {
    it('grup ilerlemesini grup İÇİ ağırlıklara göre verir', async () => {
      const templateId = await makeTemplate();
      const trackingId = await makeActiveTracking(templateId, [aBlokId]);
      const set = new SetTrackingItemStateUseCase(trackings);
      await set.execute({
        trackingId,
        companyId: 1,
        updates: [
          { trackingItemId: await itemIdByName(trackingId, 'Dolgu İşleri'), state: 'completed' },
          { trackingItemId: await itemIdByName(trackingId, 'Temel Drenajı'), state: 'completed' },
          {
            trackingItemId: await itemIdByName(trackingId, 'Temel Grobetonu ve Radye'),
            state: 'in_progress',
          },
          { trackingItemId: await itemIdByName(trackingId, 'Temel Kazısı'), state: 'in_progress' },
        ],
      });

      const board = await new GetTrackingBoardUseCase(trackings, templates, clock).execute({
        trackingId,
        companyId: 1,
      });
      const temel = board.locations[0]!.groups.find((g) => g.groupName === 'Temel');
      assert.equal(temel?.progressPct, 52.5, 'grup içi normalize: %52,5');
      assert.equal(temel?.groupWeight, 40, 'grup ağırlığı ayrı alanda taşınır');
      // Lokasyon toplamı grup ağırlığını uygular
      assert.equal(board.locations[0]!.progressPct, 21);
    });

    it('sapmayı planlanan ile karşılaştırarak verir', async () => {
      const templateId = await makeTemplate();
      const trackingId = await makeActiveTracking(templateId, [aBlokId]);
      // 2026-01-01 → 2026-12-31 arasında 2026-07-02 ≈ %50 (182/364)
      const board = await new GetTrackingBoardUseCase(trackings, templates, clock).execute({
        trackingId,
        companyId: 1,
        asOf: '2026-07-02',
      });
      assert.ok(board.plannedPct !== null);
      assert.equal(board.progressPct, 0);
      assert.ok(
        board.deviationPct !== null && board.deviationPct < 0,
        'hiç iş yapılmamışsa sapma negatif olmalı',
      );
    });

    it('şablonun durum→yüzde eşlemesini board a taşır', async () => {
      const dto = await new CreateProgressTemplateUseCase(templates).execute({
        companyId: 1,
        name: 'Özel eşleme',
        scope: 'block',
        pctInProgress: 30,
        pctHasDefects: 90,
        body: DEMO_BODY,
      });
      const trackingId = await makeActiveTracking(dto.id, [aBlokId]);
      const board = await new GetTrackingBoardUseCase(trackings, templates, clock).execute({
        trackingId,
        companyId: 1,
      });
      assert.equal(board.pctInProgress, 30);
      assert.equal(board.pctHasDefects, 90);
    });

    it('özel eşleme rollup a yansır', async () => {
      const dto = await new CreateProgressTemplateUseCase(templates).execute({
        companyId: 1,
        name: 'Özel eşleme',
        scope: 'block',
        pctInProgress: 30,
        body: DEMO_BODY,
      });
      const trackingId = await makeActiveTracking(dto.id, [aBlokId]);
      await new SetTrackingItemStateUseCase(trackings).execute({
        trackingId,
        companyId: 1,
        updates: [
          {
            trackingItemId: await itemIdByName(trackingId, 'Temel Grobetonu ve Radye'),
            state: 'in_progress',
          },
        ],
      });
      const locProgress = await trackings.locationProgress(trackingId, 1);
      // 30 × 72 × 40 / (100×40 + 100×40 + 100×20) = 86400/10000 = 8,64
      assert.equal(locProgress[0]!.progressPct, 8.64);
    });

    it('buildTrackingBoard boş satır listesiyle çökmez', () => {
      const board = buildTrackingBoard(
        {
          id: 1,
          companyId: 1,
          projectId: 1,
          templateId: 1,
          code: 'GDT-001',
          name: 'T',
          projectWeightPct: 0,
          plannedStart: null,
          plannedEnd: null,
          status: 'draft',
          assignedUserId: null,
          visibleAll: true,
          note: null,
          createdAt: '',
          updatedAt: '',
        },
        'Şablon',
        50,
        75,
        0,
        null,
        [],
        [],
      );
      assert.deepEqual(board.locations, []);
      assert.equal(board.deviationPct, null);
    });
  });

  describe('kapsam ve şablon senkronizasyonu', () => {
    it('kapsama lokasyon eklenince satırları materyalize edilir', async () => {
      const templateId = await makeTemplate();
      const trackingId = await makeActiveTracking(templateId, [aBlokId]);
      assert.equal((await trackings.listItems(trackingId, 1)).length, 12);

      const locs = await new AddTrackingLocationsUseCase(trackings, templates, locations).execute({
        trackingId,
        companyId: 1,
        locationIds: [bBlokId],
      });
      assert.equal(locs.length, 2);
      assert.equal((await trackings.listItems(trackingId, 1)).length, 24);
    });

    it('zaten kapsamda olan lokasyonu ikinci kez eklemez', async () => {
      const templateId = await makeTemplate();
      const trackingId = await makeActiveTracking(templateId, [aBlokId]);
      const locs = await new AddTrackingLocationsUseCase(trackings, templates, locations).execute({
        trackingId,
        companyId: 1,
        locationIds: [aBlokId],
      });
      assert.equal(locs.length, 1);
      assert.equal((await trackings.listItems(trackingId, 1)).length, 12);
    });

    it('kapsamdan lokasyon çıkarınca satırları da gider', async () => {
      const templateId = await makeTemplate();
      const trackingId = await makeActiveTracking(templateId, [aBlokId, bBlokId]);
      const before = await trackings.listLocations(trackingId, 1);

      const after = await new RemoveTrackingLocationUseCase(trackings).execute({
        trackingId,
        companyId: 1,
        trackingLocationId: before[1]!.id,
      });
      assert.equal(after.length, 1);
      assert.equal((await trackings.listItems(trackingId, 1)).length, 12);
    });

    it('şablona iş eklenince sync mevcut tikleri korur, eksikleri ekler', async () => {
      const templateId = await makeTemplate();
      const trackingId = await makeActiveTracking(templateId, [aBlokId]);
      const dolguId = await itemIdByName(trackingId, 'Dolgu İşleri');
      await new SetTrackingItemStateUseCase(trackings).execute({
        trackingId,
        companyId: 1,
        updates: [{ trackingItemId: dolguId, state: 'completed' }],
      });

      // Şablona 13. iş eklendi; replaceBody yeni id'ler üretir, bu yüzden fake
      // üzerinde doğrudan sync davranışını sınıyoruz: eksik kombinasyon eklenir.
      await new SaveTemplateBodyUseCase(templates).execute({
        templateId,
        companyId: 1,
        body: {
          groups: [
            ...DEMO_BODY.groups,
            {
              code: 'INC',
              name: 'İnce İşler',
              weightPct: 0,
              sortOrder: 3,
              items: [{ code: 'I1', name: 'Sıva', weightPct: 100, sortOrder: 0, pozId: null }],
            },
          ],
        },
      });

      const res = await new SyncTrackingWithTemplateUseCase(trackings).execute({
        trackingId,
        companyId: 1,
      });
      assert.equal(res.addedItems, 13, 'yeni id kümesindeki 13 iş eklenir');
    });
  });

  describe('durum geçmişi', () => {
    it('her değişiklik için eski/yeni durum ve yüzdeyi kaydeder', async () => {
      const templateId = await makeTemplate();
      const trackingId = await makeActiveTracking(templateId, [aBlokId]);
      const itemId = await itemIdByName(trackingId, 'Temel Kazısı');
      const set = new SetTrackingItemStateUseCase(trackings);

      await set.execute({
        trackingId,
        companyId: 1,
        changedBy: 7,
        updates: [{ trackingItemId: itemId, state: 'in_progress' }],
      });
      await set.execute({
        trackingId,
        companyId: 1,
        changedBy: 7,
        updates: [{ trackingItemId: itemId, state: 'completed', note: 'kabul edildi' }],
      });

      const history = await new GetTrackingItemHistoryUseCase(trackings).execute({
        trackingItemId: itemId,
        companyId: 1,
      });
      assert.equal(history.length, 2);
      const latest = history[0]!;
      assert.equal(latest.fromState, 'in_progress');
      assert.equal(latest.toState, 'completed');
      assert.equal(latest.fromPct, 50);
      assert.equal(latest.toPct, 100);
      assert.equal(latest.changedBy, 7);
      assert.equal(latest.note, 'kabul edildi');
    });

    it('olmayan iş kalemi için 404', async () => {
      await assert.rejects(
        () =>
          new GetTrackingItemHistoryUseCase(trackings).execute({
            trackingItemId: 9999,
            companyId: 1,
          }),
        TrackingItemNotFoundError,
      );
    });
  });

  describe('liste ekranı', () => {
    it('takip kodunu GDT-NNN olarak üretir, ilerleme+sapma ile listeler', async () => {
      const templateId = await makeTemplate();
      const trackingId = await makeActiveTracking(templateId, [aBlokId]);
      await new SetTrackingItemStateUseCase(trackings).execute({
        trackingId,
        companyId: 1,
        updates: [
          { trackingItemId: await itemIdByName(trackingId, 'Dolgu İşleri'), state: 'completed' },
        ],
      });

      const rows = await new ListTrackingsUseCase(trackings, clock).execute({
        companyId: 1,
        projectId,
        asOf: '2026-07-02',
      });
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.code, 'GDT-001');
      // Dolgu: 100 × 4 × 40 / 10000 = %1,6
      assert.equal(rows[0]!.progressPct, 1.6);
      assert.ok(rows[0]!.plannedPct !== null);
      assert.ok(rows[0]!.deviationPct !== null && rows[0]!.deviationPct < 0);
      assert.equal(rows[0]!.locationCount, 1);
    });

    it('iptal edilen takipler varsayılan listede görünmez', async () => {
      const templateId = await makeTemplate();
      const trackingId = await makeActiveTracking(templateId, [aBlokId]);
      await new ChangeTrackingStatusUseCase(trackings, clock).execute({
        trackingId,
        companyId: 1,
        status: 'cancelled',
      });

      const visible = await new ListTrackingsUseCase(trackings, clock).execute({
        companyId: 1,
        projectId,
      });
      assert.equal(visible.length, 0);

      const all = await new ListTrackingsUseCase(trackings, clock).execute({
        companyId: 1,
        projectId,
        includeCancelled: true,
      });
      assert.equal(all.length, 1);
    });
  });
});
