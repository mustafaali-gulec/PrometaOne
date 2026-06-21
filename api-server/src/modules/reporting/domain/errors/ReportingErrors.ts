/**
 * Reporting (Report Studio / Rapor Üreteci) modülü domain hataları.
 *
 * Tümü `ReportingError` tabanından türer; presentation katmanı HTTP koduna
 * map'ler (errorMapping.ts). `code` alanı frontend'in hatayı sınıflamasına
 * yardım eder. (warehouse/finance error deseniyle aynı.)
 */
export abstract class ReportingError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

// --- Format / güvenlik / invariant (400) -----------------------------------

/** SQL güvenlik kontrolünü (SqlGuard) geçemedi — yalnız salt-okunur SELECT. */
export class SqlNotAllowedError extends ReportingError {
  readonly code = 'sql_not_allowed';
  constructor(reason: string) {
    super(`SQL reddedildi: ${reason}`);
  }
}

/** Görsel sorgu spec'i katalogda olmayan bir tablo/kolon/birleşim kullandı. */
export class UnknownIdentifierError extends ReportingError {
  readonly code = 'unknown_identifier';
  constructor(kind: string, value: string) {
    super(`Bilinmeyen ${kind}: "${value}" (katalogda yok veya raporlanamaz)`);
  }
}

/** Görsel sorgu spec'i geçersiz (örn. agregasyon var ama group by yok). */
export class InvalidQuerySpecError extends ReportingError {
  readonly code = 'invalid_query_spec';
  constructor(reason: string) {
    super(`Geçersiz sorgu tanımı: ${reason}`);
  }
}

/** Zorunlu bir parametre için değer verilmedi. */
export class MissingParamError extends ReportingError {
  readonly code = 'missing_param';
  constructor(name: string) {
    super(`Parametre değeri eksik: "${name}"`);
  }
}

/** Parametre değeri beklenen tipe dönüştürülemedi / izinli değerlerde değil. */
export class InvalidParamError extends ReportingError {
  readonly code = 'invalid_param';
  constructor(name: string, reason: string) {
    super(`Geçersiz parametre "${name}": ${reason}`);
  }
}

/** Rapor tanımı şekil olarak geçersiz (mode ↔ sql/spec uyuşmazlığı vb.). */
export class InvalidReportDefinitionError extends ReportingError {
  readonly code = 'invalid_report_definition';
  constructor(reason: string) {
    super(`Geçersiz rapor tanımı: ${reason}`);
  }
}

/** Sorgu statement_timeout sınırını aştı (PG 57014). */
export class QueryTimeoutError extends ReportingError {
  readonly code = 'query_timeout';
  constructor(timeoutMs: number) {
    super(`Sorgu zaman aşımına uğradı (> ${timeoutMs} ms). Lütfen sorguyu daraltın.`);
  }
}

/** Veritabanı sorguyu reddetti (syntax / bilinmeyen kolon / salt-okunur ihlali). */
export class SqlExecutionError extends ReportingError {
  readonly code = 'sql_execution_error';
  constructor(
    message: string,
    readonly pgCode?: string,
  ) {
    super(`Sorgu çalıştırılamadı: ${message}`);
  }
}

// --- Not found (404) -------------------------------------------------------
export class ReportDefinitionNotFoundError extends ReportingError {
  readonly code = 'report_not_found';
  constructor(id: number) {
    super(`Rapor tanımı bulunamadı: ${id}`);
  }
}

export class ReportFolderNotFoundError extends ReportingError {
  readonly code = 'folder_not_found';
  constructor(id: number) {
    super(`Rapor klasörü bulunamadı: ${id}`);
  }
}

// --- Conflict / iş kuralı (409) -------------------------------------------
export class DuplicateReportNameError extends ReportingError {
  readonly code = 'duplicate_report_name';
  constructor(name: string) {
    super(`Bu ad ile zaten bir rapor var: "${name}"`);
  }
}
