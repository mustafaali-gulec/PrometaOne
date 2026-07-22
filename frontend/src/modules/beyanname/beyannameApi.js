/**
 * Beyanname (KDV1 + GİB e-Beyan) backend API istemcisi — /v1/beyanname.
 *
 * Tam sunucu-backed modül (veri SQL'de yaşar, blob'a yazılmaz). Kayıt id'leri
 * sayısaldır ve olduğu gibi kullanılır. JWT: localStorage `promet_access_token`.
 * companyId çağrıda verilir (yazmada body, okumada query).
 */

const BASE = '/v1/beyanname';

const token = () => {
  try {
    return globalThis.localStorage?.getItem('promet_access_token') || '';
  } catch {
    return '';
  }
};

async function call(method, path, { body, query } = {}) {
  const qs = query ? '?' + new globalThis.URLSearchParams(query).toString() : '';
  const res = await globalThis.fetch(`${BASE}${path}${qs}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
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

export function makeBeyannameApi(companyId) {
  const cid = Number(companyId) || 1;
  return {
    // --- Entegrasyon ayarları ---
    getCredential: () => call('GET', '/credentials', { query: { companyId: cid } }),
    saveCredential: (config) => call('PUT', '/credentials', { body: { companyId: cid, config } }),
    deleteCredential: () => call('DELETE', '/credentials', { query: { companyId: cid } }),
    testConnection: () => call('POST', '/credentials/test', { body: { companyId: cid } }),

    // --- Lokal beyanname CRUD ---
    listDeclarations: ({ durum, yil } = {}) =>
      call('GET', '/declarations', {
        query: {
          companyId: cid,
          ...(durum ? { durum } : {}),
          ...(yil ? { yil } : {}),
        },
      }),
    getDeclaration: (id) => call('GET', `/declarations/${id}`, { query: { companyId: cid } }),
    createDeclaration: (payload) =>
      call('POST', '/declarations', { body: { companyId: cid, ...payload } }),
    updateDeclaration: (id, patch) =>
      call('PUT', `/declarations/${id}`, { body: { companyId: cid, ...patch } }),
    deleteDeclaration: (id) => call('DELETE', `/declarations/${id}`, { query: { companyId: cid } }),

    // --- GİB akışı ---
    send: (id) => call('POST', `/declarations/${id}/send`, { body: { companyId: cid } }),
    check: (id) => call('POST', `/declarations/${id}/check`, { body: { companyId: cid } }),
    getOzelOnay: (id) =>
      call('GET', `/declarations/${id}/ozel-onay`, { query: { companyId: cid } }),
    approve: (id, opts = {}) =>
      call('POST', `/declarations/${id}/approve`, { body: { companyId: cid, ...opts } }),
    makeDraft: (id) => call('POST', `/declarations/${id}/make-draft`, { body: { companyId: cid } }),
    refreshStatus: (id) =>
      call('POST', `/declarations/${id}/refresh-status`, { body: { companyId: cid } }),
    pdfUrl: (id, type = 'beyanname') =>
      `${BASE}/declarations/${id}/pdf?companyId=${cid}&type=${type}`,

    // --- GİB'deki beyannameler + referanslar ---
    listGib: ({ durum, page, size } = {}) =>
      call('GET', '/gib/beyannameler', {
        query: {
          companyId: cid,
          ...(durum ? { durum } : {}),
          ...(page != null ? { page } : {}),
          ...(size != null ? { size } : {}),
        },
      }),
    vergiDaireleri: () => call('GET', '/reference/vergi-daireleri', { query: { companyId: cid } }),
    kdvOranlari: () => call('GET', '/reference/kdv-oranlari', { query: { companyId: cid } }),
  };
}

/**
 * PDF'i Bearer token ile indirir (yeni sekmede açar). GET query'de token yok;
 * fetch + blob ile indirilir.
 */
export async function openBeyannamePdf(url) {
  const res = await globalThis.fetch(url, {
    headers: { ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
  });
  if (!res.ok) {
    const err = new Error(`PDF HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  const objUrl = globalThis.URL.createObjectURL(blob);
  globalThis.open(objUrl, '_blank');
  globalThis.setTimeout(() => globalThis.URL.revokeObjectURL(objUrl), 60_000);
}
