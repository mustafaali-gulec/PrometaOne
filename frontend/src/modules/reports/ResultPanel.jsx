/**
 * ResultPanel — rapor sonucunun çıktı tasarımı + gösterimi (P3).
 *
 * "⚙ Tasarım" ile: grafik (tip/eksen) + kolon biçim/görünür/alt-toplam ayarı.
 * Tablo biçimlendirilmiş gösterilir; alt-toplam işaretli sayısal kolonlar için
 * toplam satırı. Export HAM değer aktarır (veri bütünlüğü). viz config rapor
 * tanımında (viz_config) saklanır.
 */
import React, { useState } from 'react';

import { formatValue, isRight } from './format.js';
import { PdfTemplateDesigner } from './PdfTemplateDesigner.jsx';
import { ReportChart } from './ReportChart.jsx';

const FORMATS = ['auto', 'number', 'money', 'percent', 'date', 'text'];
const CHART_TYPES = [
  ['none', { tr: 'Yok', en: 'None' }],
  ['bar', { tr: 'Bar', en: 'Bar' }],
  ['line', { tr: 'Çizgi', en: 'Line' }],
  ['pie', { tr: 'Pasta', en: 'Pie' }],
  ['kpi', { tr: 'KPI Kart', en: 'KPI' }],
];

export function ResultPanel({ result, viz, onViz, layout, onLayout, lang = 'tr' }) {
  const tr = lang !== 'en';
  const [designOpen, setDesignOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  const chart = viz?.chart || { type: 'none', xKey: '', yKeys: [], color: '#7c3aed' };
  const colCfg = viz?.columns || {};
  const setChart = (patch) => onViz({ ...(viz || {}), chart: { ...chart, ...patch } });
  const setColCfg = (key, patch) =>
    onViz({ ...(viz || {}), columns: { ...colCfg, [key]: { ...(colCfg[key] || {}), ...patch } } });

  const allKeys = result.columns.map((c) => c.key);
  const numericKeys = result.columns.filter((c) => c.type === 'number').map((c) => c.key);
  const cfgOf = (key) => colCfg[key] || {};
  const visibleCols = result.columns.filter((c) => cfgOf(c.key).visible !== false);
  const subtotalKeys = result.columns.filter((c) => cfgOf(c.key).subtotal).map((c) => c.key);

  const colIndex = Object.fromEntries(result.columns.map((c, i) => [c.key, i]));
  const totals =
    subtotalKeys.length > 0
      ? subtotalKeys.reduce((acc, k) => {
          acc[k] = result.rows.reduce((s, r) => s + (Number(r[colIndex[k]]) || 0), 0);
          return acc;
        }, {})
      : null;

  const onChartType = (type) => {
    const next = { ...chart, type };
    if (type !== 'none' && type !== 'kpi' && !chart.xKey) {
      next.xKey = allKeys.find((k) => !numericKeys.includes(k)) || allKeys[0] || '';
    }
    if (type !== 'none' && !(chart.yKeys || []).length) {
      next.yKeys = numericKeys.slice(0, 1);
    }
    setChart(next);
  };

  const toggleY = (k) => {
    const ys = chart.yKeys || [];
    setChart({ yKeys: ys.includes(k) ? ys.filter((x) => x !== k) : [...ys, k] });
  };

  const exportXlsx = async () => {
    const XLSX = await import('xlsx');
    const aoa = [
      visibleCols.map((c) => cfgOf(c.key).label || c.key),
      ...result.rows.map((r) => visibleCols.map((c) => r[colIndex[c.key]])),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rapor');
    XLSX.writeFile(wb, 'rapor.xlsx');
  };

  const exportCsv = () => {
    const esc = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [
      visibleCols.map((c) => esc(cfgOf(c.key).label || c.key)).join(';'),
      ...result.rows.map((r) => visibleCols.map((c) => esc(r[colIndex[c.key]])).join(';')),
    ];
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rapor.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card p-2 space-y-2">
      <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 6 }}>
        <div className="text-xs" style={{ color: 'var(--ink-mute)' }}>
          {result.rowCount} {tr ? 'satır' : 'rows'}
          {result.durationMs != null ? ` · ${result.durationMs} ms` : ''}
          {result.truncated ? (tr ? ` · ⚠ ilk ${result.rowCount} satır` : ` · ⚠ truncated`) : ''}
        </div>
        <div className="flex gap-1">
          <button
            className="btn"
            style={{ fontSize: 10, background: designOpen ? '#7c3aed' : 'transparent', color: designOpen ? '#fff' : 'var(--ink)' }}
            onClick={() => setDesignOpen((o) => !o)}
          >
            ⚙ {tr ? 'Tasarım' : 'Design'}
          </button>
          <button
            className="btn"
            style={{ fontSize: 10, background: pdfOpen ? '#7c3aed' : 'transparent', color: pdfOpen ? '#fff' : 'var(--ink)' }}
            onClick={() => setPdfOpen((o) => !o)}
          >
            🖨 PDF
          </button>
          <button className="btn" style={{ fontSize: 10 }} onClick={exportXlsx}>Excel</button>
          <button className="btn" style={{ fontSize: 10 }} onClick={exportCsv}>CSV</button>
        </div>
      </div>

      {/* Tasarım kontrolleri */}
      {designOpen && (
        <div className="card p-2 space-y-2" style={{ background: 'var(--bg-alt)' }}>
          {/* Grafik */}
          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
            <span className="text-xs font-bold" style={{ color: 'var(--ink-mute)' }}>{tr ? 'Grafik:' : 'Chart:'}</span>
            <select className="input" style={{ fontSize: 11, maxWidth: 110 }} value={chart.type} onChange={(e) => onChartType(e.target.value)}>
              {CHART_TYPES.map(([v, l]) => (<option key={v} value={v}>{tr ? l.tr : l.en}</option>))}
            </select>
            {chart.type !== 'none' && chart.type !== 'kpi' && (
              <label className="text-xs flex items-center gap-1">
                {tr ? 'X ekseni' : 'X'}
                <select className="input mono" style={{ fontSize: 11, maxWidth: 140 }} value={chart.xKey || ''} onChange={(e) => setChart({ xKey: e.target.value })}>
                  {allKeys.map((k) => (<option key={k} value={k}>{k}</option>))}
                </select>
              </label>
            )}
            {chart.type !== 'none' && (
              <span className="text-xs flex items-center gap-1" style={{ flexWrap: 'wrap' }}>
                {tr ? 'Değer(ler):' : 'Y:'}
                {numericKeys.length === 0 && <em style={{ color: 'var(--ink-mute)' }}>{tr ? 'sayısal kolon yok' : 'no numeric col'}</em>}
                {numericKeys.map((k) => (
                  <label key={k} className="mono" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    <input type="checkbox" checked={(chart.yKeys || []).includes(k)} onChange={() => toggleY(k)} />
                    {k}
                  </label>
                ))}
              </span>
            )}
          </div>

          {/* Kolon biçimleri */}
          <div className="space-y-1">
            <span className="text-xs font-bold" style={{ color: 'var(--ink-mute)' }}>{tr ? 'Kolonlar' : 'Columns'}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 4 }}>
              {result.columns.map((c) => (
                <div key={c.key} className="flex items-center gap-1" style={{ fontSize: 11 }}>
                  <input type="checkbox" title={tr ? 'görünür' : 'visible'} checked={cfgOf(c.key).visible !== false} onChange={(e) => setColCfg(c.key, { visible: e.target.checked })} />
                  <span className="mono" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.key}</span>
                  <select className="input" style={{ fontSize: 10, maxWidth: 90 }} value={cfgOf(c.key).format || 'auto'} onChange={(e) => setColCfg(c.key, { format: e.target.value })}>
                    {FORMATS.map((f) => (<option key={f} value={f}>{f}</option>))}
                  </select>
                  {c.type === 'number' && (
                    <label className="text-xs" title={tr ? 'alt-toplam' : 'subtotal'} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <input type="checkbox" checked={!!cfgOf(c.key).subtotal} onChange={(e) => setColCfg(c.key, { subtotal: e.target.checked })} />Σ
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PDF belge şablonu */}
      {pdfOpen && (
        <PdfTemplateDesigner result={result} viz={viz} layout={layout} onLayout={onLayout} lang={lang} />
      )}

      {/* Grafik */}
      {chart.type !== 'none' && (
        <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
          <ReportChart result={result} chart={chart} />
        </div>
      )}

      {/* Tablo */}
      <div style={{ overflow: 'auto', maxHeight: 360 }}>
        <table className="grid" style={{ width: '100%', fontSize: 11 }}>
          <thead>
            <tr>
              {visibleCols.map((c) => (
                <th key={c.key} style={{ whiteSpace: 'nowrap' }}>{cfgOf(c.key).label || c.key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, ri) => (
              <tr key={ri}>
                {visibleCols.map((c) => {
                  const cfg = cfgOf(c.key);
                  const val = row[colIndex[c.key]];
                  return (
                    <td key={c.key} className={isRight(cfg.format, c.type) ? 'mono text-right' : ''} style={{ whiteSpace: 'nowrap' }}>
                      {formatValue(val, cfg.format, c.type)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--line)' }}>
                {visibleCols.map((c, idx) => {
                  if (idx === 0 && !subtotalKeys.includes(c.key)) {
                    return <td key={c.key}>{tr ? 'Toplam' : 'Total'}</td>;
                  }
                  const cfg = cfgOf(c.key);
                  return (
                    <td key={c.key} className={isRight(cfg.format, c.type) ? 'mono text-right' : ''}>
                      {totals[c.key] !== undefined ? formatValue(totals[c.key], cfg.format, c.type) : ''}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
