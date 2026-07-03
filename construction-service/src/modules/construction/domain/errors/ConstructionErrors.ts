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

export class PozNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Poz bulunamadı: ${id}`);
  }
}

export class DuplicatePozError extends ConstructionError {
  constructor(pozNo: string) {
    super(`Bu poz no zaten kayıtlı: ${pozNo}`);
  }
}

export class ProgressNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Hakediş bulunamadı: ${id}`);
  }
}

export class ProgressNotEditableError extends ConstructionError {
  constructor(status: string) {
    super(`Bu durumdaki hakediş düzenlenemez: '${status}' (yalnızca taslak/reddedilmiş)`);
  }
}

export class ExpenseNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Gider bulunamadı: ${id}`);
  }
}

export class AdvanceNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Avans bulunamadı: ${id}`);
  }
}

export class CashMovementNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Kasa/banka hareketi bulunamadı: ${id}`);
  }
}

export class MeasurementNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Yeşil defter kaydı bulunamadı: ${id}`);
  }
}

export class AttachmentNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Ataşman bulunamadı: ${id}`);
  }
}

export class PaymentNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Ödeme bulunamadı: ${id}`);
  }
}

export class MaterialNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Malzeme bulunamadı: ${id}`);
  }
}

export class DuplicateMaterialCodeError extends ConstructionError {
  constructor(code: string) {
    super(`Bu kodda malzeme zaten var: ${code}`);
  }
}

export class WarehouseNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Depo bulunamadı: ${id}`);
  }
}

export class DuplicateWarehouseCodeError extends ConstructionError {
  constructor(code: string) {
    super(`Bu kodda depo zaten var: ${code}`);
  }
}

export class MaterialRequestNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Malzeme talebi bulunamadı: ${id}`);
  }
}

export class MaterialRequestNotEditableError extends ConstructionError {
  constructor(status: string) {
    super(`Bu durumdaki talep düzenlenemez: '${status}' (yalnızca taslak/reddedilmiş)`);
  }
}

export class PersonnelNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Personel bulunamadı: ${id}`);
  }
}

export class MachineNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Makine bulunamadı: ${id}`);
  }
}

export class DuplicateMachineCodeError extends ConstructionError {
  constructor(code: string) {
    super(`Bu kodda makine zaten var: ${code}`);
  }
}

export class TimesheetNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Puantaj kaydı bulunamadı: ${id}`);
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
