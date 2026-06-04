/**
 * RefreshingAuthTokenProvider — localStorage tabanli access/refresh token
 * kaynagi + 401 sonrasi reaktif yenileme yardimcilari.
 *
 * Arka plan: backend access JWT'si ~15 dk sonra dolar. Eski akista access
 * token bir kez yakalaniyordu; doldugunda her /v1/* cagrisi 401 donuyor ve
 * kurtarma yoktu. Bu util:
 *  - access token'i her cagrida localStorage'dan taze okur (getAccessToken),
 *  - POST /v1/auth/refresh ile yeni access token alip localStorage'a yazan
 *    bir `refresh` callback'i (RefreshFn) saglar.
 *
 * Backend sozlesmesi (api-server/.../auth):
 *  - POST /v1/auth/login   -> { accessToken, refreshToken, expiresIn, user }
 *  - POST /v1/auth/refresh body: { refreshToken }
 *                          -> { accessToken, expiresIn }   (refresh ROTASYON YOK)
 *
 * StaticAuthTokenProvider'a dokunulmaz; testler onu kullanmaya devam eder.
 */
import type { AuthTokenProvider } from '../../application/ports/AuthTokenProvider';

export const ACCESS_TOKEN_KEY = 'promet_access_token';
export const REFRESH_TOKEN_KEY = 'promet_refresh_token';

/**
 * 401 sonrasi cagrilan yenileme fonksiyonu.
 * Basariliysa yeni access token doner; basarisizsa null.
 */
export type RefreshFn = () => Promise<string | null>;

/** Backend /v1/auth/refresh response shape (sadece okunan alanlar). */
interface RefreshResponse {
  accessToken: string;
  /** Backend bu PR'da refresh token rotate ETMIYOR; ileride eklenirse okunur. */
  refreshToken?: string;
  expiresIn?: number;
}

function safeGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(key);
    return v !== null && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/**
 * Access token'i her cagrida localStorage'dan okuyan provider.
 * `getAccessToken()` her zaman guncel degeri doner — boylece refresh
 * sonrasi yeni token otomatik kullanilir.
 */
export class LocalStorageAuthTokenProvider implements AuthTokenProvider {
  getAccessToken(): string | null {
    return safeGet(ACCESS_TOKEN_KEY);
  }
}

/**
 * localStorage'daki refresh token'i kullanarak /v1/auth/refresh cagiran ve
 * yeni access token'i localStorage'a yazan bir RefreshFn uretir.
 *
 * Es zamanli birden cok 401 olursa tek bir refresh isteginin paylasilmasi
 * icin in-flight promise cache'lenir.
 *
 * @param baseUrl API kok adresi (HrApiClient/AccessApiClient ile ayni).
 * @param fetchImpl Test icin enjekte edilebilir fetch (default: global fetch).
 * @returns refresh token yoksa null; aksi halde RefreshFn.
 */
export function createTokenRefresher(baseUrl: string, fetchImpl: typeof fetch = fetch): RefreshFn {
  let inFlight: Promise<string | null> | null = null;

  const doRefresh = async (): Promise<string | null> => {
    const refreshToken = safeGet(REFRESH_TOKEN_KEY);
    if (refreshToken === null) return null;

    try {
      const response = await fetchImpl(`${baseUrl}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) return null;

      const data = (await response.json()) as RefreshResponse;
      if (typeof data.accessToken !== 'string' || data.accessToken.length === 0) {
        return null;
      }
      safeSet(ACCESS_TOKEN_KEY, data.accessToken);
      // Backend ileride refresh token rotate ederse yenisini de sakla.
      if (typeof data.refreshToken === 'string' && data.refreshToken.length > 0) {
        safeSet(REFRESH_TOKEN_KEY, data.refreshToken);
      }
      return data.accessToken;
    } catch {
      return null;
    }
  };

  return (): Promise<string | null> => {
    if (inFlight !== null) return inFlight;
    inFlight = doRefresh().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}

/**
 * Bir refresh token mevcut mu? (HrDemoPage komposizyonu static/refreshing
 * davranis arasinda secim yapmak icin kullanir.)
 */
export function hasRefreshToken(): boolean {
  return safeGet(REFRESH_TOKEN_KEY) !== null;
}
