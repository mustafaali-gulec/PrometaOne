/**
 * Auth modülünde fırlatılan typed error'lar.
 * Presentation katmanı bunları uygun HTTP status'a çevirir.
 */

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Geçersiz kullanıcı adı veya şifre');
    this.name = 'InvalidCredentialsError';
  }
}

export class AccountInactiveError extends Error {
  constructor() {
    super('Hesap aktif değil');
    this.name = 'AccountInactiveError';
  }
}

export class CurrentPasswordMismatchError extends Error {
  constructor() {
    super('Mevcut şifre yanlış');
    this.name = 'CurrentPasswordMismatchError';
  }
}

export class InvalidPasswordResetTokenError extends Error {
  constructor() {
    super('Geçersiz veya süresi dolmuş şifre sıfırlama bağlantısı');
    this.name = 'InvalidPasswordResetTokenError';
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super('Kullanıcı bulunamadı');
    this.name = 'UserNotFoundError';
  }
}
