/**
 * AuthTokenProvider — JWT access token kaynağı (frontend auth modülünden).
 *
 * Demo'da basit bir constant impl kullanılabilir; production'da auth
 * modülünün state'inden okur. Notifications ve AI modülleri de aynı
 * pattern'i kullanıyor.
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
