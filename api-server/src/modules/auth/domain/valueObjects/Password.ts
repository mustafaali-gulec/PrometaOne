/**
 * Password — düz metin şifre value object'i.
 *
 * Validation:
 * - En az 8 karakter
 * - En fazla 200 karakter (bcrypt 72 byte sınırına yakın güvenlik marjı)
 *
 * Hashlemez! Hashleme PasswordHasher port'unun işi.
 */
export class Password {
  private constructor(public readonly value: string) {}

  static create(raw: string): Password {
    if (raw.length < MIN_LENGTH) {
      throw new WeakPasswordError(`Şifre en az ${MIN_LENGTH} karakter olmalı`);
    }
    if (raw.length > MAX_LENGTH) {
      throw new WeakPasswordError(`Şifre ${MAX_LENGTH} karakteri geçemez`);
    }
    return new Password(raw);
  }
}

const MIN_LENGTH = 8;
const MAX_LENGTH = 200;

export class WeakPasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeakPasswordError';
  }
}
