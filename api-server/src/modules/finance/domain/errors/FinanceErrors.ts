/**
 * Finance modülü domain hataları.
 *
 * Tümü `FinanceError` tabanından türer; presentation katmanı HTTP koduna
 * map'ler (errorMapping.ts).
 */
export abstract class FinanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidCurrencyError extends FinanceError {
  constructor(value: unknown) {
    super(`Geçersiz para birimi: ${String(value)} (beklenen: TRY, USD, EUR)`);
  }
}

export class CurrencyMismatchError extends FinanceError {
  constructor(a: string, b: string) {
    super(`Para birimi uyuşmazlığı: ${a} ile ${b} arasında işlem yapılamaz`);
  }
}

export class InvalidMoneyError extends FinanceError {
  constructor(reason: string) {
    super(`Geçersiz tutar: ${reason}`);
  }
}

export class InvalidKdvRateError extends FinanceError {
  constructor(value: number) {
    super(`Geçersiz KDV oranı: ${value} (0 ile 1 arasında olmalı)`);
  }
}

export class InvalidFiscalYearError extends FinanceError {
  constructor(value: number) {
    super(`Geçersiz mali yıl: ${value} (2000–2100 arası bekleniyor)`);
  }
}

export class InvalidMonthIndexError extends FinanceError {
  constructor(value: number) {
    super(`Geçersiz ay indeksi: ${value} (0–11 arası bekleniyor; 0=Ocak)`);
  }
}

export class InvalidAllocationError extends FinanceError {
  constructor(reason: string) {
    super(`Geçersiz tutar dağıtımı: ${reason}`);
  }
}

export class CategoryNotFoundError extends FinanceError {
  constructor(id: number) {
    super(`Kategori bulunamadı: ${id}`);
  }
}

export class DuplicateCategoryNameError extends FinanceError {
  constructor(section: string, name: string) {
    super(`Bu bölümde aynı isimli kategori zaten var: ${section} / "${name}"`);
  }
}

export class BankAccountNotFoundError extends FinanceError {
  constructor(id: number) {
    super(`Banka hesabı bulunamadı: ${id}`);
  }
}

export class KasaAccountNotFoundError extends FinanceError {
  constructor(id: number) {
    super(`Kasa hesabı bulunamadı: ${id}`);
  }
}

export class TransferEndpointNotFoundError extends FinanceError {
  constructor(type: string, id: number) {
    super(`Transfer uç noktası bulunamadı: ${type}#${id}`);
  }
}

export class InvoiceNotFoundError extends FinanceError {
  constructor(id: number) {
    super(`Fatura bulunamadı: ${id}`);
  }
}

export class InvoicePaymentNotFoundError extends FinanceError {
  constructor(id: number) {
    super(`Fatura ödemesi bulunamadı: ${id}`);
  }
}

export class CommitNotApplicableError extends FinanceError {
  constructor(reason: string) {
    super(`Bütçe hücresine işlenemez: ${reason}`);
  }
}

export class AlreadyCommittedError extends FinanceError {
  constructor(kind: string, id: number) {
    super(`Zaten bütçe hücresine işlenmiş: ${kind}#${id}`);
  }
}

export class KasaEntryNotFoundError extends FinanceError {
  constructor(id: number) {
    super(`Kasa hareketi bulunamadı: ${id}`);
  }
}

export class TransferNotFoundError extends FinanceError {
  constructor(id: number) {
    super(`Transfer bulunamadı: ${id}`);
  }
}
