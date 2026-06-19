/**
 * StockLedger — stok ve maliyet türetme domain servisi.
 *
 * Stok SAKLANMAZ; her zaman hareketlerden türetilir (CashPositionCalculator
 * deseniyle aynı felsefe). Tüm miktarlar BASE birimdedir.
 *
 *   stok(material, warehouse) = Σ hareket.signedDeltaFor(warehouse)
 *     in       +baseQty
 *     out      −baseQty
 *     transfer from −baseQty / to +baseQty
 *     count    +baseQty (işaretli düzeltme)
 *
 * Hareketli ortalama maliyet (moving average), malzeme bazında, tüm depolar
 * birlikte (firma genel ortalaması), tarih + id sırasına göre:
 *   - giriş (in, +count): yeni avg = (eskiQty*eskiAvg + qty*birimMaliyet) / yeniQty
 *   - çıkış (out, −count): qty azalır, avg sabit kalır
 *   - transfer: depolar arası — toplam qty/maliyet değişmez (avg sabit)
 */
import type { StockMovement } from '../entities/StockMovement.js';

export interface StockLevel {
  materialId: number;
  warehouseId: number;
  /** Base birim cinsinden güncel stok (negatif olabilir). */
  baseQty: number;
}

export const StockLedger = {
  /**
   * (materialId, warehouseId) ikilisi başına base-birim stoğu hesaplar.
   * Yalnız hareketi olan ikililer döner.
   */
  computeStockLevels(movements: ReadonlyArray<StockMovement>): StockLevel[] {
    // key: `${materialId}:${warehouseId}` → baseQty
    const acc = new Map<string, StockLevel>();

    const apply = (materialId: number, warehouseId: number, delta: number): void => {
      if (delta === 0) return;
      const key = `${materialId}:${warehouseId}`;
      const existing = acc.get(key);
      if (existing) {
        existing.baseQty += delta;
      } else {
        acc.set(key, { materialId, warehouseId, baseQty: delta });
      }
    };

    for (const m of movements) {
      if (m.kind === 'transfer') {
        if (m.fromWarehouseId !== null) {
          apply(m.materialId, m.fromWarehouseId, m.signedDeltaFor(m.fromWarehouseId));
        }
        if (m.toWarehouseId !== null) {
          apply(m.materialId, m.toWarehouseId, m.signedDeltaFor(m.toWarehouseId));
        }
      } else if (m.warehouseId !== null) {
        apply(m.materialId, m.warehouseId, m.signedDeltaFor(m.warehouseId));
      }
    }

    return [...acc.values()];
  },

  /**
   * Tek bir (materialId, warehouseId) için base-birim stok.
   */
  computeStockFor(
    movements: ReadonlyArray<StockMovement>,
    materialId: number,
    warehouseId: number,
  ): number {
    let qty = 0;
    for (const m of movements) {
      if (m.materialId !== materialId) continue;
      qty += m.signedDeltaFor(warehouseId);
    }
    return qty;
  },

  /**
   * Bir malzemenin firma genelindeki hareketli ortalama birim maliyeti
   * (base birim başına). Maliyetsiz girişler (unitCostBase null) avg'yi
   * değiştirmez ama qty'yi artırır (ortalama yalnız maliyetli girişlerden
   * türetilir). Hiç maliyetli giriş yoksa 0 döner.
   */
  movingAverageCost(movements: ReadonlyArray<StockMovement>, materialId: number): number {
    const ordered = [...movements]
      .filter((m) => m.materialId === materialId)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        const ai = a.id ?? 0;
        const bi = b.id ?? 0;
        return ai - bi;
      });

    let qty = 0;
    let avg = 0;

    for (const m of ordered) {
      const inflow = m.kind === 'in' || (m.kind === 'count' && m.signedDeltaFor(firstWh(m)) >= 0);
      if (inflow && m.unitCostBase !== null) {
        const inQty = m.baseQty;
        const newQty = qty + inQty;
        if (newQty > 0) {
          avg = (qty * avg + inQty * m.unitCostBase) / newQty;
        }
        qty = newQty;
      } else if (m.kind === 'in' || (m.kind === 'count' && m.signedDeltaFor(firstWh(m)) >= 0)) {
        // Maliyetsiz giriş — qty artar, avg sabit.
        qty += m.baseQty;
      } else if (m.kind === 'out' || (m.kind === 'count' && m.signedDeltaFor(firstWh(m)) < 0)) {
        // Çıkış — avg sabit, qty azalır.
        qty -= m.baseQty;
      }
      // transfer: firma toplamı değişmez → avg & qty sabit.
    }

    return avg;
  },
} as const;

/** count hareketinin işaretini değerlendirmek için referans depo. */
function firstWh(m: StockMovement): number {
  return m.warehouseId ?? m.toWarehouseId ?? m.fromWarehouseId ?? 0;
}
