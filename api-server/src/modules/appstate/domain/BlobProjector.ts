/**
 * BlobProjector — app-state blob'unu SQL aynası satırlarına projeksiyonlar.
 *
 * SAF fonksiyon: IO yok, birim testlenebilir. PUT /v1/app-state/:key sonrası
 * SetAppStateUseCase bunu çağırıp PgMirrorRepository.replaceAll'a verir.
 * Kaynak-of-truth app_state.value blob'udur; ayna yalnız Report Studio için
 * sorgulanabilir kopyadır (044_app_state_mirror.sql).
 *
 * Kurallar:
 *   'promet:data' (obje):
 *     - Kök alanlar (companyData HARİÇ) → companyId '0' (global).
 *     - companyData.{cid} altındaki her alan → companyId = String(cid).
 *       ÖNEMLİ TASARIM SAPMASI: cid blob'da istemci-üretimi STRING'dir
 *       ("comp_promet", "comp_1719912345_abc"...) — Number(cid) hepsini NaN
 *       yapıp TÜM şirket verisini düşürürdü. Bu yüzden companyId TEXT taşınır;
 *       yalnız boş/whitespace cid atlanır.
 *     - Dizi alan: eleman {id} taşıyorsa clientId=String(id), yoksa 'i'+index.
 *     - Dizi olmayan alan (obje/skaler): tek satır clientId='_'; skaler değer
 *       {value: x} sarılır (data kolonu JSONB obje kalsın).
 *   'promet:users' (dizi): domain='users', companyId='0',
 *     clientId = username ?? id ?? 'i'+index.
 *   Diğer anahtarlar: ayna yok (boş sonuç).
 *
 * Guard: tek (companyId, domain) grubunda > MAX_ROWS_PER_DOMAIN eleman varsa o
 * domain atlanır (runaway koruması) ve onDomainSkipped ile işaretlenir;
 * grubu kaydetmeyiz ki mevcut ayna satırları yanlışlıkla budanmasın.
 *
 * GÜVENLİK: app_state_entities Report Studio'ya açıktır. Projeksiyon her
 * satırın data'sındaki ÜST-DÜZEY hassas anahtarları (password, secret, token,
 * apiKey, smtpPass...) SİLER — 'promet:users' password'u ve hrEmailSettings /
 * tcmb gibi ayar objelerindeki sırlar aynaya asla yazılmaz.
 *
 * groups: replaceAll'un budama (prune) birimi. Boş dizi alanlar da grup olarak
 * kaydedilir ki "son eleman silindi" durumunda ayna doğru boşalsın.
 */

export interface MirrorRow {
  /** Blob companyData anahtarı ("comp_promet"...); kök/global alanlar için '0'. */
  companyId: string;
  /** Blob alan adı ('hrEmployees', 'accJournalEntries', 'companies'...). */
  domain: string;
  /** Eleman id'si; dizi-olmayan alanlar için '_'. */
  clientId: string;
  data: unknown;
}

export interface MirrorGroup {
  companyId: string;
  domain: string;
}

export interface ProjectBlobOptions {
  /** Runaway guard'a takılan domain'ler için çağrılır (loglama). */
  onDomainSkipped?: (info: MirrorGroup & { itemCount: number }) => void;
}

export interface BlobProjection {
  rows: MirrorRow[];
  /** Budama birimi: boş dizi alanlar dahil, atlanan (guard) domain'ler hariç. */
  groups: MirrorGroup[];
}

/** Kök/global alanların company anahtarı. */
export const GLOBAL_COMPANY_ID = '0';

/** Tek (companyId, domain) grubundaki azami eleman sayısı (runaway guard). */
export const MAX_ROWS_PER_DOMAIN = 50_000;

const DATA_KEY = 'promet:data';
const USERS_KEY = 'promet:users';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Üst-düzey hassas anahtar tespiti. 'pass' son-eki smtpPass gibi alanları
 * yakalar; kalanlar substring eşleşmesidir (apiKey, accessToken, clientSecret,
 * password...).
 */
const SENSITIVE_KEY_RE = /(password|passwd|secret|api_?key|token)/i;

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_RE.test(key) || /pass$/i.test(key);
}

/** Objenin üst-düzey hassas anahtarlarını silerek kopyalar (yoksa aynen döner). */
function redactShallow(item: Record<string, unknown>): Record<string, unknown> {
  let copy: Record<string, unknown> | null = null;
  for (const key of Object.keys(item)) {
    if (isSensitiveKey(key)) {
      copy = copy ?? { ...item };
      delete copy[key];
    }
  }
  return copy ?? item;
}

/** Satır data'sı: obje ise redakte kopya, değilse {value: x} sarmalı. */
function toRowData(value: unknown): unknown {
  return isPlainObject(value) ? redactShallow(value) : { value: value ?? null };
}

function clientIdOfItem(item: unknown, index: number): string {
  if (isPlainObject(item)) {
    const id = item['id'];
    if (typeof id === 'number' && Number.isFinite(id)) return String(id);
    if (typeof id === 'string' && id.trim() !== '') return String(id);
  }
  return 'i' + index;
}

/** Tek alanı (dizi / obje / skaler) satırlara açar; grubu kaydeder. */
function projectField(
  out: BlobProjection,
  companyId: string,
  domain: string,
  value: unknown,
  opts?: ProjectBlobOptions,
): void {
  if (value === undefined) return;

  if (Array.isArray(value)) {
    if (value.length > MAX_ROWS_PER_DOMAIN) {
      opts?.onDomainSkipped?.({ companyId, domain, itemCount: value.length });
      return; // grup da kaydedilmez → mevcut ayna satırları budanmaz
    }
    out.groups.push({ companyId, domain });
    value.forEach((item, index) => {
      out.rows.push({
        companyId,
        domain,
        clientId: clientIdOfItem(item, index),
        data: toRowData(item),
      });
    });
    return;
  }

  // Dizi olmayan (obje / skaler / null) → tek '_' satırı.
  out.groups.push({ companyId, domain });
  out.rows.push({ companyId, domain, clientId: '_', data: toRowData(value) });
}

function clientIdOfUser(item: unknown, index: number): string {
  if (isPlainObject(item)) {
    const username = item['username'];
    if (typeof username === 'string' && username.trim() !== '') return username;
    if (typeof username === 'number' && Number.isFinite(username)) return String(username);
    const id = item['id'];
    if (typeof id === 'string' && id.trim() !== '') return String(id);
    if (typeof id === 'number' && Number.isFinite(id)) return String(id);
  }
  return 'i' + index;
}

/** Projeksiyon + budama grupları. SetAppStateUseCase bunu kullanır. */
export function projectBlobWithGroups(
  key: string,
  value: unknown,
  opts?: ProjectBlobOptions,
): BlobProjection {
  const out: BlobProjection = { rows: [], groups: [] };

  if (key === USERS_KEY) {
    if (!Array.isArray(value)) return out;
    if (value.length > MAX_ROWS_PER_DOMAIN) {
      opts?.onDomainSkipped?.({
        companyId: GLOBAL_COMPANY_ID,
        domain: 'users',
        itemCount: value.length,
      });
      return out;
    }
    out.groups.push({ companyId: GLOBAL_COMPANY_ID, domain: 'users' });
    value.forEach((item, index) => {
      out.rows.push({
        companyId: GLOBAL_COMPANY_ID,
        domain: 'users',
        clientId: clientIdOfUser(item, index),
        data: toRowData(item),
      });
    });
    return out;
  }

  if (key !== DATA_KEY || !isPlainObject(value)) return out;

  // Kök/global alanlar (companyData hariç).
  for (const [field, fieldValue] of Object.entries(value)) {
    if (field === 'companyData') continue;
    projectField(out, GLOBAL_COMPANY_ID, field, fieldValue, opts);
  }

  // Şirket bazlı alanlar.
  const companyData = value['companyData'];
  if (isPlainObject(companyData)) {
    for (const [cid, companyValue] of Object.entries(companyData)) {
      const companyId = String(cid).trim();
      if (companyId === '') continue; // boş anahtar → atla
      if (!isPlainObject(companyValue)) continue; // şirket verisi obje değilse atla
      for (const [field, fieldValue] of Object.entries(companyValue)) {
        projectField(out, companyId, field, fieldValue, opts);
      }
    }
  }

  return out;
}

/**
 * Yalnız satırlar (görev tanımındaki dar imza). Budama gruplarına ihtiyaç
 * duyan çağıranlar projectBlobWithGroups kullanmalı.
 */
export function projectBlob(key: string, value: unknown, opts?: ProjectBlobOptions): MirrorRow[] {
  return projectBlobWithGroups(key, value, opts).rows;
}
