/**
 * ParamBinder — rapor parametrelerini güvenli biçimde bağlar.
 *
 * Kullanıcı SQL'i adlandırılmış parametre (`:ad`) kullanır. Burada her `:ad`
 * sıralı `$n` ile değiştirilir ve değer dizisi üretilir — değerler ASLA SQL'e
 * string olarak gömülmez, pg sürücüsüne $n binding ile geçer.
 *
 * Görsel mod derleyicisi (P2) zaten `$n` üretir; orada bu binder kullanılmaz.
 *
 * `:ad` taraması SqlGuard.sanitizeForScan üzerinden yapılır: string literal,
 * comment ve dollar-quote içindeki `:ad` görmezden gelinir; `::cast`, array
 * slice (`a[1:2]`) yanlış pozitif vermez.
 */
import { InvalidParamError, MissingParamError } from '../errors/ReportingErrors.js';
import { sanitizeForScan } from '../sql/SqlGuard.js';

export type ParamType = 'date' | 'number' | 'text' | 'select';

export interface SelectOption {
  value: string;
  label?: string;
}

export interface ParamDef {
  name: string;
  type: ParamType;
  label?: string;
  required?: boolean;
  /** Sabit varsayılan veya makro: @today @monthStart @monthEnd @yearStart @yearEnd */
  default?: string | number | null;
  /** type === 'select' için izinli değerler (string veya {value,label}). */
  options?: ReadonlyArray<string | SelectOption>;
}

export interface BindResult {
  sql: string;
  values: unknown[];
  /** $n sırasına göre kullanılan parametre adları. */
  usedNames: string[];
}

// `:ad` — öncesinde `:`/kelime/`]` YOK, sonrasında `:` YOK (cast/slice hariç).
const NAMED_PARAM_RE = /(?<![:\w\]]):(?!:)([a-zA-Z_]\w*)/g;

/**
 * `:ad` placeholder'larını `$n`'e çevirir, değer dizisini tip dönüşümüyle
 * üretir. Bilinmeyen/eksik/uygunsuz parametrede ilgili ReportingError fırlatır.
 */
export function bindNamedParams(
  sql: string,
  paramDefs: ReadonlyArray<ParamDef>,
  providedValues: Readonly<Record<string, unknown>> = {},
): BindResult {
  const defByName = new Map(paramDefs.map((d) => [d.name, d]));
  const masked = sanitizeForScan(sql);

  const order: string[] = [];
  const nameToIdx = new Map<string, number>();
  const matches: Array<{ start: number; end: number; name: string }> = [];

  for (const m of masked.matchAll(NAMED_PARAM_RE)) {
    const name = m[1]!;
    matches.push({ start: m.index, end: m.index + m[0].length, name });
    if (!nameToIdx.has(name)) {
      order.push(name);
      nameToIdx.set(name, order.length); // 1-tabanlı $n
    }
  }

  // Orijinal SQL'i, masked ile aynı offset'lerde, soldan sağa yeniden kur.
  let outSql = '';
  let cursor = 0;
  for (const mt of matches) {
    outSql += sql.slice(cursor, mt.start) + '$' + String(nameToIdx.get(mt.name));
    cursor = mt.end;
  }
  outSql += sql.slice(cursor);

  const values = order.map((name) => {
    const def = defByName.get(name);
    if (def === undefined) {
      throw new InvalidParamError(name, 'SQL içinde kullanıldı ama parametre olarak tanımlanmadı');
    }
    return coerceParamValue(def, providedValues[name]);
  });

  return { sql: outSql, values, usedNames: order };
}

/** Değeri tipe göre dönüştürür; eksik/uygunsuzsa hata fırlatır. (compiler de kullanır) */
export function coerceParamValue(def: ParamDef, provided: unknown): unknown {
  let raw = provided;
  if (raw === undefined || raw === null || raw === '') {
    raw = resolveDefault(def.default);
  }
  if (raw === undefined || raw === null || raw === '') {
    if (def.required) throw new MissingParamError(def.name);
    return null;
  }
  if (typeof raw === 'object' || typeof raw === 'function') {
    throw new InvalidParamError(def.name, 'skaler (metin/sayı/tarih) değer bekleniyordu');
  }
  // Buraya ulaşıldığında raw skaler bir değer (string | number | boolean) —
  // güvenli stringify için daralt (no-base-to-string).
  const val = raw as string | number | boolean;

  switch (def.type) {
    case 'number': {
      const num = typeof val === 'number' ? val : Number(String(val).trim());
      if (!Number.isFinite(num)) {
        throw new InvalidParamError(def.name, `sayı bekleniyordu, alındı: ${String(val)}`);
      }
      return num;
    }
    case 'date': {
      const s = String(val).trim();
      // YYYY-MM-DD veya tam ISO; pg date/timestamp olarak kabul eder.
      if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/.test(s)) {
        throw new InvalidParamError(def.name, `tarih (YYYY-MM-DD) bekleniyordu, alındı: ${s}`);
      }
      return s;
    }
    case 'select': {
      const s = String(val);
      const allowed = (def.options ?? []).map((o) => (typeof o === 'string' ? o : o.value));
      if (!allowed.includes(s)) {
        throw new InvalidParamError(def.name, `izinli değerlerden biri değil: ${s}`);
      }
      return s;
    }
    case 'text':
    default:
      return String(val);
  }
}

/** @today / @monthStart gibi makroları çözer; değilse değeri aynen döner. */
function resolveDefault(def: ParamDef['default']): ParamDef['default'] {
  if (typeof def !== 'string' || !def.startsWith('@')) return def;
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth();
  const iso = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  switch (def) {
    case '@today':
      return iso(now);
    case '@monthStart':
      return iso(new Date(y, mo, 1));
    case '@monthEnd':
      return iso(new Date(y, mo + 1, 0));
    case '@yearStart':
      return `${y}-01-01`;
    case '@yearEnd':
      return `${y}-12-31`;
    default:
      return def;
  }
}
