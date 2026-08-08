/**
 * İşe Alım · LinkedIn otomatik ilan API istemcisi — /v1/hr/linkedin.
 * hrRecruitingApi.js kalıbını izler (JWT: localStorage `promet_access_token`).
 *
 * Sunucu uçları (api-server/src/modules/hr/linkedin/presentation/routes.ts):
 *   GET    /connection?companyId=      → { connection, feedUrl }
 *   PUT    /connection                 → { companyId, clientId?, clientSecret?, organizationUrn?,
 *                                          organizationName?, autoPublish?, channels?,
 *                                          careerSiteBaseUrl?, isActive? } → { connection }
 *   DELETE /connection?companyId=      → { deleted }
 *   POST   /connection/test            → { ok, message, organizations }
 *   POST   /oauth/start                → { authorizeUrl }
 *   POST   /publish                    → { postingRef, results[], applyUrl, skippedReason }
 *   POST   /close                      → { results[] }
 *   GET    /posts?companyId=&postingRef= → { posts: [...] }
 *
 * Sır alanları (clientSecret) SUNUCUDAN HİÇ DÖNMEZ; `connection.hasCredentials`
 * yalnızca "kayıtlı mı" bilgisini taşır.
 */

const BASE = '/v1/hr/linkedin';

const token = () => {
  try {
    return globalThis.localStorage?.getItem('promet_access_token') || '';
  } catch {
    return '';
  }
};

async function call(method, path, { query, body } = {}) {
  const qs = query ? '?' + new globalThis.URLSearchParams(query).toString() : '';
  const res = await globalThis.fetch(`${BASE}${path}${qs}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.message || j.error || msg;
    } catch {
      /* ignore */
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

/**
 * Tarayıcıdan doğrudan açılabilen "LinkedIn'de paylaş" penceresi.
 * Hiçbir API anahtarı/onay gerektirmez — entegrasyon hiç kurulmamışken bile
 * çalışan yedek yol budur.
 */
export function linkedInShareWindowUrl(url) {
  if (!url) return null;
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

/** İlanın başvuru adresini kariyer sitesi tabanı + slug'dan kurar. */
export function buildApplyUrl(careerSiteBaseUrl, slugOrId) {
  if (!careerSiteBaseUrl || !slugOrId) return null;
  return `${String(careerSiteBaseUrl).replace(/\/+$/, '')}/${String(slugOrId).replace(/^\/+/, '')}`;
}

/** companyId enjekte eden istemci. */
export function makeHrLinkedInApi(companyId) {
  const cid = companyId == null ? 1 : companyId;
  const q = (extra) => ({ companyId: String(cid), ...(extra || {}) });

  return {
    /** → { connection: {...}|null, feedUrl: string|null } */
    getConnection: () => call('GET', '/connection', { query: q() }),

    /** → { connection } */
    saveConnection: (patch) => call('PUT', '/connection', { body: { companyId: cid, ...patch } }),

    deleteConnection: () => call('DELETE', '/connection', { query: q() }),

    /** → { ok, message, organizations: [{ urn, name }] } */
    testConnection: () => call('POST', '/connection/test', { body: { companyId: cid } }),

    /** → { authorizeUrl } — yeni pencerede açılır. */
    startOAuth: () => call('POST', '/oauth/start', { body: { companyId: cid } }),

    /**
     * İlanı LinkedIn'e gönderir.
     * @param {object} posting { postingRef, title, description, slug?, location?,
     *                           employmentType?, companyName?, applyUrl?, lang?,
     *                           channels?, trigger? }
     */
    publish: (posting) => call('POST', '/publish', { body: { companyId: cid, ...posting } }),

    /** İlan kapatılınca LinkedIn ayak izini temizler. */
    close: (postingRef) => call('POST', '/close', { body: { companyId: cid, postingRef } }),

    /** → { posts: [...] } — postingRef verilmezse şirketin tüm kayıtları. */
    listPosts: (postingRef) =>
      call('GET', '/posts', { query: q(postingRef ? { postingRef } : null) }),
  };
}
