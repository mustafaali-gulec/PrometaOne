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
  const tr = lang !== 'en';
  const L = layout || {};
  const m = L.margins || { top: 18, right: 18, bottom: 18, left: 18 };
  const set = (patch) => onLayout({ ...L, ...patch });
  const setMargin = (mm) => {
    const v = Number(mm) || 0;
    set({ margins: { top: v, right: v, bottom: v, left: v } });
  };

  const allKeys = result.columns.map((c) => c.key);
  const html = useMemo(() => buildReportHtml({ result, viz, layout: L, lang }), [result, viz, L, lang]);

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
          {tr ? 'PDF BELGE ŞABLONU' : 'PDF TEMPLATE'}
        </span>
        <button className="btn" style={{ background: '#7c3aed', color: '#fff', fontWeight: 700 }} onClick={printIt}>
          🖨 {tr ? 'Yazdır / PDF' : 'Print / PDF'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>
        <label style={lbl}>
          <span style={{ color: 'var(--ink-mute)' }}>{tr ? 'Kağıt' : 'Paper'}</span>
          <select className="input" style={{ fontSize: 11 }} value={L.paper || 'A4'} onChange={(e) => set({ paper: e.target.value })}>
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
          </select>
        </label>
        <label style={lbl}>
          <span style={{ color: 'var(--ink-mute)' }}>{tr ? 'Yön' : 'Orientation'}</span>
          <select className="input" style={{ fontSize: 11 }} value={L.orientation || 'portrait'} onChange={(e) => set({ orientation: e.target.value })}>
            <option value="portrait">{tr ? 'Dikey' : 'Portrait'}</option>
            <option value="landscape">{tr ? 'Yatay' : 'Landscape'}</option>
          </select>
        </label>
        <label style={lbl}>
          <span style={{ color: 'var(--ink-mute)' }}>{tr ? 'Kenar (mm)' : 'Margin (mm)'}</span>
          <input className="input mono" type="number" style={{ fontSize: 11 }} value={m.top} onChange={(e) => setMargin(e.target.value)} />
        </label>
        <label style={lbl}>
          <span style={{ color: 'var(--ink-mute)' }}>{tr ? 'Gruplama' : 'Group by'}</span>
          <select className="input mono" style={{ fontSize: 11 }} value={L.groupBy || ''} onChange={(e) => set({ groupBy: e.target.value })}>
            <option value="">{tr ? '— yok —' : '— none —'}</option>
            {allKeys.map((k) => (<option key={k} value={k}>{k}</option>))}
          </select>
        </label>
        <label style={lbl}>
          <span style={{ color: 'var(--ink-mute)' }}>{tr ? 'Başlık' : 'Title'}</span>
          <input className="input" style={{ fontSize: 11 }} value={L.title || ''} placeholder={tr ? 'Rapor başlığı' : 'Report title'} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label style={lbl}>
          <span style={{ color: 'var(--ink-mute)' }}>{tr ? 'Şirket / üst başlık' : 'Company'}</span>
          <input className="input" style={{ fontSize: 11 }} value={L.companyName || ''} onChange={(e) => set({ companyName: e.target.value })} />
        </label>
        <label style={lbl}>
          <span style={{ color: 'var(--ink-mute)' }}>{tr ? 'Hazırlayan' : 'Prepared by'}</span>
          <input className="input" style={{ fontSize: 11 }} value={L.preparedBy || ''} onChange={(e) => set({ preparedBy: e.target.value })} />
        </label>
        <label style={lbl}>
          <span style={{ color: 'var(--ink-mute)' }}>{tr ? 'Altlık' : 'Footer'}</span>
          <input className="input" style={{ fontSize: 11 }} value={L.footer || ''} onChange={(e) => set({ footer: e.target.value })} />
        </label>
        <label style={{ ...lbl, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={L.showDate !== false} onChange={(e) => set({ showDate: e.target.checked })} />
          <span style={{ color: 'var(--ink-mute)' }}>{tr ? 'Tarihi göster' : 'Show date'}</span>
        </label>
      </div>

      <div className="text-xs" style={{ color: 'var(--ink-mute)' }}>{tr ? 'Önizleme:' : 'Preview:'}</div>
      <iframe
        title="pdf-preview"
        srcDoc={html}
        style={{ width: '100%', height: 480, border: '1px solid var(--line)', background: '#fff', borderRadius: 4 }}
      />
    </div>
  );
}
