/**
 * Gider/Masraf modülü domain hataları.
 *
 * Tümü `ExpenseError` tabanından türer; presentation katmanı HTTP koduna
 * map'ler (errorMapping.ts).
 *   404 — bulunamadı
 *   409 — çatışma (duplicate kod)
 *   400 — invariant / geçersiz format
 */
export abstract class ExpenseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ExpenseCardNotFoundError extends ExpenseError {
  constructor(id: number) {
    super(`Gider kartı bulunamadı: ${id}`);
  }
}

export class DuplicateExpenseCardCodeError extends ExpenseError {
  constructor(code: string) {
    super(`Bu kodda gider kartı zaten var: ${code}`);
  }
}

export class ExpenseValidationError extends ExpenseError {
  constructor(reason: string) {
    super(`Geçersiz veri: ${reason}`);
  }
}
