import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { OrgUnit } from '../../domain/entities/OrgUnit.js';
import { OrgTreeBuilder, OrgTreeCycleError } from '../../domain/services/OrgTreeBuilder.js';

/** Yardımcı: test için kısa OrgUnit kurucusu. */
function ou(
  id: number,
  parentId: number | null,
  opts: { name?: string; sortOrder?: number; companyId?: number } = {},
): OrgUnit {
  return OrgUnit.create({
    id,
    companyId: opts.companyId ?? 1,
    parentId,
    name: opts.name ?? `U${id}`,
    code: null,
    sortOrder: opts.sortOrder ?? 0,
    active: true,
    createdAt: new Date('2026-05-21T09:00:00Z'),
    updatedAt: new Date('2026-05-21T09:00:00Z'),
  });
}

describe('OrgTreeBuilder.build()', () => {
  it('boş liste → boş ağaç', () => {
    assert.deepEqual(OrgTreeBuilder.build([]), []);
  });

  it('tek root → tek node', () => {
    const tree = OrgTreeBuilder.build([ou(1, null)]);
    assert.equal(tree.length, 1);
    assert.equal(tree[0]!.unit.id, 1);
    assert.equal(tree[0]!.children.length, 0);
  });

  it('iki seviye: root + 2 çocuk', () => {
    const units = [ou(1, null), ou(2, 1), ou(3, 1)];
    const tree = OrgTreeBuilder.build(units);
    assert.equal(tree.length, 1);
    assert.equal(tree[0]!.unit.id, 1);
    assert.equal(tree[0]!.children.length, 2);
    const childIds = tree[0]!.children.map((c) => c.unit.id);
    assert.deepEqual([...childIds].sort(), [2, 3]);
  });

  it('üç seviye dengeli', () => {
    const units = [
      ou(1, null), // root
      ou(2, 1), // child of root
      ou(3, 2), // grandchild
      ou(4, 2), // grandchild
    ];
    const tree = OrgTreeBuilder.build(units);
    assert.equal(tree.length, 1);
    assert.equal(tree[0]!.children.length, 1);
    assert.equal(tree[0]!.children[0]!.unit.id, 2);
    assert.equal(tree[0]!.children[0]!.children.length, 2);
  });

  it('çoklu root', () => {
    const units = [ou(1, null), ou(2, null), ou(3, 1)];
    const tree = OrgTreeBuilder.build(units);
    assert.equal(tree.length, 2);
    const rootIds = tree.map((n) => n.unit.id);
    assert.deepEqual([...rootIds].sort(), [1, 2]);
  });

  it('sortOrder ASC sıralama', () => {
    const units = [
      ou(1, null, { sortOrder: 2 }),
      ou(2, null, { sortOrder: 0 }),
      ou(3, null, { sortOrder: 1 }),
    ];
    const tree = OrgTreeBuilder.build(units);
    assert.deepEqual(
      tree.map((n) => n.unit.id),
      [2, 3, 1],
    );
  });

  it('eşit sortOrder → id ASC tie-break', () => {
    const units = [
      ou(3, null, { sortOrder: 0 }),
      ou(1, null, { sortOrder: 0 }),
      ou(2, null, { sortOrder: 0 }),
    ];
    const tree = OrgTreeBuilder.build(units);
    assert.deepEqual(
      tree.map((n) => n.unit.id),
      [1, 2, 3],
    );
  });

  it('orphan (eksik parent) root grubuna düşer', () => {
    // 99 mevcut değil → 5 orphan, root olarak görünür
    const units = [ou(1, null), ou(5, 99)];
    const tree = OrgTreeBuilder.build(units);
    assert.equal(tree.length, 2);
    const ids = tree.map((n) => n.unit.id);
    assert.deepEqual([...ids].sort(), [1, 5]);
  });

  it('cycle: A → A (self-parent imkânsız çünkü entity validate eder, ama dolaylı cycle test edilir)', () => {
    // OrgUnit.create kendi-kendine parent'ı reddeder; bu yüzden cycle senaryosunu
    // iki node üzerinden kurarız: 1.parent=2, 2.parent=1
    // ÖNEMLİ: OrgUnit immutable, ama entity sadece self-id'yi reddediyor —
    // 1 ve 2 birbirini parent gösterebilir. OrgTreeBuilder bunu yakalamalı.
    const units = [ou(1, 2), ou(2, 1)];
    assert.throws(
      () => OrgTreeBuilder.build(units),
      (e: unknown) => e instanceof OrgTreeCycleError,
    );
  });

  it('uzun zincir cycle: 1→2→3→1', () => {
    const units = [ou(1, 3), ou(2, 1), ou(3, 2)];
    assert.throws(
      () => OrgTreeBuilder.build(units),
      (e: unknown) => e instanceof OrgTreeCycleError,
    );
  });

  it("OrgTreeCycleError involvedUnitId'yi taşır", () => {
    const units = [ou(7, 8), ou(8, 7)];
    try {
      OrgTreeBuilder.build(units);
      assert.fail('Cycle fırlatmalıydı');
    } catch (e) {
      assert.ok(e instanceof OrgTreeCycleError);
      // Hangi node'dan başladığı implementation'a bağlı ama 7 veya 8 olmalı
      assert.ok([7, 8].includes(e.involvedUnitId));
    }
  });

  it('dengesiz ağaç (büyük dal + küçük dal)', () => {
    const units = [
      ou(1, null),
      ou(2, 1),
      ou(3, 2),
      ou(4, 3),
      ou(5, 4),
      ou(6, 1), // küçük dal
    ];
    const tree = OrgTreeBuilder.build(units);
    assert.equal(tree.length, 1);
    assert.equal(tree[0]!.children.length, 2);
  });
});

describe('OrgTreeBuilder.ancestorsOf()', () => {
  it('root için boş döner', () => {
    const units = [ou(1, null)];
    assert.deepEqual(OrgTreeBuilder.ancestorsOf(1, units), []);
  });

  it('mevcut olmayan unit için boş döner', () => {
    const units = [ou(1, null)];
    assert.deepEqual(OrgTreeBuilder.ancestorsOf(99, units), []);
  });

  it('atalar root → ... → parent sırasında döner', () => {
    const units = [ou(1, null), ou(2, 1), ou(3, 2), ou(4, 3)];
    const ancestors = OrgTreeBuilder.ancestorsOf(4, units);
    assert.deepEqual(
      ancestors.map((u) => u.id),
      [1, 2, 3],
    );
  });

  it('orphan için boş döner', () => {
    const units = [ou(5, 99)]; // 99 yok
    assert.deepEqual(OrgTreeBuilder.ancestorsOf(5, units), []);
  });
});

describe('OrgTreeBuilder.descendantsOf()', () => {
  it('yaprak için boş', () => {
    const units = [ou(1, null), ou(2, 1)];
    assert.deepEqual(OrgTreeBuilder.descendantsOf(2, units), []);
  });

  it('root için tüm alt ağacı verir (kendi hariç)', () => {
    const units = [ou(1, null), ou(2, 1), ou(3, 2), ou(4, 1)];
    const desc = OrgTreeBuilder.descendantsOf(1, units);
    assert.deepEqual(
      desc.map((u) => u.id).sort((a, b) => a - b),
      [2, 3, 4],
    );
  });

  it('includeSelf: true ise kendisi dahil', () => {
    const units = [ou(1, null), ou(2, 1)];
    const desc = OrgTreeBuilder.descendantsOf(1, units, { includeSelf: true });
    assert.deepEqual(
      desc.map((u) => u.id).sort((a, b) => a - b),
      [1, 2],
    );
  });

  it('mevcut olmayan unitId için boş döner', () => {
    const units = [ou(1, null)];
    assert.deepEqual(OrgTreeBuilder.descendantsOf(99, units), []);
  });
});
