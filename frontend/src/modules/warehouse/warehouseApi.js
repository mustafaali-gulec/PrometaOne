/**
 * WMS (Depo/Stok/Malzeme) backend API istemcisi — /v1/warehouse.
 *
 * Sunucu sayısal id kullanır; frontend ise string id ile çalışır (mevcut
 * WarehouseModule kodu === ile karşılaştırıyor). Bu istemci sınırda çevirir:
 *   - OKUMA: tüm `id` ve `*Id` alanları (iç içe `items`/`lots`/`options` dahil)
 *     String'e çevrilir → frontend kodu değişmeden çalışır.
 *   - YAZMA: aynı alanlar Number'a çevrilir (sayısal görünüyorsa) → sunucu FK'leri.
 *
 * JWT: localStorage `promet_access_token` (login'de set ediliyor).
 * companyId: çağrıda verilir (yazmada body, okumada query).
 */

const BASE = '/v1/warehouse';

const token = () => {
  try {
    return globalThis.localStorage?.getItem('promet_access_token') || '';
  } catch {
    return '';
  }
};

const isIdKey = (k) => k === 'id' || /Id$/.test(k);

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
// (backend *Id alanları number|null|optional ister; "" → 400 verir).
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

async function call(method, path, { body, query } = {}) {
  const qs = query ? '?' + new globalThis.URLSearchParams(query).toString() : '';
  const res = await globalThis.fetch(`${BASE}${path}${qs}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    body: body ? JSON.stringify(toServer(body)) : undefined,
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

// Malzeme: frontend şekli ↔ backend şeması uyumlama
//  - boş groupId/abc/type → kaldır (backend strict number/enum)
//  - negativeControl 'warn' → 'allow' (backend yalnız block|allow)
//  - whParams: frontend obje {whId:{min,max,safety,locationId}} ↔ backend dizi
function materialToServer(m) {
  const out = { ...m };
  if (out.groupId === '' || out.groupId == null) delete out.groupId;
  if (!out.abc) delete out.abc;
  if (!out.type) delete out.type;
  if (out.negativeControl === 'warn') out.negativeControl = 'allow';
  if (!['block', 'allow'].includes(out.negativeControl)) delete out.negativeControl;
  if (out.whParams && !Array.isArray(out.whParams)) {
    out.whParams = Object.entries(out.whParams)
      .map(([wid, v]) => ({
        warehouseId: wid,
        minStock: v?.min === '' || v?.min == null ? null : Number(v.min),
        maxStock: v?.max === '' || v?.max == null ? null : Number(v.max),
        safetyStock: v?.safety === '' || v?.safety == null ? null : Number(v.safety),
        locationId: v?.locationId || null,
      }))
      .filter(
        (p) =>
          p.minStock != null || p.maxStock != null || p.safetyStock != null || p.locationId != null,
      );
  }
  return out;
}
function materialToClient(m) {
  if (!m || typeof m !== 'object') return m;
  const out = { ...m };
  if (Array.isArray(out.whParams)) {
    const obj = {};
    out.whParams.forEach((p) => {
      if (p && p.warehouseId != null) {
        obj[String(p.warehouseId)] = {
          min: p.minStock ?? '',
          max: p.maxStock ?? '',
          safety: p.safetyStock ?? '',
          locationId: p.locationId != null ? String(p.locationId) : '',
        };
      }
    });
    out.whParams = obj;
  }
  return out;
}

/**
 * companyId enjekte eden bir istemci üretir.
 * Liste yanıtları sunucuda { warehouses: [...] } gibi sarılı gelir; burada diziye indiririz.
 */
export function makeWarehouseApi(companyId) {
  const cid = companyId == null ? 1 : companyId;
  const q = (extra) => ({ companyId: String(cid), ...(extra || {}) });
  const withCompany = (b) => ({ companyId: cid, ...b });
  const list = (path, key, query) =>
    call('GET', path, { query: q(query) }).then((r) => (Array.isArray(r) ? r : r?.[key] || []));

  return {
    // --- Depo ---
    listWarehouses: () => list('/warehouses', 'warehouses'),
    createWarehouse: (w) => call('POST', '/warehouses', { body: withCompany(w) }),
    updateWarehouse: (id, w) => call('PUT', `/warehouses/${id}`, { body: withCompany(w) }),
    deleteWarehouse: (id) => call('DELETE', `/warehouses/${id}`, { query: q() }),

    // --- Malzeme ---
    listMaterials: () => list('/materials', 'materials').then((arr) => arr.map(materialToClient)),
    createMaterial: (m) =>
      call('POST', '/materials', { body: withCompany(materialToServer(m)) }).then(materialToClient),
    updateMaterial: (id, m) =>
      call('PUT', `/materials/${id}`, { body: withCompany(materialToServer(m)) }).then(
        materialToClient,
      ),
    deleteMaterial: (id) => call('DELETE', `/materials/${id}`, { query: q() }),
    materialLedger: (id) => call('GET', `/materials/${id}/ledger`, { query: q() }),

    // --- Hareket / Stok ---
    listMovements: (query) => list('/movements', 'movements', query),
    createMovement: (mv) => call('POST', '/movements', { body: withCompany(mv) }),
    stockLevels: () => list('/stock-levels', 'levels'),

    // --- Tanımlar ---
    listGroups: () => list('/groups', 'groups'),
    createGroup: (g) => call('POST', '/groups', { body: withCompany(g) }),
    updateGroup: (id, g) => call('PUT', `/groups/${id}`, { body: withCompany(g) }),
    deleteGroup: (id) => call('DELETE', `/groups/${id}`, { query: q() }),

    listUnits: () => list('/units', 'units'),
    createUnit: (u) => call('POST', '/units', { body: withCompany(u) }),
    updateUnit: (id, u) => call('PUT', `/units/${id}`, { body: withCompany(u) }),
    deleteUnit: (id) => call('DELETE', `/units/${id}`, { query: q() }),

    listVariants: () => list('/variants', 'variants'),
    createVariant: (v) => call('POST', '/variants', { body: withCompany(v) }),
    updateVariant: (id, v) => call('PUT', `/variants/${id}`, { body: withCompany(v) }),
    deleteVariant: (id) => call('DELETE', `/variants/${id}`, { query: q() }),

    // --- Talep ---
    listRequests: () => list('/requests', 'requests'),
    createRequest: (r) => call('POST', '/requests', { body: withCompany(r) }),
    updateRequest: (id, r) => call('PUT', `/requests/${id}`, { body: withCompany(r) }),
    approveRequest: (id) => call('POST', `/requests/${id}/approve`, { body: withCompany({}) }),
    rejectRequest: (id, reason) =>
      call('POST', `/requests/${id}/reject`, { body: withCompany({ reason }) }),
    fulfillRequest: (id) => call('POST', `/requests/${id}/fulfill`, { body: withCompany({}) }),

    // --- Sayım ---
    listCounts: () => list('/counts', 'counts'),
    createCount: (c) => call('POST', '/counts', { body: withCompany(c) }),
    updateCount: (id, c) => call('PUT', `/counts/${id}`, { body: withCompany(c) }),
    applyCount: (id) => call('POST', `/counts/${id}/apply`, { body: withCompany({}) }),

    // --- Zimmet ---
    listAssignments: () => list('/assignments', 'assignments'),
    createAssignment: (a) => call('POST', '/assignments', { body: withCompany(a) }),
    returnAssignment: (id) => call('POST', `/assignments/${id}/return`, { body: withCompany({}) }),
  };
}
