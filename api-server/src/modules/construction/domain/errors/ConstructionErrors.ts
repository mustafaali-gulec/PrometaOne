/**
 * Şantiye (Construction) modülü domain hataları.
 *
 * Tümü `ConstructionError` tabanından türer; presentation katmanı HTTP koduna
 * map'ler (errorMapping.ts).
 *   404 — bulunamadı
 *   409 — çatışma (duplicate kod/no)
 *   400 — invariant / geçersiz statü geçişi / format
 */
export abstract class ConstructionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ProjectNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Proje bulunamadı: ${id}`);
  }
}

export class DuplicateProjectCodeError extends ConstructionError {
  constructor(code: string) {
    super(`Bu kodda proje zaten var: ${code}`);
  }
}

export class ContractNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Sözleşme bulunamadı: ${id}`);
  }
}

export class DuplicateContractNoError extends ConstructionError {
  constructor(no: string) {
    super(`Bu numarada sözleşme zaten var: ${no}`);
  }
}

export class InvalidStatusTransitionError extends ConstructionError {
  constructor(from: string, to: string) {
    super(`Geçersiz statü geçişi: '${from}' → '${to}'`);
  }
}

export class ConstructionValidationError extends ConstructionError {
  constructor(reason: string) {
    super(`Geçersiz veri: ${reason}`);
  }
}
