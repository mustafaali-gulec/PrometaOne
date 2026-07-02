/**
 * Performans modülü domain hataları.
 *
 * Tümü `PerformanceError` tabanından türer; presentation katmanı HTTP koduna
 * map'ler (errorMapping.ts).
 *   400 — invariant / geçersiz format
 */
export abstract class PerformanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class PerformanceValidationError extends PerformanceError {
  constructor(reason: string) {
    super(`Geçersiz veri: ${reason}`);
  }
}
