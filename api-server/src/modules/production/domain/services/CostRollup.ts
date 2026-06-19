/**
 * CostRollup — Reçete maliyet toplama (maliyet roll-up) servisi.
 *
 * SAF (pure) servis: clock/IO yok, deterministik.
 *
 * rollupCost(bom, materialPriceMap, workCenterMap, overheadPct):
 *   - materialCost: bileşen qty × (1 + fire%/100) × birim fiyat.
 *       Yarı mamul (isSemi / reçetesi olan) bileşenler kendi reçetelerine
 *       rekürsif patlatılır (birim maliyetleri hesaplanıp çarpılır).
 *   - laborCost: her operasyonun (setupMin + runMinPerUnit × outputQty)
 *       dakikası / 60 × iş merkezinin costPerHour'u.
 *   - overheadCost: (materialCost + laborCost) × overheadPct/100.
 *   - totalCost = materialCost + laborCost + overheadCost.
 *   - unitCost  = totalCost / outputQty.
 *
 * Tüm değerler reçetenin TEK PARTİSİ (outputQty adet) için hesaplanır;
 * unitCost adet başına maliyettir.
 */
import type { Bom } from '../entities/Bom.js';
import { BomCycleError } from '../errors/ProductionErrors.js';

export interface CostRollupResult {
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  unitCost: number;
}

export interface WorkCenterCost {
  costPerHour: number;
}

const MAX_DEPTH = 64;

function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e4) / 1e4;
}

export class CostRollup {
  /**
   * @param bom              Maliyeti hesaplanacak reçete (kök).
   * @param materialPriceMap materialRef → satın alma birim fiyatı.
   * @param workCenterMap    workCenterId → { costPerHour }.
   * @param overheadPct      Genel gider yüzdesi (örn. 10 = %10).
   * @param semiBomMap       Yarı mamul patlatması için productMaterialRef → Bom.
   *                          Verilmezse yarı mamul bileşenler satın alma gibi
   *                          materialPriceMap fiyatıyla değerlenir.
   */
  rollupCost(
    bom: Bom,
    materialPriceMap: ReadonlyMap<string, number>,
    workCenterMap: ReadonlyMap<number, WorkCenterCost>,
    overheadPct: number,
    semiBomMap?: ReadonlyMap<string, Bom>,
  ): CostRollupResult {
    const ovh = Number.isFinite(overheadPct) ? overheadPct : 0;

    const { materialCost, laborCost } = this.rollupBatch(
      bom,
      materialPriceMap,
      workCenterMap,
      semiBomMap ?? new Map<string, Bom>(),
      new Set<string>(),
      0,
    );

    const overheadCost = round4(((materialCost + laborCost) * ovh) / 100);
    const totalCost = round4(materialCost + laborCost + overheadCost);
    const unitCost = round4(bom.outputQty > 0 ? totalCost / bom.outputQty : totalCost);

    return {
      materialCost: round4(materialCost),
      laborCost: round4(laborCost),
      overheadCost,
      totalCost,
      unitCost,
    };
  }

  /** Reçetenin tek partisinin (outputQty adet) malzeme + işçilik maliyeti. */
  private rollupBatch(
    bom: Bom,
    priceMap: ReadonlyMap<string, number>,
    wcMap: ReadonlyMap<number, WorkCenterCost>,
    semiBomMap: ReadonlyMap<string, Bom>,
    visited: ReadonlySet<string>,
    depth: number,
  ): { materialCost: number; laborCost: number } {
    if (visited.has(bom.productMaterialRef) || depth > MAX_DEPTH) {
      throw new BomCycleError(bom.productMaterialRef);
    }
    const nextVisited = new Set(visited);
    nextVisited.add(bom.productMaterialRef);

    let materialCost = 0;

    for (const comp of bom.components) {
      const effectiveQty = comp.qty * (1 + comp.scrapPct / 100);
      const subBom = comp.isSemi ? semiBomMap.get(comp.materialRef) : undefined;

      if (subBom) {
        // Yarı mamul → alt reçetenin birim maliyetini hesapla, çarp.
        const sub = this.rollupBatch(subBom, priceMap, wcMap, semiBomMap, nextVisited, depth + 1);
        const subOverheadNeutral = sub.materialCost + sub.laborCost;
        const subUnit =
          subBom.outputQty > 0 ? subOverheadNeutral / subBom.outputQty : subOverheadNeutral;
        materialCost += effectiveQty * subUnit;
      } else {
        const price = priceMap.get(comp.materialRef) ?? 0;
        materialCost += effectiveQty * price;
      }
    }

    let laborCost = 0;
    for (const op of bom.operations) {
      const minutes = op.setupMin + op.runMinPerUnit * bom.outputQty;
      const costPerHour =
        op.workCenterId != null ? (wcMap.get(op.workCenterId)?.costPerHour ?? 0) : 0;
      laborCost += (minutes / 60) * costPerHour;
    }

    return { materialCost, laborCost };
  }
}
