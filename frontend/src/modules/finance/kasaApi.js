/**
 * Kasa (nakit hesap + hareket) backend API istemcisi — /v1/finance.
 * hrRecruitingApi.js kalıbını izler.
 *
 * Sunucu sayısal id kullanır; frontend string id ile çalışır. Bu istemci sınırda çevirir:
 *   - OKUMA: tüm `id` ve `*Id` alanları String'e, amount/openingBalance (decimal string)
 *     Number'a çevrilir.
 *   - YAZMA: gövdeler elle kurulur (rawBody); sayısal olmayan id'ler ("ksa_x") null'a düşer.
 *
 * SUNUCU-SAHİPLİ / BLOB-SAHİPLİ alan ayrımı (App.jsx Kasa cutover'ı ile sözleşme):
 *   Sunucu entry alanlarından ikisi blob-domain'e aittir ve OKUMADA yeniden adlandırılır
 *   ki blob-önbellekteki FE değerleri (extras) ezilmesin:
 *   - KasaEntry.cashflowCatId    → srvCashflowCatId  (blob'da inflows/outflows string id'leri)
 *   - KasaEntry.committedToCells → srvCommittedToCells (nakit akış gömme bayrağını
 *                                   CashFlowGrid blob'da yönetir — dış yazar, dokunulmaz)
 *
 * Endpoint imzaları api-server/src/modules/finance/presentation/routes.ts'ten doğrulandı:
 *   GET    /kasa-accounts?companyId=       → { accounts: [...] }  (yalnız aktifler)
 *   POST   /kasa-accounts                  → { companyId, name, currency, openingBalance? }
 *   PATCH  /kasa-accounts/:id              → { companyId, ...kısmi } (BE ekliyor; 404/405 → zarif düş)
 *   DELETE /kasa-accounts/:id?companyId=   → arşivle (active=false)
 *   GET    /kasa-entries?companyId=        → { entries: [...] } (BE ekliyor; 404 → önbellek görünümü)
 *   POST   /kasa-entries                   → { companyId, kasaAccountId, date, type, amount,
 *                                              description?, category?, cashflowCatId? }
 *   PATCH  /kasa-entries/:id               → { companyId, ...kısmi } (BE ekliyor)
 *   DELETE /kasa-entries/:id?companyId=    → (BE ekliyor)
 *   POST   /kasa-entries/:id/commit        → { companyId } → { ok } (commit-to-cells durum işareti;
 *                                             FE fişleme akışıyla İLGİSİZ — çağrılmaz, bkz. cutover notu)
 *   POST   /kasa/adopt-blob                → { companyId, accounts, entries } → { adopted, idMap }
 *                                            (BE ekliyor; 404 → null, sonraki yüklemede tekrar denenir)
 *
 * JWT: localStorage `promet_access_token`. companyId: makeKasaApi(companyId) ile sabitlenir.
 */

const BASE = '/v1/finance';

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

// Sayısal FK: "12"/12 → 12; "ksa_x"/"" → null
const numId = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const strOrNull = (s) => {
  const v = typeof s === 'string' ? s.trim() : s;
  return v ? String(v) : null;
};

// Sunucu Money alanları decimal STRING döner ("1234.50") — blob paritesi için Number.
const numAmount = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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

// Blob-domain sunucu alanlarını yeniden adlandır — FE değeri extras'ta yaşasın diye.
function accToClient(a) {
  if (!a || typeof a !== 'object') return a;
  return {
    ...a,
    ...(a.openingBalance !== undefined ? { openingBalance: numAmount(a.openingBalance) } : {}),
  };
}
function entryToClient(e) {
  if (!e || typeof e !== 'object') return e;
  const { cashflowCatId, committedToCells, ...rest } = e;
  return {
    ...rest,
    ...(rest.amount !== undefined ? { amount: numAmount(rest.amount) } : {}),
    ...(cashflowCatId !== undefined ? { srvCashflowCatId: cashflowCatId } : {}),
    ...(committedToCells !== undefined ? { srvCommittedToCells: committedToCells } : {}),
  };
}

/**
 * companyId enjekte eden bir istemci üretir.
 * Liste yanıtları sunucuda { accounts: [...] } / { entries: [...] } sarılı gelir.
 */
export function makeKasaApi(companyId) {
  const cid = companyId == null ? 1 : companyId;
  const q = (extra) => ({ companyId: String(cid), ...(extra || {}) });

  return {
    // --- Kasa hesapları ---
    listAccounts: () =>
      call('GET', '/kasa-accounts', { query: q() }).then((r) =>
        (Array.isArray(r) ? r : r?.accounts || []).map(accToClient),
      ),
    createAccount: ({ name, currency, openingBalance } = {}) =>
      call('POST', '/kasa-accounts', {
        rawBody: {
          companyId: cid,
          name: String(name || '').trim(),
          currency: currency || 'TRY',
          openingBalance: Number(openingBalance) || 0,
        },
      }).then(accToClient),
    // BE ekliyor — uç henüz yoksa 404/405 fırlar; çağıran zarif düşer.
    updateAccount: (id, { name, currency, openingBalance } = {}) =>
      call('PATCH', `/kasa-accounts/${id}`, {
        rawBody: {
          companyId: cid,
          ...(name !== undefined ? { name: String(name || '').trim() } : {}),
          ...(currency !== undefined ? { currency } : {}),
          ...(openingBalance !== undefined ? { openingBalance: Number(openingBalance) || 0 } : {}),
        },
      }).then(accToClient),
    archiveAccount: (id) =>
      call('DELETE', `/kasa-accounts/${id}`, { query: q() }).then(accToClient),

    // --- Kasa hareketleri ---
    // BE ekliyor — uç henüz yoksa 404 fırlar; çağıran önbellek görünümüne düşer.
    listEntries: () =>
      call('GET', '/kasa-entries', { query: q() }).then((r) =>
        (Array.isArray(r) ? r : r?.entries || []).map(entryToClient),
      ),
    createEntry: ({ kasaAccountId, date, type, amount, description, category } = {}) =>
      call('POST', '/kasa-entries', {
        rawBody: {
          companyId: cid,
          kasaAccountId: numId(kasaAccountId),
          date: String(date || '').slice(0, 10),
          type: type === 'out' ? 'out' : 'in',
          amount: Number(amount) || 0,
          description: strOrNull(description),
          category: strOrNull(category),
        },
      }).then(entryToClient),
    // BE ekliyor — uç henüz yoksa 404/405 fırlar.
    updateEntry: (id, { kasaAccountId, date, type, amount, description, category } = {}) =>
      call('PATCH', `/kasa-entries/${id}`, {
        rawBody: {
          companyId: cid,
          ...(kasaAccountId !== undefined ? { kasaAccountId: numId(kasaAccountId) } : {}),
          ...(date !== undefined ? { date: String(date || '').slice(0, 10) } : {}),
          ...(type !== undefined ? { type: type === 'out' ? 'out' : 'in' } : {}),
          ...(amount !== undefined ? { amount: Number(amount) || 0 } : {}),
          ...(description !== undefined ? { description: strOrNull(description) } : {}),
          ...(category !== undefined ? { category: strOrNull(category) } : {}),
        },
      }).then(entryToClient),
    // BE ekliyor — uç henüz yoksa 404/405 fırlar.
    deleteEntry: (id) => call('DELETE', `/kasa-entries/${id}`, { query: q() }),
    // Commit-to-cells durum işareti (nakit akış gömme). FE fişleme (yevmiye) akışı
    // BLOB accJournalEntries üretir ve bu uçla İLGİSİZDİR — cutover bilinçli çağırmaz.
    commitEntry: (id) =>
      call('POST', `/kasa-entries/${id}/commit`, { rawBody: { companyId: cid } }),

    // --- Tek seferlik blob devralma (idempotent upsert) ---
    // Blob verisi OLDUĞU GİBİ gönderilir (string id'ler bozulmasın; eşleme sunucuda).
    // Sözleşme: body {companyId, accounts?, entries?} → {adopted, idMap}.
    // Endpoint henüz deploy edilmediyse (404) sessizce null döner; sonraki yüklemede tekrar denenir.
    adoptBlobKasa: async ({ accounts, entries } = {}) => {
      try {
        const res = await globalThis.fetch(`${BASE}/kasa/adopt-blob`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
          },
          body: JSON.stringify({
            companyId: cid,
            ...(accounts?.length ? { accounts } : {}),
            ...(entries?.length ? { entries } : {}),
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
