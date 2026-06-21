/**
 * Report Studio (Rapor Üreteci) backend API istemcisi — /v1/reports.
 *
 * warehouseApi deseni: fetch + JWT (localStorage promet_access_token) + companyId
 * enjeksiyonu. Rapor satırları serbest şemalı olduğundan id-dönüşümü YOKTUR.
 */

const BASE = '/v1/reports';

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
    let code = '';
    try {
      const j = await res.json();
      msg = j.message || j.error || msg;
      code = j?.cause?.code || j?.code || '';
    } catch {
      /* ignore */
    }
    const err = new Error(msg);
    err.status = res.status;
    err.code = code;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

/** companyId enjekte eden istemci üretir. */
export function makeReportsApi(companyId) {
  const cid = companyId == null ? 1 : companyId;
  const q = (extra) => ({ companyId: String(cid), ...(extra || {}) });
  return {
    catalog: () => call('GET', '/catalog', { query: q() }),
    run: (body) => call('POST', '/run', { body: { companyId: cid, ...body } }),
    preview: (body) => call('POST', '/preview', { body: { companyId: cid, ...body } }),
    compile: (body) => call('POST', '/compile', { body: { companyId: cid, ...body } }),
    list: () => call('GET', '/definitions', { query: q() }).then((r) => r?.reports || []),
    get: (id) => call('GET', `/definitions/${id}`, { query: q() }),
    create: (def) => call('POST', '/definitions', { body: { companyId: cid, ...def } }),
    update: (id, def) => call('PUT', `/definitions/${id}`, { body: { companyId: cid, ...def } }),
    remove: (id) => call('DELETE', `/definitions/${id}`, { query: q() }),
    runs: () => call('GET', '/runs', { query: q() }).then((r) => r?.runs || []),

    // --- Zamanlanmış raporlar (P5) ---
    listSchedules: (reportId) =>
      call('GET', '/schedules', { query: q(reportId ? { reportId: String(reportId) } : {}) }).then(
        (r) => r?.schedules || [],
      ),
    createSchedule: (s) => call('POST', '/schedules', { body: { companyId: cid, ...s } }),
    updateSchedule: (id, s) => call('PUT', `/schedules/${id}`, { body: { companyId: cid, ...s } }),
    removeSchedule: (id) => call('DELETE', `/schedules/${id}`, { query: q() }),
  };
}
