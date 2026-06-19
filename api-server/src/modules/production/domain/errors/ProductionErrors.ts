/**
 * Production (Üretim & MRP) modülü domain hataları.
 *
 * Tümü `ProductionError` tabanından türer; presentation katmanı HTTP koduna
 * map'ler (errorMapping.ts).
 */
export abstract class ProductionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

// --- Bulunamadı (404) -------------------------------------------------------

export class BomNotFoundError extends ProductionError {
  constructor(id: number) {
    super(`Ürün ağacı (reçete) bulunamadı: ${id}`);
  }
}

export class WorkCenterNotFoundError extends ProductionError {
  constructor(id: number) {
    super(`İş merkezi bulunamadı: ${id}`);
  }
}

export class ProductionOrderNotFoundError extends ProductionError {
  constructor(id: number) {
    super(`Üretim emri bulunamadı: ${id}`);
  }
}

// --- Çatışma (409) ----------------------------------------------------------

export class DuplicateBomNoError extends ProductionError {
  constructor(no: string) {
    super(`Bu numarada reçete zaten var: "${no}"`);
  }
}

export class DuplicateWorkCenterCodeError extends ProductionError {
  constructor(code: string) {
    super(`Bu kodda iş merkezi zaten var: "${code}"`);
  }
}

export class DuplicateProductionOrderNoError extends ProductionError {
  constructor(no: string) {
    super(`Bu numarada üretim emri zaten var: "${no}"`);
  }
}

// --- Domain invariant / iş kuralı (400) ------------------------------------

export class InvalidBomError extends ProductionError {
  constructor(reason: string) {
    super(`Geçersiz reçete: ${reason}`);
  }
}

export class InvalidWorkCenterError extends ProductionError {
  constructor(reason: string) {
    super(`Geçersiz iş merkezi: ${reason}`);
  }
}

export class InvalidProductionOrderError extends ProductionError {
  constructor(reason: string) {
    super(`Geçersiz üretim emri: ${reason}`);
  }
}

export class InvalidOrderStatusTransitionError extends ProductionError {
  constructor(from: string, to: string) {
    super(`Geçersiz üretim emri durum geçişi: ${from} → ${to}`);
  }
}

export class BomCycleError extends ProductionError {
  constructor(materialRef: string) {
    super(`Reçete döngüsü algılandı (yarı mamul kendini içeriyor): ${materialRef}`);
  }
}

export class InvalidMrpParamsError extends ProductionError {
  constructor(reason: string) {
    super(`Geçersiz MRP parametresi: ${reason}`);
  }
}
