/**
 * Satınalma modülü domain hataları.
 *
 * Tümü `PurchasingError` tabanından türer; presentation katmanı HTTP koduna
 * map'ler (errorMapping.ts).
 *   404 — bulunamadı
 *   409 — çatışma (duplicate kod)
 *   400 — invariant / geçersiz statü geçişi / format
 */
export abstract class PurchasingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class VendorNotFoundError extends PurchasingError {
  constructor(id: number) {
    super(`Tedarikçi bulunamadı: ${id}`);
  }
}

export class DuplicateVendorCodeError extends PurchasingError {
  constructor(code: string) {
    super(`Bu kodda tedarikçi zaten var: ${code}`);
  }
}

export class PurchaseRequestNotFoundError extends PurchasingError {
  constructor(id: number) {
    super(`Satınalma talebi bulunamadı: ${id}`);
  }
}

export class PurchaseOrderNotFoundError extends PurchasingError {
  constructor(id: number) {
    super(`Satınalma siparişi bulunamadı: ${id}`);
  }
}

export class InvalidStatusTransitionError extends PurchasingError {
  constructor(from: string, to: string) {
    super(`Geçersiz statü geçişi: '${from}' → '${to}'`);
  }
}

export class PurchasingValidationError extends PurchasingError {
  constructor(reason: string) {
    super(`Geçersiz veri: ${reason}`);
  }
}

export class AdoptConflictError extends PurchasingError {
  constructor(detail: string) {
    super(`Blob devralma çakışması (mevcut kayıtla kod/no çakışıyor): ${detail}`);
  }
}
