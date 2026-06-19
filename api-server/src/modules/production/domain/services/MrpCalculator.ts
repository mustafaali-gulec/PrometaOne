/**
 * MrpCalculator — Malzeme İhtiyaç Planlama (MRP) çekirdek hesap motoru.
 *
 * SAF (pure) bir hesaplayıcıdır: clock/random/IO içermez, tüm girdiler
 * parametre olarak gelir, deterministiktir (materialRef'e göre kararlı sıralama).
 * Bu sayede kapsamlı birim testi yazılabilir.
 *
 * Netsis/global MRP mantığı:
 *   Net İhtiyaç = Talep (sipariş + plan + patlatılan bileşen ihtiyaçları)
 *                 + Emniyet Stoğu
 *                 − Eldeki Stok
 *                 − Yoldaki Sipariş (in-transit)
 *
 * Çok seviyeli ürün ağacı (BOM) patlatması:
 *   - Mamulün reçetesi varsa bileşenlerine patlat:
 *       brüt += üst_miktar × bileşen_miktarı × (1 + fire% / 100)
 *   - Yarı mamul (isSemi / reçetesi olan) bileşenlere rekürsif in
 *   - Döngü koruması: ziyaret edilen ref'ler + maksimum derinlik
 *
 * Sınıflandırma (netNeed > 0 olanlar):
 *   - Üretilen (reçetesi var) → production[] (level = BOM derinliği, 0 = en üst)
 *   - Satın alınan (reçetesi yok) → purchase[] (estCost, neededByOffsetDays)
 *
 * Kapasite yükü: her üretim için operasyon dakikaları (setupMin +
 * runMinPerUnit × qty) iş merkezine toplanır; loadHours availableHours
 * (dailyHours × horizonDays) ile karşılaştırılır → utilizationPct, bottleneck.
 */

// --- Girdi tipleri ----------------------------------------------------------

export type DemandType = 'order' | 'forecast';

export interface MrpDemandItem {
  materialRef: string;
  qty: number;
  dueDate?: string | undefined;
  type: DemandType;
}

export interface MrpBomComponentInput {
  materialRef: string;
  qty: number;
  scrapPct: number;
  isSemi: boolean;
}

export interface MrpBomOperationInput {
  workCenterId: string | null;
  setupMin: number;
  runMinPerUnit: number;
}

export interface MrpBomInput {
  id: string;
  productMaterialRef: string;
  outputQty: number;
  components: MrpBomComponentInput[];
  operations: MrpBomOperationInput[];
}

export interface MrpWorkCenterInput {
  id: string;
  name: string;
  dailyHours: number;
  costPerHour: number;
}

export interface MrpMaterialInput {
  id: string;
  name: string;
  code: string;
  unit: string;
  purchasePrice?: number | undefined;
  leadTimeDays?: number | undefined;
  isManufactured: boolean;
}

export interface InventoryLevel {
  materialRef: string;
  onHand: number;
  safetyStock: number;
  inTransit: number;
}

export type InventorySnapshot = ReadonlyMap<string, InventoryLevel>;

export interface MrpParams {
  horizonDays: number;
  useSafetyStock: boolean;
  includeInTransit: boolean;
  overheadPct?: number | undefined;
}

export interface MrpInput {
  params: MrpParams;
  materials: readonly MrpMaterialInput[];
  inventory: readonly InventoryLevel[];
  boms: readonly MrpBomInput[];
  workCenters: readonly MrpWorkCenterInput[];
  demand: readonly MrpDemandItem[];
}

// --- Çıktı tipleri ----------------------------------------------------------

export interface PurchaseLine {
  materialRef: string;
  name: string;
  qty: number;
  unit: string;
  neededByOffsetDays: number;
  estCost: number;
}

export interface ProductionLine {
  materialRef: string;
  name: string;
  qty: number;
  unit: string;
  level: number;
}

export interface ShortageLine {
  materialRef: string;
  name: string;
  shortageQty: number;
}

export interface CapacityLoadLine {
  workCenterId: string;
  name: string;
  loadHours: number;
  availableHours: number;
  utilizationPct: number;
  bottleneck: boolean;
}

export interface MrpSummary {
  totalPurchaseCost: number;
  distinctPurchaseItems: number;
  distinctProductionItems: number;
  bottleneckCount: number;
}

export interface MrpResult {
  purchase: PurchaseLine[];
  production: ProductionLine[];
  shortages: ShortageLine[];
  capacityLoad: CapacityLoadLine[];
  summary: MrpSummary;
}

// --- Yardımcılar ------------------------------------------------------------

/** Patlatma rekürsiyonu için maksimum derinlik (döngü güvenlik kapağı). */
const MAX_BOM_DEPTH = 64;

/** Para/miktar yuvarlama — kayan nokta gürültüsünü 4 haneye sabitler. */
function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e4) / 1e4;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e2) / 1e2;
}

interface GrossEntry {
  qty: number;
  /** Bu malzemenin görüldüğü en sığ BOM derinliği (0 = bağımsız talep). */
  minLevel: number;
}

export class MrpCalculator {
  /**
   * MRP planını hesaplar. SAF — yan etki yok, deterministik.
   * `at` parametresi sadece neededByOffsetDays gibi göreli hesaplar için
   * referans değildir; tüm zamanlama göreli (offset) tutulur, böylece motor
   * clock'a bağımlı olmaz.
   */
  compute(input: MrpInput): MrpResult {
    const bomByProduct = new Map<string, MrpBomInput>();
    for (const bom of input.boms) {
      // Aynı mamul için birden fazla reçete gelirse ilkini kullan (deterministik:
      // çağıran tarafın sırasını korur).
      if (!bomByProduct.has(bom.productMaterialRef)) {
        bomByProduct.set(bom.productMaterialRef, bom);
      }
    }

    const materialById = new Map<string, MrpMaterialInput>();
    for (const m of input.materials) {
      materialById.set(m.id, m);
    }

    const inventoryByRef = new Map<string, InventoryLevel>();
    for (const inv of input.inventory) {
      inventoryByRef.set(inv.materialRef, inv);
    }

    // 1) Brüt ihtiyaç toplama (çok seviyeli patlatma) ------------------------
    const gross = new Map<string, GrossEntry>();
    // Üretim emri üreten her mamul için iş merkezi yükünü toplamak adına,
    // patlatma sırasında üretilen miktarları kaydederiz.
    const producedQtyByMaterial = new Map<string, number>();

    const addGross = (materialRef: string, qty: number, level: number): void => {
      const existing = gross.get(materialRef);
      if (existing) {
        existing.qty += qty;
        existing.minLevel = Math.min(existing.minLevel, level);
      } else {
        gross.set(materialRef, { qty, minLevel: level });
      }
    };

    const explode = (
      materialRef: string,
      requiredQty: number,
      level: number,
      visited: ReadonlySet<string>,
    ): void => {
      addGross(materialRef, requiredQty, level);

      const bom = bomByProduct.get(materialRef);
      if (!bom) {
        return; // satın alınan kalem — patlatma bitti
      }

      // Bu mamul üretiliyor → üretilen miktarı kaydet (kapasite için).
      producedQtyByMaterial.set(
        materialRef,
        (producedQtyByMaterial.get(materialRef) ?? 0) + requiredQty,
      );

      // Döngü koruması
      if (visited.has(materialRef) || level >= MAX_BOM_DEPTH) {
        return;
      }
      const nextVisited = new Set(visited);
      nextVisited.add(materialRef);

      // outputQty parça başına ölçekleme: reçete outputQty adet üretir.
      const batches = bom.outputQty > 0 ? requiredQty / bom.outputQty : requiredQty;

      for (const comp of bom.components) {
        const compReq = batches * comp.qty * (1 + comp.scrapPct / 100);
        explode(comp.materialRef, compReq, level + 1, nextVisited);
      }
    };

    for (const d of input.demand) {
      if (d.qty <= 0) {
        continue;
      }
      explode(d.materialRef, d.qty, 0, new Set<string>());
    }

    // 2) Netleme + sınıflandırma --------------------------------------------
    const purchase: PurchaseLine[] = [];
    const production: ProductionLine[] = [];
    const shortages: ShortageLine[] = [];
    const seenShortage = new Set<string>();

    const nameOf = (ref: string): string => materialById.get(ref)?.name ?? ref;
    const unitOf = (ref: string): string => materialById.get(ref)?.unit ?? '';

    // Deterministik sıralama için ref'leri sırala.
    const refs = [...gross.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    // clampedNet'i shortage pass'inde tekrar kullanmak için sakla.
    const netByRef = new Map<string, number>();

    for (const ref of refs) {
      const entry = gross.get(ref)!;
      const inv = inventoryByRef.get(ref);
      const onHand = inv?.onHand ?? 0;
      const safetyStock = inv?.safetyStock ?? 0;
      const inTransit = inv?.inTransit ?? 0;

      const netNeed =
        entry.qty +
        (input.params.useSafetyStock ? safetyStock : 0) -
        onHand -
        (input.params.includeInTransit ? inTransit : 0);
      const clampedNet = Math.max(0, round4(netNeed));
      netByRef.set(ref, clampedNet);

      const hasBom = bomByProduct.has(ref);
      const material = materialById.get(ref);

      if (clampedNet > 0) {
        if (hasBom) {
          production.push({
            materialRef: ref,
            name: nameOf(ref),
            qty: clampedNet,
            unit: unitOf(ref),
            level: entry.minLevel,
          });
        } else {
          const price = material?.purchasePrice ?? 0;
          const leadTime = material?.leadTimeDays ?? 0;
          purchase.push({
            materialRef: ref,
            name: nameOf(ref),
            qty: clampedNet,
            unit: unitOf(ref),
            neededByOffsetDays: leadTime,
            estCost: round2(clampedNet * price),
          });
        }
      }
    }

    // 3) Eksiklikler (shortages) ----------------------------------------------
    // Talebi olan kalemlerin yanı sıra, talebi olmasa da emniyet stoğunun
    // altına düşmüş envanter kalemleri de değerlendirilir → union(ref).
    //   a) Emniyet stoğunun altında (onHand < safetyStock)
    //   b) Net ihtiyaç > 0 ama gelen tedarik (inTransit) yok
    const shortageRefs = new Set<string>([...gross.keys(), ...inventoryByRef.keys()]);
    const sortedShortageRefs = [...shortageRefs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const ref of sortedShortageRefs) {
      const inv = inventoryByRef.get(ref);
      const onHand = inv?.onHand ?? 0;
      const safetyStock = inv?.safetyStock ?? 0;
      const inTransit = inv?.inTransit ?? 0;
      const clampedNet = netByRef.get(ref) ?? 0;

      let shortageQty = 0;
      if (safetyStock > 0 && onHand < safetyStock) {
        shortageQty = Math.max(shortageQty, round4(safetyStock - onHand));
      }
      if (clampedNet > 0 && inTransit <= 0) {
        shortageQty = Math.max(shortageQty, clampedNet);
      }
      if (shortageQty > 0 && !seenShortage.has(ref)) {
        seenShortage.add(ref);
        shortages.push({ materialRef: ref, name: nameOf(ref), shortageQty: round4(shortageQty) });
      }
    }

    // 4) Kapasite yükü -------------------------------------------------------
    const wcById = new Map<string, MrpWorkCenterInput>();
    for (const wc of input.workCenters) {
      wcById.set(wc.id, wc);
    }
    // workCenterId → yük dakikası
    const loadMinByWc = new Map<string, number>();

    for (const [productRef, producedQty] of producedQtyByMaterial) {
      const bom = bomByProduct.get(productRef);
      if (!bom) {
        continue;
      }
      const batches = bom.outputQty > 0 ? producedQty / bom.outputQty : producedQty;
      for (const op of bom.operations) {
        if (op.workCenterId == null) {
          continue;
        }
        const opMin = op.setupMin + op.runMinPerUnit * batches;
        loadMinByWc.set(op.workCenterId, (loadMinByWc.get(op.workCenterId) ?? 0) + opMin);
      }
    }

    const capacityLoad: CapacityLoadLine[] = [];
    // Tüm iş merkezlerini (yük olsun olmasın) deterministik sırayla raporla.
    const wcIds = [...wcById.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const wcId of wcIds) {
      const wc = wcById.get(wcId)!;
      const loadMin = loadMinByWc.get(wcId) ?? 0;
      const loadHours = round4(loadMin / 60);
      const availableHours = round4(wc.dailyHours * input.params.horizonDays);
      const utilizationPct =
        availableHours > 0 ? round2((loadHours / availableHours) * 100) : loadHours > 0 ? 100 : 0;
      const bottleneck = loadHours > availableHours;
      capacityLoad.push({
        workCenterId: wcId,
        name: wc.name,
        loadHours,
        availableHours,
        utilizationPct,
        bottleneck,
      });
    }

    // 5) Sıralama (deterministik) -------------------------------------------
    purchase.sort((a, b) => (a.materialRef < b.materialRef ? -1 : 1));
    // Üretim: önce derinlik (üst seviye önce planlanır), sonra ref.
    production.sort((a, b) => a.level - b.level || (a.materialRef < b.materialRef ? -1 : 1));
    shortages.sort((a, b) => (a.materialRef < b.materialRef ? -1 : 1));

    // 6) Özet ----------------------------------------------------------------
    const totalPurchaseCost = round2(purchase.reduce((s, p) => s + p.estCost, 0));
    const summary: MrpSummary = {
      totalPurchaseCost,
      distinctPurchaseItems: purchase.length,
      distinctProductionItems: production.length,
      bottleneckCount: capacityLoad.filter((c) => c.bottleneck).length,
    };

    return { purchase, production, shortages, capacityLoad, summary };
  }
}

/** Kolaylık: inventory dizisini snapshot Map'e çevirir. */
export function toInventorySnapshot(levels: readonly InventoryLevel[]): InventorySnapshot {
  const map = new Map<string, InventoryLevel>();
  for (const l of levels) {
    map.set(l.materialRef, l);
  }
  return map;
}
