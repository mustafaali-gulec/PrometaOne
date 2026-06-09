/**
 * E-Fatura alt modülü domain hataları.
 *
 * Finance modülünün `FinanceError` tabanından türer; presentation katmanı
 * (PR 6) HTTP koduna map'ler. Böylece finance + einvoice tek hata hiyerarşisi.
 */
import { FinanceError } from '../../../domain/errors/FinanceErrors.js';

// --- Value object doğrulama hataları --------------------------------------
export class InvalidVknError extends FinanceError {
  constructor(value: unknown) {
    super(`Geçersiz VKN/TCKN: ${String(value)} (10 haneli VKN veya 11 haneli TCKN bekleniyor)`);
  }
}

export class InvalidEttnError extends FinanceError {
  constructor(value: unknown) {
    super(`Geçersiz ETTN: ${String(value)} (UUID formatı bekleniyor)`);
  }
}

export class InvalidProviderTypeError extends FinanceError {
  constructor(value: unknown) {
    super(`Geçersiz entegratör: ${String(value)} (elogo, qnb_efinans, logo_db, mock)`);
  }
}

export class InvalidInvoiceDirectionError extends FinanceError {
  constructor(value: unknown) {
    super(`Geçersiz fatura yönü: ${String(value)} (incoming, outgoing)`);
  }
}

export class InvalidEInvoiceScenarioError extends FinanceError {
  constructor(value: unknown) {
    super(`Geçersiz e-fatura senaryosu: ${String(value)}`);
  }
}

export class InvalidEInvoiceTypeError extends FinanceError {
  constructor(value: unknown) {
    super(`Geçersiz e-fatura tipi: ${String(value)}`);
  }
}

// --- Kimlik bilgisi / şifreleme -------------------------------------------
export class CredentialDecryptError extends FinanceError {
  constructor(reason: string) {
    super(`E-fatura kimlik bilgisi çözülemedi: ${reason}`);
  }
}

export class EInvoiceCredentialNotFoundError extends FinanceError {
  constructor(companyId: number, provider: string) {
    super(`E-fatura kimlik bilgisi yok: şirket ${companyId}, entegratör ${provider}`);
  }
}

// --- Provider (entegratör) -------------------------------------------------
export class ProviderAuthError extends FinanceError {
  constructor(message: string) {
    super(`Entegratör kimlik doğrulama hatası: ${message}`);
  }
}

export class ProviderFetchError extends FinanceError {
  constructor(message: string) {
    super(`Entegratör veri çekme hatası: ${message}`);
  }
}

export class ProviderInvoiceNotFoundError extends FinanceError {
  constructor(uuid: string) {
    super(`Entegratörde fatura bulunamadı: ${uuid}`);
  }
}

// --- Sync / import (PR 5'te kullanılacak) ---------------------------------
export class UblParseError extends FinanceError {
  constructor(reason: string) {
    super(`UBL-TR XML ayrıştırılamadı: ${reason}`);
  }
}

/** GİB e-Fatura HTML görüntüleme dosyası ayrıştırılamadı (gömülü JSON yok/bozuk). */
export class GibHtmlParseError extends FinanceError {
  constructor(reason: string) {
    super(`GİB e-Fatura HTML ayrıştırılamadı: ${reason}`);
  }
}

/** Yüklenen dosya ne UBL XML ne de GİB HTML olarak tanınamadı. */
export class UnsupportedEInvoiceFileError extends FinanceError {
  constructor(reason: string) {
    super(`Desteklenmeyen e-fatura dosyası: ${reason} (UBL XML veya GİB e-Fatura HTML bekleniyor)`);
  }
}

export class EInvoiceNotFoundError extends FinanceError {
  constructor(id: number) {
    super(`E-fatura bulunamadı: ${id}`);
  }
}

export class EInvoiceAlreadyImportedError extends FinanceError {
  constructor(id: number) {
    super(`E-fatura zaten içe aktarılmış: ${id}`);
  }
}
