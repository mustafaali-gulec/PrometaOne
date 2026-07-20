/**
 * Sabit Kıymet modülü domain hataları.
 *
 * Tümü `FixedAssetError` tabanından türer; presentation katmanı HTTP koduna
 * map'ler (errorMapping.ts).
 *   400 — invariant / geçersiz format
 */
export abstract class FixedAssetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class FixedAssetValidationError extends FixedAssetError {
  constructor(reason: string) {
    super(`Geçersiz veri: ${reason}`);
  }
}
