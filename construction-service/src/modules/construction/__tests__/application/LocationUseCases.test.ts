/**
 * FAZ 1 — Mekân kırılımı testleri (node:test runner).
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { buildLocationTree } from '../../application/dto/LocationDtos.js';
import {
  BulkGenerateLocationsUseCase,
  CreateLocationUseCase,
  DeleteLocationUseCase,
  GetLocationTreeUseCase,
  GetLocationUsageUseCase,
  ListLocationsUseCase,
  MoveLocationUseCase,
  UpdateLocationUseCase,
} from '../../application/useCases/LocationUseCases.js';
import {
  DuplicateLocationCodeError,
  InvalidLocationNestingError,
  LocationInUseError,
  LocationNotFoundError,
  ProjectNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import { allowedChildrenOf, canBeRoot, canNest } from '../../domain/valueObjects/LocationKind.js';
import { FixedClock, InMemoryProjectRepository } from '../fakes.js';
import { InMemoryLocationRepository } from '../locationTrackingFakes.js';

describe('LocationKind — ağaç kuralları', () => {
  it('yalnız saha/blok/bölge kök olabilir', () => {
    assert.equal(canBeRoot('site'), true);
    assert.equal(canBeRoot('block'), true);
    assert.equal(canBeRoot('zone'), true);
    assert.equal(canBeRoot('floor'), false);
    assert.equal(canBeRoot('unit'), false);
  });

  it('şantiye hiyerarşisine uymayan iç içe geçmeyi reddeder', () => {
    assert.equal(canNest('site', 'block'), true);
    assert.equal(canNest('block', 'floor'), true);
    assert.equal(canNest('floor', 'unit'), true);
    // Anlamsız olanlar
    assert.equal(canNest('unit', 'block'), false);
    assert.equal(canNest('floor', 'block'), false);
    assert.equal(canNest('site', 'unit'), false);
    assert.equal(canNest('block', 'unit'), false);
  });

  it('bağımsız bölüm yapraktır', () => {
    assert.deepEqual(allowedChildrenOf('unit'), []);
  });
});

describe('LocationUseCases', () => {
  let locations: InMemoryLocationRepository;
  let projects: InMemoryProjectRepository;
  let clock: FixedClock;
  let projectId: number;

  beforeEach(async () => {
    locations = new InMemoryLocationRepository();
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
      plannedEnd: '2027-01-01',
      budgetAmount: 0,
      currency: 'TRY',
      createdBy: null,
    });
    projectId = p.id;
  });

  const create = (): CreateLocationUseCase => new CreateLocationUseCase(locations, projects);

  it('kök saha oluşturur, path adla eşitlenir', async () => {
    const dto = await create().execute({
      companyId: 1,
      projectId,
      kind: 'site',
      code: 'SAHA',
      name: 'Merkez Saha',
    });
    assert.equal(dto.path, 'Merkez Saha');
    assert.equal(dto.depth, 0);
    assert.deepEqual(dto.allowedChildKinds, ['block', 'zone']);
  });

  it('ad verilmezse kodu ad olarak kullanır', async () => {
    const site = await create().execute({ companyId: 1, projectId, kind: 'site', code: 'SAHA' });
    assert.equal(site.name, 'SAHA');
  });

  it('kat kök olarak eklenemez', async () => {
    await assert.rejects(
      () => create().execute({ companyId: 1, projectId, kind: 'floor', code: '2' }),
      InvalidLocationNestingError,
    );
  });

  it('bağımsız bölümü bloğun altına doğrudan eklemeyi reddeder', async () => {
    const site = await create().execute({ companyId: 1, projectId, kind: 'site', code: 'SAHA' });
    const block = await create().execute({
      companyId: 1,
      projectId,
      parentId: site.id,
      kind: 'block',
      code: 'A',
      name: 'A Blok',
    });
    await assert.rejects(
      () =>
        create().execute({
          companyId: 1,
          projectId,
          parentId: block.id,
          kind: 'unit',
          code: '18',
        }),
      InvalidLocationNestingError,
    );
  });

  it('3 seviyeli path kurar', async () => {
    const site = await create().execute({
      companyId: 1,
      projectId,
      kind: 'site',
      code: 'S',
      name: 'Saha',
    });
    const block = await create().execute({
      companyId: 1,
      projectId,
      parentId: site.id,
      kind: 'block',
      code: 'A',
      name: 'A Blok',
    });
    const floor = await create().execute({
      companyId: 1,
      projectId,
      parentId: block.id,
      kind: 'floor',
      code: '2',
    });
    const unit = await create().execute({
      companyId: 1,
      projectId,
      parentId: floor.id,
      kind: 'unit',
      code: '18',
      unitType: '2+1',
      netArea: 96.5,
    });
    assert.equal(unit.path, 'Saha > A Blok > 2 > 18');
    assert.equal(unit.depth, 3);
    assert.equal(unit.unitType, '2+1');
    assert.equal(unit.netArea, 96.5);
  });

  it('aynı ebeveyn altında aynı kodu reddeder, farklı ebeveyn altında kabul eder', async () => {
    const site = await create().execute({ companyId: 1, projectId, kind: 'site', code: 'S' });
    const a = await create().execute({
      companyId: 1,
      projectId,
      parentId: site.id,
      kind: 'block',
      code: 'A',
    });
    const b = await create().execute({
      companyId: 1,
      projectId,
      parentId: site.id,
      kind: 'block',
      code: 'B',
    });
    await create().execute({ companyId: 1, projectId, parentId: a.id, kind: 'floor', code: '1' });
    // B bloğunun da 1. katı olabilir
    await create().execute({ companyId: 1, projectId, parentId: b.id, kind: 'floor', code: '1' });
    // Ama A bloğunun ikinci bir "1. kat"ı olamaz
    await assert.rejects(
      () => create().execute({ companyId: 1, projectId, parentId: a.id, kind: 'floor', code: '1' }),
      DuplicateLocationCodeError,
    );
  });

  it('kök seviyede kod çakışmasını yakalar (parent_id NULL karşılaştırması)', async () => {
    await create().execute({ companyId: 1, projectId, kind: 'site', code: 'S' });
    await assert.rejects(
      () => create().execute({ companyId: 1, projectId, kind: 'site', code: 'S' }),
      DuplicateLocationCodeError,
    );
  });

  it('olmayan projeye lokasyon eklemez', async () => {
    await assert.rejects(
      () => create().execute({ companyId: 1, projectId: 999, kind: 'site', code: 'S' }),
      ProjectNotFoundError,
    );
  });

  it('ebeveyn adı değişince alt ağacın path i tazelenir', async () => {
    const site = await create().execute({
      companyId: 1,
      projectId,
      kind: 'site',
      code: 'S',
      name: 'Saha',
    });
    const block = await create().execute({
      companyId: 1,
      projectId,
      parentId: site.id,
      kind: 'block',
      code: 'A',
      name: 'A Blok',
    });
    const floor = await create().execute({
      companyId: 1,
      projectId,
      parentId: block.id,
      kind: 'floor',
      code: '2',
    });

    await new UpdateLocationUseCase(locations, clock).execute({
      locationId: block.id,
      companyId: 1,
      name: 'A-Blok (revize)',
    });

    const fresh = await locations.findById(floor.id, 1);
    assert.equal(fresh?.path, 'Saha > A-Blok (revize) > 2');
  });

  it('lokasyonu başka ebeveynin altına taşır', async () => {
    const site = await create().execute({
      companyId: 1,
      projectId,
      kind: 'site',
      code: 'S',
      name: 'Saha',
    });
    const a = await create().execute({
      companyId: 1,
      projectId,
      parentId: site.id,
      kind: 'block',
      code: 'A',
      name: 'A Blok',
    });
    const b = await create().execute({
      companyId: 1,
      projectId,
      parentId: site.id,
      kind: 'block',
      code: 'B',
      name: 'B Blok',
    });
    const floor = await create().execute({
      companyId: 1,
      projectId,
      parentId: a.id,
      kind: 'floor',
      code: '3',
    });

    const moved = await new MoveLocationUseCase(locations).execute({
      locationId: floor.id,
      companyId: 1,
      newParentId: b.id,
    });
    assert.equal(moved.path, 'Saha > B Blok > 3');
  });

  it('taşımada iç içe geçme kuralını uygular', async () => {
    const site = await create().execute({ companyId: 1, projectId, kind: 'site', code: 'S' });
    const block = await create().execute({
      companyId: 1,
      projectId,
      parentId: site.id,
      kind: 'block',
      code: 'A',
    });
    // Bloğu bir katın altına taşımak anlamsız — ama önce bir kat lazım
    const floor = await create().execute({
      companyId: 1,
      projectId,
      parentId: block.id,
      kind: 'floor',
      code: '1',
    });
    await assert.rejects(
      () =>
        new MoveLocationUseCase(locations).execute({
          locationId: block.id,
          companyId: 1,
          newParentId: floor.id,
        }),
      InvalidLocationNestingError,
    );
  });

  it('bağlı kayıt varken sert silmeyi reddeder, sebebini sayar', async () => {
    const site = await create().execute({ companyId: 1, projectId, kind: 'site', code: 'S' });
    locations.usageOverrides.set(site.id, { expenses: 3, timesheets: 12 });

    await assert.rejects(
      () =>
        new DeleteLocationUseCase(locations, clock).execute({
          locationId: site.id,
          companyId: 1,
        }),
      (err: unknown) => {
        assert.ok(err instanceof LocationInUseError);
        assert.match(err.message, /3 gider/);
        assert.match(err.message, /12 puantaj/);
        return true;
      },
    );
  });

  it('bağlı kayıt varken pasife çekme her zaman mümkün', async () => {
    const site = await create().execute({ companyId: 1, projectId, kind: 'site', code: 'S' });
    locations.usageOverrides.set(site.id, { expenses: 3 });

    const res = await new DeleteLocationUseCase(locations, clock).execute({
      locationId: site.id,
      companyId: 1,
      deactivateOnly: true,
    });
    assert.equal(res.deleted, false);
    assert.equal(res.location.active, false);
  });

  it('bağlı kayıt yoksa sert siler', async () => {
    const site = await create().execute({ companyId: 1, projectId, kind: 'site', code: 'S' });
    const res = await new DeleteLocationUseCase(locations, clock).execute({
      locationId: site.id,
      companyId: 1,
    });
    assert.equal(res.deleted, true);
    assert.equal(await locations.findById(site.id, 1), null);
  });

  it('çocuğu olan lokasyon sert silinemez', async () => {
    const site = await create().execute({ companyId: 1, projectId, kind: 'site', code: 'S' });
    await create().execute({
      companyId: 1,
      projectId,
      parentId: site.id,
      kind: 'block',
      code: 'A',
    });
    await assert.rejects(
      () =>
        new DeleteLocationUseCase(locations, clock).execute({
          locationId: site.id,
          companyId: 1,
        }),
      LocationInUseError,
    );
  });

  it('usage sorgusu silinebilirliği ve engelleri bildirir', async () => {
    const site = await create().execute({ companyId: 1, projectId, kind: 'site', code: 'S' });
    const clean = await new GetLocationUsageUseCase(locations).execute({
      locationId: site.id,
      companyId: 1,
    });
    assert.equal(clean.canHardDelete, true);
    assert.deepEqual(clean.blockers, []);

    locations.usageOverrides.set(site.id, { trackingLocations: 1 });
    const dirty = await new GetLocationUsageUseCase(locations).execute({
      locationId: site.id,
      companyId: 1,
    });
    assert.equal(dirty.canHardDelete, false);
    assert.deepEqual(dirty.blockers, ['1 ilerleme takibi']);
  });

  it('olmayan lokasyon için 404 domain hatası', async () => {
    await assert.rejects(
      () => new GetLocationUsageUseCase(locations).execute({ locationId: 42, companyId: 1 }),
      LocationNotFoundError,
    );
  });

  describe('bulk-generate (toplu mekân üretimi)', () => {
    it('2 blok × 3 kat × 4 daire = 2 + 6 + 24 düğüm üretir', async () => {
      const res = await new BulkGenerateLocationsUseCase(locations, projects).execute({
        companyId: 1,
        projectId,
        blocks: ['A', 'B'],
        floors: ['0', '1', '2'],
        unitsPerFloor: 4,
        defaultUnitType: '2+1',
      });
      assert.equal(res.createdCount, 2 + 6 + 24);

      const units = await new ListLocationsUseCase(locations).execute({
        companyId: 1,
        projectId,
        kind: 'unit',
      });
      assert.equal(units.length, 24);
      assert.ok(units.every((u) => u.unitType === '2+1'));
    });

    it('per_floor numaralandırmada her katta 1 den başlar', async () => {
      await new BulkGenerateLocationsUseCase(locations, projects).execute({
        companyId: 1,
        projectId,
        blocks: ['A'],
        floors: ['0', '1'],
        unitsPerFloor: 2,
        unitNumbering: 'per_floor',
      });
      const units = await new ListLocationsUseCase(locations).execute({
        companyId: 1,
        projectId,
        kind: 'unit',
      });
      assert.deepEqual(units.map((u) => u.code).sort(), ['1', '1', '2', '2']);
    });

    it('sequential numaralandırmada blok içinde artar', async () => {
      await new BulkGenerateLocationsUseCase(locations, projects).execute({
        companyId: 1,
        projectId,
        blocks: ['A'],
        floors: ['0', '1'],
        unitsPerFloor: 2,
        unitNumbering: 'sequential',
      });
      const units = await new ListLocationsUseCase(locations).execute({
        companyId: 1,
        projectId,
        kind: 'unit',
      });
      assert.deepEqual(
        units.map((u) => u.code).sort((a, b) => Number(a) - Number(b)),
        ['1', '2', '3', '4'],
      );
    });

    it('tekrar koşturulunca kopya üretmez, yeni bloğu ekler', async () => {
      const args = {
        companyId: 1,
        projectId,
        blocks: ['A'],
        floors: ['0'],
        unitsPerFloor: 2,
      } as const;
      const first = await new BulkGenerateLocationsUseCase(locations, projects).execute(args);
      assert.equal(first.createdCount, 1 + 1 + 2);

      const again = await new BulkGenerateLocationsUseCase(locations, projects).execute(args);
      assert.equal(again.createdCount, 0, 'aynı girdiyle ikinci koşum hiçbir şey üretmemeli');

      const withB = await new BulkGenerateLocationsUseCase(locations, projects).execute({
        ...args,
        blocks: ['A', 'B'],
      });
      assert.equal(withB.createdCount, 1 + 1 + 2, 'yalnız B bloğunun ağacı eklenmeli');
    });

    it('isim şablonu uygular', async () => {
      await new BulkGenerateLocationsUseCase(locations, projects).execute({
        companyId: 1,
        projectId,
        blocks: ['A'],
        floors: ['3'],
        unitsPerFloor: 1,
        blockNameTemplate: '{code} Blok',
        floorNameTemplate: '{code}. Kat',
        unitNameTemplate: 'Daire {code}',
      });
      const all = await new ListLocationsUseCase(locations).execute({ companyId: 1, projectId });
      const unit = all.find((l) => l.kind === 'unit');
      assert.equal(unit?.path, 'A Blok > 3. Kat > Daire 1');
    });
  });

  describe('ağaç kurucu (buildLocationTree)', () => {
    it('alt-toplamları yukarı taşır', async () => {
      const site = await create().execute({
        companyId: 1,
        projectId,
        kind: 'site',
        code: 'S',
        name: 'Saha',
      });
      const block = await create().execute({
        companyId: 1,
        projectId,
        parentId: site.id,
        kind: 'block',
        code: 'A',
        name: 'A Blok',
      });
      const floor = await create().execute({
        companyId: 1,
        projectId,
        parentId: block.id,
        kind: 'floor',
        code: '1',
      });
      await create().execute({
        companyId: 1,
        projectId,
        parentId: floor.id,
        kind: 'unit',
        code: '1',
        netArea: 100,
      });
      await create().execute({
        companyId: 1,
        projectId,
        parentId: floor.id,
        kind: 'unit',
        code: '2',
        netArea: 80,
      });

      const tree = await new GetLocationTreeUseCase(locations).execute({
        companyId: 1,
        projectId,
      });
      assert.equal(tree.length, 1);
      assert.equal(tree[0]!.unitCount, 2);
      assert.equal(tree[0]!.netAreaTotal, 180);
      assert.equal(tree[0]!.children[0]!.children[0]!.unitCount, 2);
    });

    it('hiç alan girilmemişse netAreaTotal null kalır (0 değil)', async () => {
      const site = await create().execute({ companyId: 1, projectId, kind: 'site', code: 'S' });
      await create().execute({
        companyId: 1,
        projectId,
        parentId: site.id,
        kind: 'block',
        code: 'A',
      });
      const tree = await new GetLocationTreeUseCase(locations).execute({
        companyId: 1,
        projectId,
      });
      assert.equal(tree[0]!.netAreaTotal, null);
    });

    it('ebeveyni listede olmayan düğümü kök olarak gösterir (sessizce düşürmez)', async () => {
      const site = await create().execute({
        companyId: 1,
        projectId,
        kind: 'site',
        code: 'S',
        name: 'Saha',
      });
      const block = await create().execute({
        companyId: 1,
        projectId,
        parentId: site.id,
        kind: 'block',
        code: 'A',
        name: 'A Blok',
      });
      // Yalnız blok filtresiyle çekilirse saha listede olmaz
      const onlyBlocks = await locations.listByProject(projectId, 1, { kind: 'block' });
      const tree = buildLocationTree(onlyBlocks);
      assert.equal(tree.length, 1);
      assert.equal(tree[0]!.id, block.id);
      assert.equal(tree[0]!.parentId, site.id, 'parentId korunur, düğüm kaybolmaz');
    });
  });
});
