/**
 * Beyanname modülü domain hataları.
 *
 * Bağımsız hiyerarşi (BeyannameError tabanı); presentation/errorMapping.ts
 * HTTP koduna map'ler. GİB e-Beyan REST yanıtlarındaki hata mesajları
 * GibValidationError.messages içinde taşınır.
 */
export class BeyannameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** İstek gövdesi/parametre doğrulama (iş kuralı öncesi). */
export class BeyannameValidationError extends BeyannameError {
  constructor(message: string) {
    super(message);
  }
}

/** Lokal beyanname kaydı bulunamadı. */
export class BeyannameNotFoundError extends BeyannameError {
  constructor(id: number) {
    super(`Beyanname bulunamadı: ${id}`);
  }
}

/** Durum makinesi ihlali (ör. onaylanmış beyanname güncellenemez). */
export class BeyannameStateError extends BeyannameError {
  constructor(message: string) {
    super(message);
  }
}

/** Şirkete ait e-Beyan entegrasyon kimliği tanımlı değil. */
export class CredentialsMissingError extends BeyannameError {
  constructor(companyId: number) {
    super(`e-Beyan entegrasyon bilgileri tanımlı değil: şirket ${companyId}`);
  }
}

/** Şifreli kimlik bilgisi çözülemedi (anahtar hatalı veya kurcalanmış). */
export class CredentialDecryptError extends BeyannameError {
  constructor(reason: string) {
    super(`e-Beyan kimlik bilgisi çözülemedi: ${reason}`);
  }
}

// --- GİB e-Beyan REST hataları ---------------------------------------------

/** 401/403 — hatalı API key veya eksik/yetkisiz header. */
export class GibAuthError extends BeyannameError {
  constructor(message: string) {
    super(`GİB e-Beyan yetkilendirme hatası: ${message}`);
  }
}

/** 400/422 — GİB veri/iş kuralı doğrulama; mesajlar taşınır. */
export class GibValidationError extends BeyannameError {
  constructor(
    message: string,
    readonly messages: ReadonlyArray<string> = [],
  ) {
    super(`GİB e-Beyan doğrulama hatası: ${message}`);
  }
}

/** GİB tarafında istenen kaynak bulunamadı (404). */
export class GibNotFoundError extends BeyannameError {
  constructor(message: string) {
    super(`GİB e-Beyan kaynağı bulunamadı: ${message}`);
  }
}

/** 5xx / ağ / zaman aşımı — öngörülemeyen GİB hatası. */
export class GibUnexpectedError extends BeyannameError {
  constructor(message: string) {
    super(`GİB e-Beyan beklenmedik hata: ${message}`);
  }
}
