/**
 * Ortak kolon biçimlendirme — ResultPanel (ekran) ve buildReportHtml (PDF)
 * aynı kuralları kullanır (tutarlı çıktı).
 */
const TRY = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });

/** Etkin biçim: 'auto' ise kolon tipini kullan. */
export function effFormat(fmt, type) {
  return !fmt || fmt === 'auto' ? type : fmt;
}

export function formatValue(v, fmt, type) {
  if (v === null || v === undefined || v === '') return '';
  const eff = effFormat(fmt, type);
  switch (eff) {
    case 'money':
      return Number.isFinite(Number(v)) ? TRY.format(Number(v)) : String(v);
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
