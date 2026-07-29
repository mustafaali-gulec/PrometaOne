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

// ---- FAZ 1: Mekân kırılımı -------------------------------------------------

export class LocationNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Lokasyon bulunamadı: ${id}`);
  }
}

export class DuplicateLocationCodeError extends ConstructionError {
  constructor(code: string) {
    super(`Aynı üst mekânda bu kodda lokasyon zaten var: ${code}`);
  }
}

export class InvalidLocationNestingError extends ConstructionError {
  constructor(parentLabel: string, childLabel: string) {
    super(`'${parentLabel}' altına '${childLabel}' eklenemez`);
  }
}

export class LocationInUseError extends ConstructionError {
  constructor(id: number, usage: string) {
    super(`Lokasyon silinemez (${id}) — bağlı kayıt var: ${usage}`);
  }
}

// ---- FAZ 2: Fiziksel ilerleme takibi ---------------------------------------

export class ProgressTemplateNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`İlerleme takip şablonu bulunamadı: ${id}`);
  }
}

export class DuplicateProgressTemplateCodeError extends ConstructionError {
  constructor(code: string) {
    super(`Bu kodda takip şablonu zaten var: ${code}`);
  }
}

export class TrackingNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Güncel durum takibi bulunamadı: ${id}`);
  }
}

export class DuplicateTrackingCodeError extends ConstructionError {
  constructor(code: string) {
    super(`Bu kodda takip zaten var: ${code}`);
  }
}

export class TrackingItemNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Takip iş kalemi bulunamadı: ${id}`);
  }
}

export class TrackingNotActiveError extends ConstructionError {
  constructor(status: string) {
    super(`Saha durumu yalnız aktif takipte güncellenebilir (mevcut durum: '${status}')`);
  }
}

export class InvalidTrackingScopeError extends ConstructionError {
  constructor(scope: string, kindLabel: string) {
    super(`'${scope}' kapsamlı şablona '${kindLabel}' tipinde lokasyon eklenemez`);
  }
}

// ---- FAZ 3: Şantiye günlüğü ------------------------------------------------

export class DailyLogNotFoundError extends ConstructionError {
  constructor(idOrDate: number | string) {
    super(`Şantiye günlüğü bulunamadı: ${idOrDate}`);
  }
}

export class DailyLogLockedError extends ConstructionError {
  constructor(logDate: string) {
    super(`Bu günün raporu kilitli (${logDate}) — değişiklik için önce kilidi açın`);
  }
}

export class DailyLogEntryNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Günlük rapor kaydı bulunamadı: ${id}`);
  }
}

// ---- FAZ 5: Jenerik onay akışı ---------------------------------------------

export class ApprovalFlowNotFoundError extends ConstructionError {
  constructor(idOrDoc: number | string) {
    super(`Onay akışı bulunamadı: ${idOrDoc}`);
  }
}

export class ApprovalStepNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Onay adımı bulunamadı: ${id}`);
  }
}

export class DuplicateApprovalFlowError extends ConstructionError {
  constructor(docKind: string, docId: number) {
    super(`Bu belgede zaten bekleyen bir onay akışı var: ${docKind}#${String(docId)}`);
  }
}

export class ApprovalNotActionableError extends ConstructionError {
  constructor(reason: string) {
    super(`Onay işlemi yapılamaz: ${reason}`);
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

// ===== FAZ 6 — Kalite & Güvenlik ===========================================

export class DefectNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Hasar-eksiklik kaydı bulunamadı: ${id}`);
  }
}

export class DuplicateDefectCodeError extends ConstructionError {
  constructor(code: string) {
    super(`Bu kod projede zaten kullanılıyor: ${code}`);
  }
}

export class InspectionTemplateNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Denetim şablonu bulunamadı: ${id}`);
  }
}

export class DuplicateInspectionTemplateCodeError extends ConstructionError {
  constructor(code: string) {
    super(`Bu denetim şablonu kodu zaten kullanılıyor: ${code}`);
  }
}

export class InspectionNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Denetim bulunamadı: ${id}`);
  }
}

export class DuplicateInspectionCodeError extends ConstructionError {
  constructor(code: string) {
    super(`Bu denetim kodu zaten kullanılıyor: ${code}`);
  }
}

/** Onaylanmış denetimin cevapları değiştirilemez — karne o puanla yayınlandı. */
export class InspectionNotEditableError extends ConstructionError {
  constructor(id: number, status: string) {
    super(`Denetim bu statüde düzenlenemez (${status}): ${id}`);
  }
}

export class RfiNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Bilgi talebi bulunamadı: ${id}`);
  }
}

export class DuplicateRfiCodeError extends ConstructionError {
  constructor(code: string) {
    super(`Bu bilgi talebi kodu projede zaten kullanılıyor: ${code}`);
  }
}

export class AssignmentNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Görevlendirme bulunamadı: ${id}`);
  }
}

export class DuplicateAssignmentCodeError extends ConstructionError {
  constructor(code: string) {
    super(`Bu görevlendirme kodu projede zaten kullanılıyor: ${code}`);
  }
}

export class QualityFileNotFoundError extends ConstructionError {
  constructor(id: number) {
    super(`Ek dosya bulunamadı: ${id}`);
  }
}
