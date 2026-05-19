/**
 * AuthTokenProvider — şu anki access token'ı veren port.
 *
 * Şu an App.jsx'in global state'inden geliyor (Strangler Fig adapter).
 * Faz 3 (Auth modülü) bittiğinde modules/auth'tan provider'lanacak.
 */
export interface AuthTokenProvider {
  getAccessToken(): string | null;
}
