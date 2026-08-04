/**
 * Çalışma zamanı API origin çekirdeği — SaaS + on-prem + mobil TEK build.
 *
 * Uygulamadaki backend çağrılarının tamamına yakını göreli path kullanır
 * (/v1/..., /api/ml/...). Varsayılanda istekler sayfanın origin'ine gider ve
 * nginx (prod) / Vite proxy (dev) doğru servise yönlendirir — bu modda bu
 * modül hiçbir şey değiştirmez.
 *
 * public/runtime-config.js içinde window.__MSUITE_RUNTIME__.apiOrigin
 * tanımlanırsa (ayrık API origin'i: SaaS CDN ayrımı, mobil kabuk vb.) buradaki
 * fetch sarmalayıcısı göreli API path'lerini o origin'e yeniden yazar. Böylece
 * image/build başına müşteri türetmek gerekmez.
 *
 * KATMANLAMA SÖZLEŞMESİ (bozmayın): main.jsx'te İLK import BU dosyadır; yani
 * buradaki sarmalayıcı window.fetch'in EN İÇ katmanıdır. Üzerine sırasıyla
 * license.js'in terminal-header patch'i ve App.jsx'in 401-oto-yenileme
 * interceptor'ı kurulur — ikisi de çağrı anındaki (çoğunlukla göreli) URL'yi
 * görmeye devam eder, gerçek istek ise doğru origin'e çıkar.
 */

function normalizeOrigin(value) {
  if (!value || typeof value !== 'string') return '';
  const v = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(v)) return '';
  try {
    const origin = new URL(v).origin;
    // Sayfanın kendi origin'i = varsayılan davranış; yeniden yazmaya gerek yok
    if (typeof window !== 'undefined' && origin === window.location.origin) return '';
    return origin;
  } catch {
    return '';
  }
}

const API_ORIGIN = normalizeOrigin(
  (typeof window !== 'undefined' &&
    window.__MSUITE_RUNTIME__ &&
    window.__MSUITE_RUNTIME__.apiOrigin) ||
    '',
);

/** Yapılandırılmış API origin'i ('' = aynı-origin varsayılanı). */
export function getApiOrigin() {
  return API_ORIGIN;
}

/** Backend'e giden göreli path mi? (/v1/... veya /api/ml/...) */
function isApiPath(path) {
  return (
    path === '/v1' ||
    path.indexOf('/v1/') === 0 ||
    path === '/api/ml' ||
    path.indexOf('/api/ml/') === 0
  );
}

if (API_ORIGIN && typeof window !== 'undefined' && typeof window.fetch === 'function') {
  // Eski/nadir kod yolları bu global'leri okur (e-Fatura, ML istemcisi,
  // şantiye foto <img src> tabanı) — aynı kaynaktan doldur.
  if (!window.PROMETCF_API) window.PROMETCF_API = API_ORIGIN;
  if (!window.__ML_API_BASE__) window.__ML_API_BASE__ = API_ORIGIN + '/api/ml';

  const baseFetch = window.fetch.bind(window);
  window.fetch = function apiOriginRewriteFetch(input, init) {
    try {
      if (typeof input === 'string') {
        if (isApiPath(input)) return baseFetch(API_ORIGIN + input, init);
        const u = new URL(input, window.location.origin);
        if (u.origin === window.location.origin && isApiPath(u.pathname)) {
          return baseFetch(API_ORIGIN + u.pathname + u.search + u.hash, init);
        }
      } else if (typeof URL !== 'undefined' && input instanceof URL) {
        if (input.origin === window.location.origin && isApiPath(input.pathname)) {
          return baseFetch(API_ORIGIN + input.pathname + input.search + input.hash, init);
        }
      } else if (typeof Request !== 'undefined' && input instanceof Request) {
        const u = new URL(input.url);
        if (u.origin === window.location.origin && isApiPath(u.pathname)) {
          return baseFetch(new Request(API_ORIGIN + u.pathname + u.search + u.hash, input), init);
        }
      }
    } catch {
      /* yeniden yazılamıyorsa isteği olduğu gibi geçir — akış bozulmasın */
    }
    return baseFetch(input, init);
  };
}
