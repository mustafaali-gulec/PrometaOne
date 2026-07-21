/**
 * Satınalma (Purchasing) backend API istemcisi — /v1/purchasing.
 * warehouseApi.js kalıbını izler.
 *
 * Sunucu sayısal id kullanır; frontend string id ile çalışır. Bu istemci sınırda çevirir:
 *   - OKUMA: tüm `id` ve `*Id` alanları String'e çevrilir (taxId hariç — vergi no metindir).
 *   - YAZMA: aynı alanlar sayısal görünüyorsa Number'a çevrilir; boş id'ler atlanır.
 * Ek uyumlama (backend zod şemaları — api-server/src/modules/purchasing/presentation/routes.ts):
 *   - PO: frontend `items`/`notes`/`sourcePRId` ↔ backend `lines`/`note`/`prId`.
 *   - Vendor: backend `taxId` → frontend `taxNumber` takma adı (mevcut UI alanı).
 *   - currency yalnız TRY|USD|EUR (aksi TRY'ye düşer), requiredBy YYYY-AA-GG değilse gönderilmez,
 *     sayısal olmayan departmentId/vendorId/prId gönderilmez (zod number ister).
 *
 * JWT: localStorage `promet_access_token` (login köprüsünde set edilir).
 * companyId: çağrıda verilir (yazmada body, okumada query).
 */

const BASE = '/v1/purchasing';

const token = () => {
  try {
    return globalThis.localStorage?.getItem('promet_access_token') || '';
  } catch {
    return '';
  }
};

/** JWT payload'ından kimlik (backend userId + username) — requester eşlemesi için. */
export function purchasingTokenIdentity() {
  try {
    const tk = token();
    if (!tk) return null;
    const part = tk.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(globalThis.atob(padded));
    return {
      userId: payload?.sub != null ? String(payload.sub) : '',
      username: payload?.username || '',
    };
  } catch {
    return null;
  }
}

// taxId bir vergi numarasıdır (metin) — id dönüşümüne girmez.
const isIdKey = (k) => k === 'id' || (/Id$/.test(k) && k !== 'taxId');

// OKUMA: id/*Id alanlarını String'e çevir (derin)
function toClient(v) {
  if (Array.isArray(v)) return v.map(toClient);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (
        isIdKey(k) &&
        (typeof val === 'number' || typeof val === 'string') &&
        val !== null &&
        val !== ''
      ) {
        out[k] = String(val);
      } else {
        out[k] = toClient(val);
      }
    }
    return out;
  }
  return v;
}

// YAZMA: id/*Id alanlarını Number'a çevir; boş ("" / null) id'leri TAMAMEN ATLA
function toServer(v) {
  if (Array.isArray(v)) return v.map(toServer);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (isIdKey(k)) {
        if (val === '' || val == null) continue; // boş id gönderme
        if (typeof val === 'string' && /^\d+$/.test(val.trim())) {
          out[k] = Number(val.trim());
          continue;
        }
        out[k] = val;
      } else if (val && typeof val === 'object') {
        out[k] = toServer(val);
      } else {
        out[k] = val;
      }
    }
    return out;
  }
  return v;
}

async function call(method, path, { body, query, rawBody } = {}) {
  const qs = query ? '?' + new globalThis.URLSearchParams(query).toString() : '';
  const payload = rawBody !== undefined ? rawBody : body ? toServer(body) : undefined;
  const res = await globalThis.fetch(`${BASE}${path}${qs}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
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
  const json = await res.json().catch(() => null);
  return toClient(json);
}

// --- Sınır uyumlama yardımcıları ------------------------------------------

const CURRENCIES = ['TRY', 'USD', 'EUR'];
const sanitizeCurrency = (c) => (CURRENCIES.includes(c) ? c : 'TRY');
const strOrNull = (s) => {
  const v = typeof s === 'string' ? s.trim() : s;
  return v ? String(v) : null;
};
const dateOrNull = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : null);
// Sayısal FK: "12"/12 → 12; "dep_x"/"" → null (zod number ister; göndermeyiz)
const numId = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** PR frontend taslağı → backend create/update gövdesi. */
function prToServer(p) {
  const out = {
    category: p.category || 'other',
    priority: p.priority || 'normal',
    currency: sanitizeCurrency(p.currency),
    justification: strOrNull(p.justification),
    requiredBy: dateOrNull(p.requiredBy),
  };
  const dep = numId(p.departmentId);
  if (dep != null) out.departmentId = dep;
  if (Array.isArray(p.items)) {
    out.items = p.items
      .map((i) => ({
        description: String(i.description || '').trim(),
        quantity: Number(i.quantity) || 0,
        unitPrice: Number(i.unitPrice) || 0,
        note: strOrNull(i.note),
      }))
      .filter((i) => i.description);
  }
  if (p.submit === true) out.submit = true;
  return out;
}

/** PO frontend taslağı → backend create/update gövdesi (items→lines, notes→note). */
function poToServer(p, { create = false } = {}) {
  const out = {
    currency: sanitizeCurrency(p.currency),
    note: strOrNull(p.notes != null ? p.notes : p.note),
  };
  if (create) {
    const vid = numId(p.vendorId);
    if (vid != null) out.vendorId = vid;
    const prId = numId(p.sourcePRId != null ? p.sourcePRId : p.prId);
    if (prId != null) out.prId = prId;
    if (p.markOrdered === true) out.markOrdered = true;
  }
  const src = Array.isArray(p.items) ? p.items : Array.isArray(p.lines) ? p.lines : null;
  if (src) {
    const lines = src
      .map((l) => ({
        description: String(l.description || '').trim(),
        quantity: Number(l.quantity) || 0,
        unitPrice: Number(l.unitPrice) || 0,
        receivedQty: Number(l.receivedQty) || 0,
      }))
      .filter((l) => l.description);
    if (lines.length) out.lines = lines; // PATCH lines min(1) ister — boş dizi gönderme
  }
  return out;
}

/** PO backend DTO → frontend şekli (lines→items, note→notes, prId→sourcePRId). */
function poToClient(o) {
  if (!o || typeof o !== 'object') return o;
  const out = { ...o };
  if (Array.isArray(out.lines)) out.items = out.lines;
  if (out.note != null && out.notes == null) out.notes = out.note;
  if (out.prId != null && out.sourcePRId == null) out.sourcePRId = out.prId;
  return out;
}

/** Vendor frontend taslağı → backend gövdesi (boş alanları gönderme). */
function vendorToServer(v) {
  const out = { name: String(v.name || '').trim() };
  if (v.code) out.code = String(v.code);
  const opt = ['taxId', 'taxOffice', 'address', 'accountCode'];
  opt.forEach((k) => {
    const val = strOrNull(v[k] != null ? v[k] : k === 'taxId' ? v.taxNumber : undefined);
    if (val != null) out[k] = val;
  });
  if (v.personType === 'real' || v.personType === 'legal') out.personType = v.personType;
  if (v.cariClass === 'satici' || v.cariClass === 'alici') out.cariClass = v.cariClass;
  return out;
}

/** Vendor backend DTO → frontend şekli (taxId → taxNumber takma adı; mevcut UI alanı). */
function vendorToClient(v) {
  if (!v || typeof v !== 'object') return v;
  const out = { ...v };
  if (out.taxNumber == null && out.taxId != null) out.taxNumber = out.taxId;
  return out;
}

/**
 * companyId enjekte eden bir istemci üretir.
 * Liste yanıtları sunucuda { vendors: [...] } gibi sarılı gelir; burada diziye indiririz.
 */
export function makePurchasingApi(companyId) {
  const cid = companyId == null ? 1 : companyId;
  const q = (extra) => ({ companyId: String(cid), ...(extra || {}) });
  const withCompany = (b) => ({ companyId: cid, ...b });
  const list = (path, key, query) =>
    call('GET', path, { query: q(query) }).then((r) => (Array.isArray(r) ? r : r?.[key] || []));

  return {
    // --- Tedarikçiler ---
    listVendors: (query) => list('/vendors', 'vendors', query).then((a) => a.map(vendorToClient)),
    createVendor: (v) =>
      call('POST', '/vendors', { body: withCompany(vendorToServer(v)) }).then(vendorToClient),
    updateVendor: (id, v) =>
      call('PATCH', `/vendors/${id}`, { body: withCompany(vendorToServer(v)) }).then(
        vendorToClient,
      ),
    deleteVendor: (id) => call('DELETE', `/vendors/${id}`, { query: q() }),

    // --- Talepler (PR) ---
    listRequests: (query) => list('/requests', 'requests', query),
    createRequest: (r) => call('POST', '/requests', { body: withCompany(prToServer(r)) }),
    updateRequest: (id, r) =>
      call('PATCH', `/requests/${id}`, { body: withCompany(prToServer(r)) }),
    deleteRequest: (id) => call('DELETE', `/requests/${id}`, { query: q() }),
    changeRequestStatus: (id, status) =>
      call('POST', `/requests/${id}/status`, { body: withCompany({ status }) }),

    // --- Siparişler (PO) ---
    listOrders: (query) => list('/orders', 'orders', query).then((a) => a.map(poToClient)),
    createOrder: (o) =>
      call('POST', '/orders', { body: withCompany(poToServer(o, { create: true })) }).then(
        poToClient,
      ),
    updateOrder: (id, o) =>
      call('PATCH', `/orders/${id}`, { body: withCompany(poToServer(o)) }).then(poToClient),
    changeOrderStatus: (id, status) =>
      call('POST', `/orders/${id}/status`, { body: withCompany({ status }) }).then(poToClient),

    // --- Tek seferlik blob devralma ---
    // Blob verisi OLDUĞU GİBİ gönderilir (string id'ler bozulmasın diye toServer'dan geçmez).
    // Sözleşme: body {companyId, vendors?, requests?, orders?} → {adopted, idMap}.
    // Endpoint henüz deploy edilmediyse (404) sessizce null döner; sonraki yüklemede tekrar denenir.
    adoptBlob: async ({ vendors, requests, orders } = {}) => {
      try {
        return await call('POST', '/adopt-blob', {
          rawBody: {
            companyId: cid,
            ...(vendors?.length ? { vendors } : {}),
            ...(requests?.length ? { requests } : {}),
            ...(orders?.length ? { orders } : {}),
          },
        });
      } catch (e) {
        if (e?.status === 404) return null;
        throw e;
      }
    },
  };
}
