/**
 * Ortak kolon biçimlendirme — ResultPanel (ekran) ve buildReportHtml (PDF)
 * aynı kuralları kullanır (tutarlı çıktı).
 *
 * DÖVİZ: rapor verisi api-server'da TL bazında saklanır. Üst bardaki döviz cinsi
 * TRY dışıysa `money` kolonları `money.rate` ile bölünüp hedef para biriminde
 * gösterilir (istek md. 3). `money` parametresi verilmezse davranış TRY'dir.
 */
const FORMATTERS = new Map();

/** Para birimi için Intl biçimleyici (önbellekli). */
function moneyFormatter(currency) {
  const cur = currency === 'USD' || currency === 'EUR' ? currency : 'TRY';
  let f = FORMATTERS.get(cur);
  if (!f) {
    f = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: cur });
    FORMATTERS.set(cur, f);
  }
  return f;
}

/** Etkin biçim: 'auto' ise kolon tipini kullan. */
export function effFormat(fmt, type) {
  return !fmt || fmt === 'auto' ? type : fmt;
}

/**
 * @param {unknown} v ham hücre değeri
 * @param {string} fmt kolon biçimi ('auto' | 'money' | 'number' | ...)
 * @param {string} type kolon tipi
 * @param {{ currency?: string, rate?: number }} [money] gösterim para birimi ve 1 birim = kaç TL kuru
 */
export function formatValue(v, fmt, type, money) {
  if (v === null || v === undefined || v === '') return '';
  const eff = effFormat(fmt, type);
  switch (eff) {
    case 'money': {
      if (!Number.isFinite(Number(v))) return String(v);
      const currency = money?.currency || 'TRY';
      const rate = Number(money?.rate) || 0;
      // TL bazlı değeri hedef para birimine çevir (TRY ise çevrim yok).
      const value = currency === 'TRY' || rate <= 0 ? Number(v) : Number(v) / rate;
      return moneyFormatter(currency).format(value);
    }
    case 'number':
      return Number.isFinite(Number(v)) ? Number(v).toLocaleString('tr-TR') : String(v);
    case 'percent':
      return Number.isFinite(Number(v))
        ? Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + '%'
        : String(v);
    case 'date':
    case 'timestamp': {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('tr-TR');
    }
    default:
      return String(v);
  }
}

/** Sayısal/para/yüzde → sağa hizalı. */
export function isRight(fmt, type) {
  const eff = effFormat(fmt, type);
  return eff === 'number' || eff === 'money' || eff === 'percent';
}
