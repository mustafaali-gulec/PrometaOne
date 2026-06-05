/**
 * AuthTokenProvider — JWT access token kaynağı (frontend auth modülünden).
 * HR/Finance/Purchasing modülleriyle aynı pattern.
 */
export interface AuthTokenProvider {
  /** Boş string veya null → token yok / kullanıcı giriş yapmamış. */
  getAccessToken(): string | null;
}

/** Sabit token döndüren basit impl — test/demo için. */
export class StaticAuthTokenProvider implements AuthTokenProvider {
  constructor(private readonly token: string | null) {}

  getAccessToken(): string | null {
    return this.token;
  }
}
