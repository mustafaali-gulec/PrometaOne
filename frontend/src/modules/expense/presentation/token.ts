/**
 * extractToken — JWT access token'ı URL hash'inden (`#token=...`) veya
 * localStorage'dan (`promet_access_token`) okur. PurchasingPage ile aynı.
 */
export function extractToken(): string | null {
  if (typeof window !== 'undefined' && window.location.hash.length > 1) {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const t = params.get('token');
    if (t !== null && t.length > 0) return t;
  }
  if (typeof window !== 'undefined') {
    try {
      const t = window.localStorage.getItem('promet_access_token');
      if (t !== null && t.length > 0) return t;
    } catch {
      /* ignore */
    }
  }
  return null;
}
