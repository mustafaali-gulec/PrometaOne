/**
 * Görev Eki backend API istemcisi — /v1/task-attachments.
 *
 * Ek içeriği backend'de BYTEA saklanır (app-state blob'una GÖMÜLMEZ — kota/şişme
 * koruması). Yükleme base64 JSON ile; indirme JWT'li fetch → blob → tarayıcı
 * indirmesi. Ekler görev id'si (task_..., soft ref) + companyId ile scope'lanır.
 *
 * JWT: localStorage `promet_access_token` (login'de set edilir).
 * companyId: çağrıda verilir (yazmada body, okumada query).
 */

const BASE = '/v1/task-attachments';

const token = () => {
  try {
    return globalThis.localStorage?.getItem('promet_access_token') || '';
  } catch {
    return '';
  }
};

const authHeaders = (extra) => {
  const h = { ...(extra || {}) };
  const t = token();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
};

async function parseError(res) {
  let msg = `HTTP ${res.status}`;
  try {
    const j = await res.json();
    if (j && (j.message || j.error)) msg = j.message || j.error;
  } catch {
    /* gövde JSON değil */
  }
  return new Error(msg);
}

/** File nesnesini base64 string'e çevirir (data: öneki olmadan). */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new globalThis.FileReader();
    reader.onerror = () => reject(reader.error || new Error('Dosya okunamadı'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Görev eki istemcisi. `companyId` sayısal backend şirket id'sidir
 * (frontend'te einvBackendCompanyId ile türetilir).
 */
export function makeTaskAttachmentsApi(companyId) {
  const cid = Number(companyId) || 1;

  return {
    /** Bir görevin eklerini listeler (metadata). */
    async list(taskRef) {
      const q = new globalThis.URLSearchParams({
        companyId: String(cid),
        taskRef: String(taskRef),
      });
      const res = await globalThis.fetch(`${BASE}?${q.toString()}`, { headers: authHeaders() });
      if (!res.ok) throw await parseError(res);
      const j = await res.json();
      return j.attachments || [];
    },

    /** Ek yükler (base64 JSON). meta döner. */
    async upload({ taskRef, file, note }) {
      const contentBase64 = await fileToBase64(file);
      const res = await globalThis.fetch(BASE, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          companyId: cid,
          taskRef: String(taskRef),
          fileName: file.name,
          mimeType: file.type || null,
          note: note || null,
          contentBase64,
        }),
      });
      if (!res.ok) throw await parseError(res);
      return res.json();
    },

    /** Eki JWT'li indirir ve tarayıcı indirmesini tetikler. */
    async download(id, fileName) {
      const res = await globalThis.fetch(`${BASE}/${id}/download?companyId=${cid}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw await parseError(res);
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = globalThis.document.createElement('a');
      a.href = url;
      a.download = fileName || `ek-${id}`;
      globalThis.document.body.appendChild(a);
      a.click();
      a.remove();
      globalThis.URL.revokeObjectURL(url);
    },

    /** Eki siler. */
    async remove(id) {
      const res = await globalThis.fetch(`${BASE}/${id}?companyId=${cid}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw await parseError(res);
      return true;
    },
  };
}
