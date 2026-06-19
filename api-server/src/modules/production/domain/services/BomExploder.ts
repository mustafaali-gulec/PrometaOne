/**
 * BomExploder — Reçete patlatma (çok seviyeli ihtiyaç ağacı) servisi.
 *
 * SAF (pure) servis. Verilen kök reçete + miktar için, yarı mamul bileşenleri
 * rekürsif patlatarak düzleştirilmiş malzeme ihtiyaç listesi ve toplam operasyon
 * süreleri üretir.
 *
 * Kullanım:
 *   - ExplodeBomUseCase → frontend'e düz ihtiyaç ağacı döndürür.
 *   - CreateProductionOrderUseCase → üretim emri malzeme rezervasyonları +
 *     operasyonları üretir (yalnız kök seviyenin operasyonları emre kopyalanır;
 *     alt yarı mamuller ayrı emir konusudur).
 */
import type { Bom } from '../entities/Bom.js';
import { BomCycleError } from '../errors/ProductionErrors.js';

export interface ExplodedRequirement {
  materialRef: string;
  /** Fire dahil toplam ihtiyaç. */
  qty: number;
  unit: string | null;
  /** BOM derinliği (0 = kök mamulün doğrudan bileşeni). */
  level: number;
  /** Bu malzeme kendisi de üretiliyor mu (yarı mamul). */
  isSemi: boolean;
}

export interface ExplodedOperation {
  workCenterId: number | null;
  name: string;
  /** Toplam planlanan dakika (setupMin + runMinPerUnit × ölçek). */
  plannedMin: number;
  seq: number;
}

export interface ExplodeResult {
  requirements: ExplodedRequirement[];
  /** Yalnız kök reçetenin operasyonları (verilen qty'e ölçeklenmiş). */
  rootOperations: ExplodedOperation[];
}

const MAX_DEPTH = 64;

function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e4) / 1e4;
}

export class BomExploder {
  /**
   * @param rootBom     Kök reçete.
   * @param qty         Üretilecek mamul miktarı.
   * @param bomByRef    productMaterialRef → Bom (yarı mamul patlatması için).
   */
  explode(rootBom: Bom, qty: number, bomByRef: ReadonlyMap<string, Bom>): ExplodeResult {
    if (!(qty > 0)) {
      return { requirements: [], rootOperations: [] };
    }

    // materialRef → { qty, level, unit, isSemi } (en sığ seviye saklanır)
    const acc = new Map<string, ExplodedRequirement>();

    const add = (req: ExplodedRequirement): void => {
      const existing = acc.get(req.materialRef);
      if (existing) {
        existing.qty = round4(existing.qty + req.qty);
        existing.level = Math.min(existing.level, req.level);
        existing.isSemi = existing.isSemi || req.isSemi;
      } else {
        acc.set(req.materialRef, { ...req, qty: round4(req.qty) });
      }
    };

    const walk = (
      bom: Bom,
      requiredQty: number,
      level: number,
      visited: ReadonlySet<string>,
    ): void => {
      if (visited.has(bom.productMaterialRef) || level > MAX_DEPTH) {
        throw new BomCycleError(bom.productMaterialRef);
      }
      const nextVisited = new Set(visited);
      nextVisited.add(bom.productMaterialRef);

      const batches = bom.outputQty > 0 ? requiredQty / bom.outputQty : requiredQty;

      for (const comp of bom.components) {
        const compReq = batches * comp.qty * (1 + comp.scrapPct / 100);
        add({
          materialRef: comp.materialRef,
          qty: compReq,
          unit: comp.unit,
          level: level + 1,
          isSemi: comp.isSemi,
        });
        const subBom = comp.isSemi ? bomByRef.get(comp.materialRef) : undefined;
        if (subBom) {
          walk(subBom, compReq, level + 1, nextVisited);
        }
      }
    };

    walk(rootBom, qty, 0, new Set<string>());

    // Kök operasyonlar (verilen qty'e ölçeklenmiş)
    const batches = rootBom.outputQty > 0 ? qty / rootBom.outputQty : qty;
    const rootOperations: ExplodedOperation[] = rootBom.operations.map((op) => ({
      workCenterId: op.workCenterId,
      name: op.name,
      plannedMin: round4(op.setupMin + op.runMinPerUnit * batches),
      seq: op.seq,
    }));

    const requirements = [...acc.values()].sort(
      (a, b) => a.level - b.level || (a.materialRef < b.materialRef ? -1 : 1),
    );
    rootOperations.sort((a, b) => a.seq - b.seq);

    return { requirements, rootOperations };
  }
}
