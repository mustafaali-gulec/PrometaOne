/**
 * OrgUnitCode — şirket içi org birim kısa kodu (opsiyonel).
 *
 * Format: 1-40 karakter, harf-rakam-tire-altçizgi. Şirket içinde benzersiz
 * (DB unique index ile). Boş string verilmek istenirse `null` kullan —
 * `create` ile boş string geçerli sayılmaz.
 */
export class OrgUnitCode {
  private constructor(public readonly value: string) {}

  static create(raw: string): OrgUnitCode {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new InvalidOrgUnitCodeError('OrgUnitCode boş olamaz');
    }
    if (trimmed.length > 40) {
      throw new InvalidOrgUnitCodeError('OrgUnitCode 40 karakteri geçemez');
    }
    if (!ORG_UNIT_CODE_REGEX.test(trimmed)) {
      throw new InvalidOrgUnitCodeError(
        `OrgUnitCode sadece harf, rakam, tire ve altçizgi içerebilir: ${trimmed}`,
      );
    }
    return new OrgUnitCode(trimmed);
  }

  toString(): string {
    return this.value;
  }
}

const ORG_UNIT_CODE_REGEX = /^[A-Za-z0-9_-]+$/;

export class InvalidOrgUnitCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOrgUnitCodeError';
  }
}
