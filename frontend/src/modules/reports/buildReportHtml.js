/**
 * buildReportHtml — rapor sonucundan yazdırılabilir banded HTML üretir.
 *
 * Bantlar: sayfa başlığı (şirket + başlık + tarih/hazırlayan) → detay tablosu
 * (görünür kolonlar, viz biçimleri) → tek-seviye gruplama (opsiyonel) +
 * ara/genel toplam → altlık. Yazdırma `window.open().print()` ile (yeni
 * bağımlılık yok — MonthlyReportPDFWidget deseni). viz ile aynı kolon
 * etiket/biçim/görünürlüğü kullanır.
 */
import { formatValue, isRight } from './format.js';

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );

export function buildReportHtml({ result, viz = {}, layout = {}, lang = 'tr' }) {
  const T4 = (trS, en, de, ar) =>
    lang === 'en' ? en : lang === 'de' ? de : lang === 'ar' ? ar : trS;
  const colCfg = viz.columns || {};
  const cfgOf = (k) => colCfg[k] || {};
  const colIndex = Object.fromEntries(result.columns.map((c, i) => [c.key, i]));
  const visibleCols = result.columns.filter((c) => cfgOf(c.key).visible !== false);
  const subtotalKeys = result.columns.filter((c) => cfgOf(c.key).subtotal).map((c) => c.key);

  const paper = layout.paper || 'A4';
  const orientation = layout.orientation === 'landscape' ? 'landscape' : 'portrait';
  const m = layout.margins || { top: 18, right: 18, bottom: 18, left: 18 };
  const title = layout.title || T4('Rapor', 'Report', 'Bericht', 'تقرير');
  const company = layout.companyName || '';
  const footer = layout.footer || '';
  const groupBy = layout.groupBy && colIndex[layout.groupBy] !== undefined ? layout.groupBy : '';
  const today = new Date().toLocaleDateString(T4('tr-TR', 'en-US', 'de-DE', 'ar'));

  const rowsObj = result.rows.map((r) =>
    Object.fromEntries(result.columns.map((c, i) => [c.key, r[i]])),
  );

  const cls = (c) => (isRight(cfgOf(c.key).format, c.type) ? ' class="r"' : '');
  const th = visibleCols
    .map((c) => `<th${cls(c)}>${esc(cfgOf(c.key).label || c.key)}</th>`)
    .join('');
  const renderRow = (o) =>
    `<tr>${visibleCols.map((c) => `<td${cls(c)}>${esc(formatValue(o[c.key], cfgOf(c.key).format, c.type))}</td>`).join('')}</tr>`;

  const sumRow = (subset, label) => {
    const sums = {};
    subtotalKeys.forEach((k) => {
      sums[k] = subset.reduce((s, o) => s + (Number(o[k]) || 0), 0);
    });
    const cells = visibleCols
      .map((c, idx) => {
        if (idx === 0 && !(c.key in sums)) return `<td>${esc(label)}</td>`;
        const col = result.columns[colIndex[c.key]];
        return `<td${cls(c)}>${c.key in sums ? esc(formatValue(sums[c.key], cfgOf(c.key).format, col.type)) : ''}</td>`;
      })
      .join('');
    return `<tr class="sub">${cells}</tr>`;
  };

  let body = '';
  if (groupBy) {
    const groups = {};
    rowsObj.forEach((o) => {
      const g = String(o[groupBy] ?? '');
      (groups[g] = groups[g] || []).push(o);
    });
    for (const g of Object.keys(groups).sort()) {
      const label = cfgOf(groupBy).label || groupBy;
      body += `<tr class="grp"><td colspan="${visibleCols.length}">${esc(label)}: ${esc(g)}</td></tr>`;
      groups[g].forEach((o) => (body += renderRow(o)));
      if (subtotalKeys.length)
        body += sumRow(groups[g], T4('Ara Toplam', 'Subtotal', 'Zwischensumme', 'مجموع فرعي'));
    }
  } else {
    rowsObj.forEach((o) => (body += renderRow(o)));
  }
  if (subtotalKeys.length)
    body += sumRow(rowsObj, T4('Genel Toplam', 'Grand Total', 'Gesamtsumme', 'المجموع الكلي'));

  const meta = [
    layout.showDate !== false ? `${T4('Tarih', 'Date', 'Datum', 'التاريخ')}: ${today}` : '',
    layout.preparedBy
      ? `${T4('Hazırlayan', 'By', 'Erstellt von', 'أعدّه')}: ${esc(layout.preparedBy)}`
      : '',
  ]
    .filter(Boolean)
    .join('<br>');

  return `<!doctype html><html lang="${lang}"${lang === 'ar' ? ' dir="rtl"' : ''}><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: ${paper} ${orientation}; margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; margin: 0; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 6px; margin-bottom: 10px; }
  .company { font-size: 15px; font-weight: bold; }
  .title { font-size: 18px; font-weight: bold; }
  .meta { font-size: 10px; color: #555; text-align: right; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 3px 6px; text-align: left; }
  thead th { background: #f1f1f1; }
  td.r, th.r { text-align: right; font-variant-numeric: tabular-nums; }
  tr.grp td { background: #e8e8f8; font-weight: bold; }
  tr.sub td { background: #fafafa; font-weight: bold; border-top: 1px solid #999; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .ftr { margin-top: 12px; border-top: 1px solid #ccc; padding-top: 6px; font-size: 10px; color: #555; text-align: center; }
</style></head><body>
  <div class="hdr">
    <div>${company ? `<div class="company">${esc(company)}</div>` : ''}<div class="title">${esc(title)}</div></div>
    <div class="meta">${meta}</div>
  </div>
  <table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>
  ${footer ? `<div class="ftr">${esc(footer)}</div>` : ''}
</body></html>`;
}
