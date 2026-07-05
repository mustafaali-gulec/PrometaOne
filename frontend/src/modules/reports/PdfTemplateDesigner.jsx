/**
 * PdfTemplateDesigner — yazdırılabilir PDF banded şablon tasarımcı (P4).
 *
 * Sayfa/yön/kenar boşluğu, başlık & şirket, hazırlayan, tarih, tek-seviye
 * gruplama, altlık ayarları → canlı `<iframe>` önizleme (buildReportHtml) →
 * "Yazdır / PDF" (window.open + print). Ayarlar layout_config'te saklanır.
 */
import React, { useMemo } from 'react';

import { buildReportHtml } from './buildReportHtml.js';

export function PdfTemplateDesigner({ result, viz, layout, onLayout, lang = 'tr' }) {
  const L = layout || {};
  const m = L.margins || { top: 18, right: 18, bottom: 18, left: 18 };
  const set = (patch) => onLayout({ ...L, ...patch });
  const setMargin = (mm) => {
    const v = Number(mm) || 0;
    set({ margins: { top: v, right: v, bottom: v, left: v } });
  };

  const allKeys = result.columns.map((c) => c.key);
  const html = useMemo(
    () => buildReportHtml({ result, viz, layout: L, lang }),
    [result, viz, L, lang],
  );

  const printIt = () => {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      try {
        w.print();
      } catch {
        /* ignore */
      }
    }, 300);
  };

  const lbl = { fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 };

  return (
    <div className="card p-2 space-y-2" style={{ background: 'var(--bg-alt)' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: 'var(--ink-mute)' }}>
          {lang === 'en'
            ? 'PDF TEMPLATE'
            : lang === 'de'
              ? 'PDF-VORLAGE'
              : lang === 'ar'
                ? 'قالب PDF'
                : 'PDF BELGE ŞABLONU'}
        </span>
        <button
          className="btn"
          style={{ background: '#7c3aed', color: '#fff', fontWeight: 700 }}
          onClick={printIt}
        >
          🖨{' '}
          {lang === 'en'
            ? 'Print / PDF'
            : lang === 'de'
              ? 'Drucken / PDF'
              : lang === 'ar'
                ? 'طباعة / PDF'
                : 'Yazdır / PDF'}
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 6,
        }}
      >
        <label style={lbl}>
          <span style={{ color: 'var(--ink-mute)' }}>
            {lang === 'en' ? 'Paper' : lang === 'de' ? 'Papier' : lang === 'ar' ? 'الورق' : 'Kağıt'}
          </span>
          <select
            className="input"
            style={{ fontSize: 11 }}
            value={L.paper || 'A4'}
            onChange={(e) => set({ paper: e.target.value })}
          >
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
          </select>
        </label>
        <label style={lbl}>
          <span style={{ color: 'var(--ink-mute)' }}>
            {lang === 'en'
              ? 'Orientation'
              : lang === 'de'
                ? 'Ausrichtung'
                : lang === 'ar'
                  ? 'الاتجاه'
                  : 'Yön'}
          </span>
          <select
            className="input"
            style={{ fontSize: 11 }}
            value={L.orientation || 'portrait'}
            onChange={(e) => set({ orientation: e.target.value })}
          >
            <option value="portrait">
              {lang === 'en'
                ? 'Portrait'
                : lang === 'de'
                  ? 'Hochformat'
                  : lang === 'ar'
                    ? 'عمودي'
                    : 'Dikey'}
            </option>
            <option value="landscape">
              {lang === 'en'
                ? 'Landscape'
                : lang === 'de'
                  ? 'Querformat'
                  : lang === 'ar'
                    ? 'أفقي'
                    : 'Yatay'}
            </option>
          </select>
        </label>
        <label style={lbl}>
          <span style={{ color: 'var(--ink-mute)' }}>
            {lang === 'en'
              ? 'Margin (mm)'
              : lang === 'de'
                ? 'Rand (mm)'
                : lang === 'ar'
                  ? 'الهامش (مم)'
                  : 'Kenar (mm)'}
          </span>
          <input
            className="input mono"
            type="number"
            style={{ fontSize: 11 }}
            value={m.top}
            onChange={(e) => setMargin(e.target.value)}
          />
        </label>
        <label style={lbl}>
          <span style={{ color: 'var(--ink-mute)' }}>
            {lang === 'en'
              ? 'Group by'
              : lang === 'de'
                ? 'Gruppierung'
                : lang === 'ar'
                  ? 'تجميع حسب'
                  : 'Gruplama'}
          </span>
          <select
            className="input mono"
            style={{ fontSize: 11 }}
            value={L.groupBy || ''}
            onChange={(e) => set({ groupBy: e.target.value })}
          >
            <option value="">
              {lang === 'en'
                ? '— none —'
                : lang === 'de'
                  ? '— keine —'
                  : lang === 'ar'
                    ? '— بدون —'
                    : '— yok —'}
            </option>
            {allKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label style={lbl}>
          <span style={{ color: 'var(--ink-mute)' }}>
            {lang === 'en'
              ? 'Title'
              : lang === 'de'
                ? 'Titel'
                : lang === 'ar'
                  ? 'العنوان'
                  : 'Başlık'}
          </span>
          <input
            className="input"
            style={{ fontSize: 11 }}
            value={L.title || ''}
            placeholder={
              lang === 'en'
                ? 'Report title'
                : lang === 'de'
                  ? 'Berichtstitel'
                  : lang === 'ar'
                    ? 'عنوان التقرير'
                    : 'Rapor başlığı'
            }
            onChange={(e) => set({ title: e.target.value })}
          />
        </label>
        <label style={lbl}>
          <span style={{ color: 'var(--ink-mute)' }}>
            {lang === 'en'
              ? 'Company'
              : lang === 'de'
                ? 'Firma / Kopfzeile'
                : lang === 'ar'
                  ? 'الشركة / الترويسة'
                  : 'Şirket / üst başlık'}
          </span>
          <input
            className="input"
            style={{ fontSize: 11 }}
            value={L.companyName || ''}
            onChange={(e) => set({ companyName: e.target.value })}
          />
        </label>
        <label style={lbl}>
          <span style={{ color: 'var(--ink-mute)' }}>
            {lang === 'en'
              ? 'Prepared by'
              : lang === 'de'
                ? 'Erstellt von'
                : lang === 'ar'
                  ? 'أعدّه'
                  : 'Hazırlayan'}
          </span>
          <input
            className="input"
            style={{ fontSize: 11 }}
            value={L.preparedBy || ''}
            onChange={(e) => set({ preparedBy: e.target.value })}
          />
        </label>
        <label style={lbl}>
          <span style={{ color: 'var(--ink-mute)' }}>
            {lang === 'en'
              ? 'Footer'
              : lang === 'de'
                ? 'Fußzeile'
                : lang === 'ar'
                  ? 'التذييل'
                  : 'Altlık'}
          </span>
          <input
            className="input"
            style={{ fontSize: 11 }}
            value={L.footer || ''}
            onChange={(e) => set({ footer: e.target.value })}
          />
        </label>
        <label style={{ ...lbl, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={L.showDate !== false}
            onChange={(e) => set({ showDate: e.target.checked })}
          />
          <span style={{ color: 'var(--ink-mute)' }}>
            {lang === 'en'
              ? 'Show date'
              : lang === 'de'
                ? 'Datum anzeigen'
                : lang === 'ar'
                  ? 'عرض التاريخ'
                  : 'Tarihi göster'}
          </span>
        </label>
      </div>

      <div className="text-xs" style={{ color: 'var(--ink-mute)' }}>
        {lang === 'en'
          ? 'Preview:'
          : lang === 'de'
            ? 'Vorschau:'
            : lang === 'ar'
              ? 'معاينة:'
              : 'Önizleme:'}
      </div>
      <iframe
        title="pdf-preview"
        srcDoc={html}
        style={{
          width: '100%',
          height: 480,
          border: '1px solid var(--line)',
          background: '#fff',
          borderRadius: 4,
        }}
      />
    </div>
  );
}
