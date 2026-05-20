/**
 * Email — RFC 5322'nin sade bir alt kümesi.
 * Kullanıcı email'lerinde aşırı esnek olmayan ama practical bir validator.
 */
export class Email {
  private constructor(public readonly value: string) {}

  static create(raw: string): Email {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed.length === 0) {
      throw new InvalidEmailError('Email boş olamaz');
    }
    if (trimmed.length > 254) {
      throw new InvalidEmailError('Email 254 karakteri geçemez');
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      throw new InvalidEmailError(`Geçersiz email formatı: ${trimmed}`);
    }
    return new Email(trimmed);
  }

  /** Domain (right of @). */
  get domain(): string {
    const at = this.value.indexOf('@');
    return this.value.slice(at + 1);
  }

  toString(): string {
    return this.value;
  }
}

// Basit, pragmatik (RFC tam değil). Kullanıcı girişi için yeterli.
const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export class InvalidEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEmailError';
  }
}
