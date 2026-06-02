/**
 * AuthTokenProvider — JWT access token kaynağı (frontend auth modülünden).
 *
 * HR modülündeki ile aynı sözleşme; modüller arası coupling olmaması için
 * finance kendi kopyasını taşır (notifications/AI de aynı pattern'i kullanıyor).
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
