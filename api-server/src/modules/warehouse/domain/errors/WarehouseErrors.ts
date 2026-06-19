/**
 * Warehouse (Depo/Stok/Malzeme — WMS) modülü domain hataları.
 *
 * Tümü `WarehouseError` tabanından türer; presentation katmanı HTTP koduna
 * map'ler (errorMapping.ts). Finance modülündeki FinanceError deseniyle aynı.
 */
export abstract class WarehouseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

// --- Format / invariant (400) ---------------------------------------------
export class InvalidWarehouseStatusError extends WarehouseError {
  constructor(value: unknown) {
    super(`Geçersiz depo durumu: ${String(value)} (beklenen: active, passive)`);
  }
}

export class InvalidGroupStatusError extends WarehouseError {
  constructor(value: unknown) {
    super(`Geçersiz grup durumu: ${String(value)} (beklenen: active, passive)`);
  }
}

export class InvalidVariantStatusError extends WarehouseError {
  constructor(value: unknown) {
    super(`Geçersiz varyant durumu: ${String(value)} (beklenen: active, passive)`);
  }
}

export class InvalidMaterialRequestStatusError extends WarehouseError {
  constructor(value: unknown) {
    super(
      `Geçersiz talep durumu: ${String(value)} (beklenen: pending, approved, rejected, fulfilled)`,
    );
  }
}

export class InvalidInventoryCountStatusError extends WarehouseError {
  constructor(value: unknown) {
    super(`Geçersiz sayım durumu: ${String(value)} (beklenen: open, applied)`);
  }
}

export class InvalidAssignmentStatusError extends WarehouseError {
  constructor(value: unknown) {
    super(`Geçersiz zimmet durumu: ${String(value)} (beklenen: open, returned)`);
  }
}

export class EmptyItemsError extends WarehouseError {
  constructor(what: string) {
    super(`${what} en az bir kalem içermeli`);
  }
}

export class InvalidMovementKindError extends WarehouseError {
  constructor(value: unknown) {
    super(`Geçersiz hareket türü: ${String(value)} (beklenen: in, out, transfer, count)`);
  }
}

export class InvalidTrackMethodError extends WarehouseError {
  constructor(value: unknown) {
    super(`Geçersiz takip yöntemi: ${String(value)} (beklenen: none, lot, serial, serialGroup)`);
  }
}

export class InvalidCostMethodError extends WarehouseError {
  constructor(value: unknown) {
    super(`Geçersiz maliyet yöntemi: ${String(value)} (beklenen: avg, fifo, lifo, actual)`);
  }
}

export class InvalidNegativeControlError extends WarehouseError {
  constructor(value: unknown) {
    super(`Geçersiz negatif stok kontrolü: ${String(value)} (beklenen: block, allow)`);
  }
}

export class InvalidQuantityError extends WarehouseError {
  constructor(reason: string) {
    super(`Geçersiz miktar: ${reason}`);
  }
}

export class InvalidMovementError extends WarehouseError {
  constructor(reason: string) {
    super(`Geçersiz stok hareketi: ${reason}`);
  }
}

// --- Not found (404) -------------------------------------------------------
export class WarehouseNotFoundError extends WarehouseError {
  constructor(id: number) {
    super(`Depo bulunamadı: ${id}`);
  }
}

export class MaterialNotFoundError extends WarehouseError {
  constructor(id: number) {
    super(`Malzeme bulunamadı: ${id}`);
  }
}

export class StockMovementNotFoundError extends WarehouseError {
  constructor(id: number) {
    super(`Stok hareketi bulunamadı: ${id}`);
  }
}

export class MaterialGroupNotFoundError extends WarehouseError {
  constructor(id: number) {
    super(`Malzeme grubu bulunamadı: ${id}`);
  }
}

export class UnitNotFoundError extends WarehouseError {
  constructor(id: number) {
    super(`Birim bulunamadı: ${id}`);
  }
}

export class VariantNotFoundError extends WarehouseError {
  constructor(id: number) {
    super(`Varyant bulunamadı: ${id}`);
  }
}

export class MaterialRequestNotFoundError extends WarehouseError {
  constructor(id: number) {
    super(`Malzeme talebi bulunamadı: ${id}`);
  }
}

export class InventoryCountNotFoundError extends WarehouseError {
  constructor(id: number) {
    super(`Envanter sayımı bulunamadı: ${id}`);
  }
}

export class AssignmentNotFoundError extends WarehouseError {
  constructor(id: number) {
    super(`Zimmet bulunamadı: ${id}`);
  }
}

// --- Conflict / iş kuralı (409) -------------------------------------------
export class DuplicateWarehouseCodeError extends WarehouseError {
  constructor(code: string) {
    super(`Bu kod ile zaten bir depo var: "${code}"`);
  }
}

export class DuplicateMaterialCodeError extends WarehouseError {
  constructor(code: string) {
    super(`Bu kod ile zaten bir malzeme var: "${code}"`);
  }
}

export class WarehouseHasMovementsError extends WarehouseError {
  constructor(id: number) {
    super(`Depo silinemez — bağlı stok hareketleri var: ${id}`);
  }
}

export class MaterialHasMovementsError extends WarehouseError {
  constructor(id: number) {
    super(`Malzeme silinemez — bağlı stok hareketleri var: ${id}`);
  }
}

export class InsufficientStockError extends WarehouseError {
  constructor(materialId: number, warehouseId: number, available: string, requested: string) {
    super(
      `Yetersiz stok — malzeme#${materialId} depo#${warehouseId}: mevcut ${available}, ` +
        `talep ${requested} (negatif stok kapalı)`,
    );
  }
}

export class DuplicateGroupCodeError extends WarehouseError {
  constructor(code: string) {
    super(`Bu kod ile zaten bir malzeme grubu var: "${code}"`);
  }
}

export class DuplicateUnitCodeError extends WarehouseError {
  constructor(code: string) {
    super(`Bu kod ile zaten bir birim var: "${code}"`);
  }
}

export class DuplicateVariantCodeError extends WarehouseError {
  constructor(code: string) {
    super(`Bu kod ile zaten bir varyant var: "${code}"`);
  }
}

/** Talep/sayım/zimmet zaten geçilmiş bir durumda — iş akışı geçişi reddedilir. */
export class InvalidWorkflowTransitionError extends WarehouseError {
  constructor(entity: string, from: string, action: string) {
    super(`${entity} "${from}" durumundayken ${action} yapılamaz`);
  }
}
