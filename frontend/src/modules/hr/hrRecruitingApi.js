/**
 * HR İşe Alım (Position + Candidate + Application) backend API istemcisi — /v1/hr.
 * hrOrgApi.js kalıbını izler.
 *
 * Sunucu sayısal id kullanır; frontend string id ile çalışır. Bu istemci sınırda çevirir:
 *   - OKUMA: tüm `id` ve `*Id` alanları String'e çevrilir.
 *   - YAZMA: gövdeler elle kurulur (rawBody); sayısal olmayan id'ler ("pos_x") null'a düşer.
 *
 * KABA/İNCE alan ayrımı (App.jsx İşe Alım cutover'ı ile sözleşme):
 *   Sunucu enum'ları FE'nin ince değerlerinden daha kaba olduğu için sunucu-sahipli
 *   alanlar OKUMADA yeniden adlandırılır; ince FE değeri blob-önbellek extras'ında yaşar:
 *   - Position.status  → srvStatus  (draft|open|closed;   FE: open|on_hold|filled|closed)
 *   - Candidate.source → srvSource  (referral|linkedin|jobboard|direct|agency|other; FE 10 kanal)
 *   - Application.stage → srvStage  (new|screening|interview|offer|hired|rejected|withdrawn;
 *                                    FE kanban 8 ince aşama — RECRUITMENT_STAGES)
 *
 * Endpoint imzaları api-server/src/modules/hr/presentation/routes.ts'ten doğrulandı:
 *   GET   /positions?companyId=              → { positions: [...] }
 *   POST  /positions                         → { companyId, departmentId(null olabilir), title,
 *                                                description?, status?, headcountTarget?, minSalary?, maxSalary? }
 *   PATCH /positions/:id                     → { companyId, ...kısmi alanlar }
 *   POST  /positions/:id/close               → { companyId }
 *   GET   /candidates?companyId=             → { candidates: [...] }
 *   POST  /candidates                        → { companyId, firstName, lastName, email?, phone?, source?, cvUrl?, notes? }
 *   PATCH /candidates/:id                    → { companyId, ...kısmi alanlar }
 *   DELETE /candidates/:id?companyId=        → aktif başvurusu varsa 409
 *   GET   /applications?companyId=&positionId=  → { applications: [...] } (positionId/candidateId ŞART; yoksa [])
 *   POST  /applications                      → { companyId, candidateId, positionId, salaryExpectation?, notes? }
 *   POST  /applications/:id/move-stage       → { companyId, newStage, rejectionReason? }
 *                                              (durum makinesi katı: new→screening→interview→offer→hired,
 *                                               her aktif aşamadan rejected/withdrawn; geri/atlamalı geçiş YASAK)
 *   POST  /applications/:id/reject           → { companyId, reason }
 *   POST  /applications/:id/withdraw         → { companyId, note? }
 *   POST  /recruiting/adopt-blob             → { companyId, positions, candidates, applications } → { adopted, idMap }
 *                                              (BE ajanı ekliyor; 404 → null, sonraki yüklemede tekrar denenir)
 *
 * JWT: localStorage `promet_access_token`. companyId: makeHrRecruitingApi(companyId) ile sabitlenir.
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

// Sayısal FK: "12"/12 → 12; "pos_x"/"" → null
const numId = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const strOrNull = (s) => {
  const v = typeof s === 'string' ? s.trim() : s;
  return v ? String(v) : null;
};

// Nonneg sayı ya da null (zod: number().nonnegative().nullable())
const numOrNull = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
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

// Sunucu-sahipli kaba alanları yeniden adlandır — ince FE alanı extras'ta yaşasın diye.
function posToClient(p) {
  if (!p || typeof p !== 'object') return p;
  const { status, ...rest } = p;
  return { ...rest, ...(status !== undefined ? { srvStatus: status } : {}) };
}
function candToClient(c) {
  if (!c || typeof c !== 'object') return c;
  const { source, ...rest } = c;
  return { ...rest, ...(source !== undefined ? { srvSource: source } : {}) };
}
function appToClient(a) {
  if (!a || typeof a !== 'object') return a;
  const { stage, ...rest } = a;
  return { ...rest, ...(stage !== undefined ? { srvStage: stage } : {}) };
}

/**
 * companyId enjekte eden bir istemci üretir.
 * Liste yanıtları sunucuda { positions: [...] } / { candidates: [...] } / { applications: [...] } sarılı gelir.
 */
export function makeHrRecruitingApi(companyId) {
  const cid = companyId == null ? 1 : companyId;
  const q = (extra) => ({ companyId: String(cid), ...(extra || {}) });

  return {
    // --- Pozisyonlar ---
    listPositions: () =>
      call('GET', '/positions', { query: q() }).then((r) =>
        (Array.isArray(r) ? r : r?.positions || []).map(posToClient),
      ),
    createPosition: ({
      departmentId,
      title,
      description,
      status,
      headcountTarget,
      minSalary,
      maxSalary,
    } = {}) =>
      call('POST', '/positions', {
        rawBody: {
          companyId: cid,
          departmentId: numId(departmentId),
          title: String(title || '').trim(),
          description: strOrNull(description),
          ...(status ? { status } : {}),
          ...(Number.isInteger(headcountTarget) && headcountTarget >= 0 ? { headcountTarget } : {}),
          minSalary: numOrNull(minSalary),
          maxSalary: numOrNull(maxSalary),
        },
      }).then(posToClient),
    updatePosition: (
      id,
      { title, description, headcountTarget, minSalary, maxSalary, departmentId, status } = {},
    ) =>
      call('PATCH', `/positions/${id}`, {
        rawBody: {
          companyId: cid,
          ...(title !== undefined ? { title: String(title || '').trim() } : {}),
          ...(description !== undefined ? { description: strOrNull(description) } : {}),
          ...(headcountTarget !== undefined
            ? { headcountTarget: Math.max(0, Number(headcountTarget) || 0) }
            : {}),
          ...(minSalary !== undefined ? { minSalary: numOrNull(minSalary) } : {}),
          ...(maxSalary !== undefined ? { maxSalary: numOrNull(maxSalary) } : {}),
          ...(departmentId !== undefined ? { departmentId: numId(departmentId) } : {}),
          ...(status ? { status } : {}),
        },
      }).then(posToClient),
    closePosition: (id) =>
      call('POST', `/positions/${id}/close`, { rawBody: { companyId: cid } }).then(posToClient),

    // --- Adaylar ---
    listCandidates: () =>
      call('GET', '/candidates', { query: q() }).then((r) =>
        (Array.isArray(r) ? r : r?.candidates || []).map(candToClient),
      ),
    createCandidate: ({ firstName, lastName, email, phone, source, cvUrl, notes } = {}) =>
      call('POST', '/candidates', {
        rawBody: {
          companyId: cid,
          firstName: String(firstName || '').trim(),
          lastName: String(lastName || '').trim(),
          email: strOrNull(email),
          phone: strOrNull(phone),
          ...(source ? { source } : {}),
          cvUrl: strOrNull(cvUrl),
          notes: strOrNull(notes),
        },
      }).then(candToClient),
    updateCandidate: (id, { firstName, lastName, email, phone, source, cvUrl, notes } = {}) =>
      call('PATCH', `/candidates/${id}`, {
        rawBody: {
          companyId: cid,
          ...(firstName !== undefined ? { firstName: String(firstName || '').trim() } : {}),
          ...(lastName !== undefined ? { lastName: String(lastName || '').trim() } : {}),
          ...(email !== undefined ? { email: strOrNull(email) } : {}),
          ...(phone !== undefined ? { phone: strOrNull(phone) } : {}),
          ...(source ? { source } : {}),
          ...(cvUrl !== undefined ? { cvUrl: strOrNull(cvUrl) } : {}),
          ...(notes !== undefined ? { notes: strOrNull(notes) } : {}),
        },
      }).then(candToClient),
    deleteCandidate: (id) => call('DELETE', `/candidates/${id}`, { query: q() }),

    // --- Başvurular ---
    // GET /applications positionId veya candidateId İSTER; tüm şirket listesi için
    // pozisyon başına sorgulanıp düzleştirilir (sayısal olmayan id'ler atlanır).
    listApplicationsForPosition: (positionId) =>
      call('GET', '/applications', {
        query: q({ positionId: String(numId(positionId) ?? '') }),
      }).then((r) => (Array.isArray(r) ? r : r?.applications || []).map(appToClient)),
    listApplications: async (positionIds = []) => {
      const ids = [...new Set(positionIds.map(numId).filter((n) => n != null))];
      const lists = await Promise.all(
        ids.map((pid) =>
          call('GET', '/applications', { query: q({ positionId: String(pid) }) }).then((r) =>
            Array.isArray(r) ? r : r?.applications || [],
          ),
        ),
      );
      return lists.flat().map(appToClient);
    },
    createApplication: ({ candidateId, positionId, salaryExpectation, notes } = {}) =>
      call('POST', '/applications', {
        rawBody: {
          companyId: cid,
          candidateId: numId(candidateId),
          positionId: numId(positionId),
          salaryExpectation: numOrNull(salaryExpectation),
          notes: strOrNull(notes),
        },
      }).then(appToClient),
    moveApplicationStage: (id, newStage, rejectionReason) =>
      call('POST', `/applications/${id}/move-stage`, {
        rawBody: {
          companyId: cid,
          newStage,
          ...(rejectionReason !== undefined ? { rejectionReason: strOrNull(rejectionReason) } : {}),
        },
      }).then(appToClient),
    rejectApplication: (id, reason) =>
      call('POST', `/applications/${id}/reject`, {
        rawBody: { companyId: cid, reason: String(reason || '').trim() || '-' },
      }).then(appToClient),
    withdrawApplication: (id, note) =>
      call('POST', `/applications/${id}/withdraw`, {
        rawBody: { companyId: cid, ...(note ? { note: String(note) } : {}) },
      }).then(appToClient),

    // --- Tek seferlik blob devralma (idempotent upsert) ---
    // Blob verisi OLDUĞU GİBİ gönderilir (string id'ler ve ince aşamalar bozulmasın diye
    // dönüşümden geçmez; eşleme sunucu tarafında yapılır).
    // Sözleşme: body {companyId, positions?, candidates?, applications?} → {adopted, idMap}.
    // Endpoint henüz deploy edilmediyse (404) sessizce null döner; sonraki yüklemede tekrar denenir.
    adoptBlobRecruiting: async ({ positions, candidates, applications } = {}) => {
      try {
        const res = await globalThis.fetch(`${BASE}/recruiting/adopt-blob`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
          },
          body: JSON.stringify({
            companyId: cid,
            ...(positions?.length ? { positions } : {}),
            ...(candidates?.length ? { candidates } : {}),
            ...(applications?.length ? { applications } : {}),
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
