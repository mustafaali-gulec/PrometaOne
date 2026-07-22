/**
 * HR Organizasyon (OrgUnit + Department) backend API istemcisi — /v1/hr.
 * purchasingApi.js kalıbını izler.
 *
 * Sunucu sayısal id kullanır; frontend string id ile çalışır. Bu istemci sınırda çevirir:
 *   - OKUMA: tüm `id` ve `*Id` alanları String'e çevrilir.
 *   - YAZMA: gövdeler elle kurulur (rawBody) — çünkü zod şemaları `parentId`/`orgUnitId`
 *     için null'u ZORUNLU anahtar olarak ister; jenerik "boş id'yi atla" dönüşümü bunları
 *     düşürürdü. Sayısal olmayan id'ler (bayat "ou_x"/"dept_x") null'a düşer.
 * Endpoint imzaları api-server/src/modules/hr/presentation/routes.ts'ten doğrulandı:
 *   GET  /org-tree?companyId=            → { tree: [{ unit, children }] } (iç içe; burada düzleştirilir)
 *   POST /org-units                      → { companyId, parentId(null olabilir), name, code?, sortOrder? }
 *   PATCH /org-units/:id                 → { companyId, name?, code?, sortOrder? }
 *   POST /org-units/:id/move             → { companyId, newParentId(null olabilir) }
 *   DELETE /org-units/:id?companyId=     → arşivle
 *   GET  /departments?companyId=         → { departments: [...] } (BE ajanı ekliyor; 404 → null)
 *   POST /departments                    → { companyId, orgUnitId(null olabilir), name, code? }
 *   PATCH /departments/:id               → { companyId, name?, code?, orgUnitId? }
 *   DELETE /departments/:id?companyId=   → arşivle (aktif çalışan varsa 409)
 *   POST /departments/:id/assign-manager → { companyId, employeeId(null olabilir) }
 *   POST /org/adopt-blob                 → { companyId, orgUnits, departments } → { adopted, idMap }
 *                                          (BE ajanı ekliyor; 404 → null, sonraki yüklemede tekrar denenir)
 *
 * NOT: Department DTO'sunda managerEmployeeId sunucudan null gelirse alan SİLİNİR —
 * blob tarafındaki (string id'li) yönetici ataması önbellek birleşiminde ezilmesin diye.
 *
 * JWT: localStorage `promet_access_token` (login köprüsünde set edilir).
 * companyId: makeHrOrgApi(companyId) ile sabitlenir (yazmada body, okumada query).
 */

const BASE = '/v1/hr';

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
      if (isIdKey(k) && (typeof val === 'number' || typeof val === 'string') && val !== '') {
        out[k] = String(val);
      } else {
        out[k] = toClient(val);
      }
    }
    return out;
  }
  return v;
}

// Sayısal FK: "12"/12 → 12; "ou_x"/"" → null (zod positiveInt.nullable() ister)
const numId = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const strOrNull = (s) => {
  const v = typeof s === 'string' ? s.trim() : s;
  return v ? String(v) : null;
};

async function call(method, path, { query, rawBody } = {}) {
  const qs = query ? '?' + new globalThis.URLSearchParams(query).toString() : '';
  const res = await globalThis.fetch(`${BASE}${path}${qs}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    body: rawBody !== undefined ? JSON.stringify(rawBody) : undefined,
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

// { tree: [{ unit, children }] } → düz birim listesi (ebeveyn-önce sırayla)
function flattenOrgTree(nodes, acc = []) {
  for (const n of nodes || []) {
    if (n && n.unit) acc.push(n.unit);
    if (n && Array.isArray(n.children)) flattenOrgTree(n.children, acc);
  }
  return acc;
}

// Sunucudan null yönetici → alanı hiç taşıma (blob extras'ı ezmesin)
function deptToClient(d) {
  if (!d || typeof d !== 'object') return d;
  const out = { ...d };
  if (out.managerEmployeeId == null) delete out.managerEmployeeId;
  return out;
}

/**
 * companyId enjekte eden bir istemci üretir.
 * Liste yanıtları sunucuda { tree: [...] } / { departments: [...] } sarılı gelir.
 */
export function makeHrOrgApi(companyId) {
  const cid = companyId == null ? 1 : companyId;
  const q = (extra) => ({ companyId: String(cid), ...(extra || {}) });

  return {
    // --- Organizasyon birimleri ---
    listOrgUnits: () =>
      call('GET', '/org-tree', { query: q() }).then((r) =>
        flattenOrgTree(Array.isArray(r) ? r : r?.tree || []),
      ),
    createOrgUnit: ({ parentId, name, code, sortOrder } = {}) =>
      call('POST', '/org-units', {
        rawBody: {
          companyId: cid,
          parentId: numId(parentId),
          name: String(name || '').trim(),
          code: strOrNull(code),
          ...(Number.isInteger(sortOrder) ? { sortOrder } : {}),
        },
      }),
    updateOrgUnit: (id, { name, code, sortOrder } = {}) =>
      call('PATCH', `/org-units/${id}`, {
        rawBody: {
          companyId: cid,
          ...(name !== undefined ? { name: String(name || '').trim() } : {}),
          ...(code !== undefined ? { code: strOrNull(code) } : {}),
          ...(Number.isInteger(sortOrder) ? { sortOrder } : {}),
        },
      }),
    moveOrgUnit: (id, newParentId) =>
      call('POST', `/org-units/${id}/move`, {
        rawBody: { companyId: cid, newParentId: numId(newParentId) },
      }),
    deleteOrgUnit: (id) => call('DELETE', `/org-units/${id}`, { query: q() }),

    // --- Departmanlar ---
    // GET /departments henüz deploy edilmediyse (404) null döner; çağıran önbelleğe düşer.
    listDepartments: () =>
      call('GET', '/departments', { query: q() })
        .then((r) => (Array.isArray(r) ? r : r?.departments || []).map(deptToClient))
        .catch((e) => {
          if (e?.status === 404) return null;
          throw e;
        }),
    createDepartment: ({ orgUnitId, name, code } = {}) =>
      call('POST', '/departments', {
        rawBody: {
          companyId: cid,
          orgUnitId: numId(orgUnitId),
          name: String(name || '').trim(),
          code: strOrNull(code),
        },
      }).then(deptToClient),
    updateDepartment: (id, { name, code, orgUnitId } = {}) =>
      call('PATCH', `/departments/${id}`, {
        rawBody: {
          companyId: cid,
          ...(name !== undefined ? { name: String(name || '').trim() } : {}),
          ...(code !== undefined ? { code: strOrNull(code) } : {}),
          ...(orgUnitId !== undefined ? { orgUnitId: numId(orgUnitId) } : {}),
        },
      }).then(deptToClient),
    deleteDepartment: (id) => call('DELETE', `/departments/${id}`, { query: q() }),
    assignDepartmentManager: (id, employeeId) =>
      call('POST', `/departments/${id}/assign-manager`, {
        rawBody: { companyId: cid, employeeId: numId(employeeId) },
      }).then(deptToClient),

    // --- Tek seferlik blob devralma (idempotent upsert) ---
    // Blob verisi OLDUĞU GİBİ gönderilir (string id'ler bozulmasın diye dönüşümden geçmez).
    // Sözleşme: body {companyId, orgUnits?, departments?} → {adopted, idMap}.
    // Endpoint henüz deploy edilmediyse (404) sessizce null döner; sonraki yüklemede tekrar denenir.
    adoptBlobOrg: async ({ orgUnits, departments } = {}) => {
      try {
        const res = await globalThis.fetch(`${BASE}/org/adopt-blob`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
          },
          body: JSON.stringify({
            companyId: cid,
            ...(orgUnits?.length ? { orgUnits } : {}),
            ...(departments?.length ? { departments } : {}),
          }),
        });
        if (!res.ok) {
          if (res.status === 404) return null;
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
        // idMap'in eski (blob) anahtarları String kalmalı; toClient'tan geçirme.
        return await res.json().catch(() => null);
      } catch (e) {
        if (e?.status === 404) return null;
        throw e;
      }
    },
  };
}
