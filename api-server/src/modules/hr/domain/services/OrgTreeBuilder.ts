/**
 * OrgTreeBuilder — flat OrgUnit listesini nested ağaca dönüştürür.
 *
 * Saf TS. DB veya framework bilgisi yok. Cycle algılama içerir
 * (bozuk veri durumunda 64 derinlikten sonra hata fırlatır).
 *
 * Çıktı tipi `OrgUnitTreeNode` — `OrgUnit` instance + `children` dizisi.
 * Root'lar (parentId === null) en üstte, her seviye `sortOrder` sonra `id`'ye
 * göre sıralanır (deterministik).
 */
import type { OrgUnit } from '../entities/OrgUnit.js';

export interface OrgUnitTreeNode {
  readonly unit: OrgUnit;
  readonly children: ReadonlyArray<OrgUnitTreeNode>;
}

export class OrgTreeBuilder {
  /**
   * Flat OrgUnit listesini ağaca dönüştürür.
   *
   * - Aynı companyId'ye sahip olmalı (mix kontrol etmez — caller'ın işi).
   * - Eksik parent (parent_id var ama listede yok) → "orphan" olarak root sayılır.
   * - Cycle algılanırsa fırlatır.
   * - Sıralama: sortOrder ASC, sonra id ASC.
   *
   * Karmaşıklık: O(n) (iki geçiş + sıralama).
   */
  static build(units: ReadonlyArray<OrgUnit>): ReadonlyArray<OrgUnitTreeNode> {
    if (units.length === 0) {
      return [];
    }

    // 1. Cycle kontrolü — her node için kendinden başlayarak yukarı yürü.
    OrgTreeBuilder.assertNoCycles(units);

    // 2. id → children listesi map'i kur (mutable buffer)
    const byId = new Map<number, OrgUnit>();
    const childrenBuf = new Map<number | null, OrgUnit[]>();

    for (const u of units) {
      byId.set(u.id, u);
    }

    for (const u of units) {
      // Eksik parent: parent_id var ama listede yok → root grubuna ekle.
      const effectiveParent = u.parentId !== null && byId.has(u.parentId) ? u.parentId : null;

      let bucket = childrenBuf.get(effectiveParent);
      if (!bucket) {
        bucket = [];
        childrenBuf.set(effectiveParent, bucket);
      }
      bucket.push(u);
    }

    // 3. Her bucket'ı sırala (sortOrder ASC, id ASC tie-break)
    for (const bucket of childrenBuf.values()) {
      bucket.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.id - b.id;
      });
    }

    // 4. Recursive ağaç inşası
    const buildNode = (unit: OrgUnit): OrgUnitTreeNode => {
      const kids = childrenBuf.get(unit.id) ?? [];
      return {
        unit,
        children: kids.map(buildNode),
      };
    };

    const roots = childrenBuf.get(null) ?? [];
    return roots.map(buildNode);
  }

  /**
   * Tüm node'lar üzerinden cycle kontrolü.
   * Her node için parent zincirini yukarı takip eder, kendine geri dönüyor mu bakar.
   * 64 derinlik üzeri hata (bozuk veri için sonsuz döngü koruması).
   */
  private static assertNoCycles(units: ReadonlyArray<OrgUnit>): void {
    const byId = new Map<number, OrgUnit>();
    for (const u of units) {
      byId.set(u.id, u);
    }

    for (const start of units) {
      let current = start.parentId;
      let hops = 0;
      while (current !== null) {
        if (current === start.id) {
          throw new OrgTreeCycleError(start.id);
        }
        hops += 1;
        if (hops > 64) {
          throw new OrgTreeCycleError(start.id);
        }
        const parent = byId.get(current);
        if (!parent) {
          // Orphan — döngü olamaz, kır
          break;
        }
        current = parent.parentId;
      }
    }
  }

  /**
   * Ağaç içinde belirli bir OrgUnit'in atalarını (üst zincirini) düz liste olarak döner.
   * Root → ... → unit'in parent'ı sırasında. Cycle veya orphan'da güvenli (hop sınırlı).
   */
  static ancestorsOf(unitId: number, units: ReadonlyArray<OrgUnit>): ReadonlyArray<OrgUnit> {
    const byId = new Map<number, OrgUnit>();
    for (const u of units) {
      byId.set(u.id, u);
    }

    const target = byId.get(unitId);
    if (!target) return [];

    const stack: OrgUnit[] = [];
    let current = target.parentId;
    let hops = 0;
    while (current !== null && hops <= 64) {
      const parent = byId.get(current);
      if (!parent) break;
      stack.push(parent);
      current = parent.parentId;
      hops += 1;
    }
    return stack.reverse();
  }

  /**
   * Bir OrgUnit'in (kendisi dahil) tüm soyunu — descendants — flat liste olarak döner.
   * "Kendisi dahil mi" `includeSelf` parametresiyle.
   */
  static descendantsOf(
    unitId: number,
    units: ReadonlyArray<OrgUnit>,
    options: { includeSelf?: boolean } = {},
  ): ReadonlyArray<OrgUnit> {
    const includeSelf = options.includeSelf ?? false;
    const result: OrgUnit[] = [];
    const childrenByParent = new Map<number | null, OrgUnit[]>();

    for (const u of units) {
      let bucket = childrenByParent.get(u.parentId);
      if (!bucket) {
        bucket = [];
        childrenByParent.set(u.parentId, bucket);
      }
      bucket.push(u);
    }

    const queue: number[] = [unitId];
    const visited = new Set<number>();

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      const children = childrenByParent.get(id) ?? [];
      for (const c of children) {
        result.push(c);
        queue.push(c.id);
      }
    }

    if (includeSelf) {
      const self = units.find((u) => u.id === unitId);
      if (self) {
        return [self, ...result];
      }
    }

    return result;
  }
}

export class OrgTreeCycleError extends Error {
  constructor(public readonly involvedUnitId: number) {
    super(`OrgTree cycle algilandi (involvedUnitId=${involvedUnitId})`);
    this.name = 'OrgTreeCycleError';
  }
}
