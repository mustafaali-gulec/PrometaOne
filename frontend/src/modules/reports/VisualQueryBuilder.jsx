/**
 * VisualQueryBuilder — no-code görsel sorgu kurucu (P2).
 *
 * Kaynak/kolon(+agregasyon)/filtre/sıralama/limit seçilir; canlı SQL önizlemesi
 * backend /v1/reports/compile'dan gelir (tek doğruluk kaynağı). Kontrollü bileşen:
 * `value` (spec) + `onChange(spec)`. Filtre değerleri literal gönderilir; PG tipi
 * kolondan çıkarır. Parametre/`:ad` yalnız SQL modunda (P1).
 */
import React, { useEffect, useState } from 'react';

const AGGS = ['', 'sum', 'avg', 'min', 'max', 'count'];
const OPS = [
  '=',
  '<>',
  '<',
  '<=',
  '>',
  '>=',
  'like',
  'ilike',
  'in',
  'between',
  'is null',
  'is not null',
];
const NO_VALUE_OPS = new Set(['is null', 'is not null']);

const emptySpec = { source: '', columns: [], filters: [], orderBy: [], limit: 1000 };

export function VisualQueryBuilder({ catalog = [], value, onChange, api, lang = 'tr' }) {
  const spec = value && value.source !== undefined ? value : emptySpec;
  const set = (patch) => onChange({ ...spec, ...patch });

  const cols = catalog.find((t) => t.key === spec.source)?.columns || [];
  const colOptions = cols.map((c) => c.key);

  const [previewSql, setPreviewSql] = useState('');
  const [previewErr, setPreviewErr] = useState('');

  // Canlı SQL önizleme (debounce + backend compile).
  useEffect(() => {
    if (!spec.source || !spec.columns.length) {
      setPreviewSql('');
      setPreviewErr('');
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      api
        .compile({ spec })
        .then((r) => {
          if (!alive) return;
          setPreviewSql(r?.sql || '');
          setPreviewErr('');
        })
        .catch((e) => {
          if (!alive) return;
          setPreviewSql('');
          setPreviewErr(e.message || 'derleme hatası');
        });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [JSON.stringify(spec), api]);

  // --- mutators ---
  const addCol = () =>
    set({ columns: [...spec.columns, { col: colOptions[0] || '', agg: '', alias: '' }] });
  const setCol = (i, patch) =>
    set({ columns: spec.columns.map((c, k) => (k === i ? { ...c, ...patch } : c)) });
  const delCol = (i) => set({ columns: spec.columns.filter((_, k) => k !== i) });

  const addFilter = () =>
    set({ filters: [...(spec.filters || []), { col: colOptions[0] || '', op: '=', value: '' }] });
  const setFilter = (i, patch) =>
    set({ filters: (spec.filters || []).map((f, k) => (k === i ? { ...f, ...patch } : f)) });
  const delFilter = (i) => set({ filters: (spec.filters || []).filter((_, k) => k !== i) });

  const addOrder = () =>
    set({ orderBy: [...(spec.orderBy || []), { col: colOptions[0] || '', dir: 'asc' }] });
  const setOrder = (i, patch) =>
    set({ orderBy: (spec.orderBy || []).map((o, k) => (k === i ? { ...o, ...patch } : o)) });
  const delOrder = (i) => set({ orderBy: (spec.orderBy || []).filter((_, k) => k !== i) });

  const onOpChange = (i, op) => {
    const patch = { op };
    if (NO_VALUE_OPS.has(op)) patch.value = undefined;
    else if (op === 'in')
      patch.value = Array.isArray(spec.filters[i]?.value) ? spec.filters[i].value : [];
    else if (op === 'between') patch.value = ['', ''];
    else patch.value = Array.isArray(spec.filters[i]?.value) ? '' : (spec.filters[i]?.value ?? '');
    setFilter(i, patch);
  };

  const grp = (g) => `card p-2 space-y-1`;
  const hasAgg = spec.columns.some((c) => c.agg);

  return (
    <div className="space-y-2" style={{ minWidth: 360 }}>
      {/* Kaynak */}
      <div className={grp()}>
        <label className="text-xs font-bold" style={{ color: 'var(--ink-mute)' }}>
          {lang === 'en'
            ? 'SOURCE'
            : lang === 'de'
              ? 'QUELLE (Tabelle/View)'
              : lang === 'ar'
                ? 'المصدر (جدول/عرض)'
                : 'KAYNAK (tablo/görünüm)'}
        </label>
        <select
          className="input"
          style={{ maxWidth: 320 }}
          value={spec.source}
          onChange={(e) => onChange({ ...emptySpec, source: e.target.value })}
        >
          <option value="">
            {lang === 'en'
              ? '— pick —'
              : lang === 'de'
                ? '— wählen —'
                : lang === 'ar'
                  ? '— اختر —'
                  : '— seç —'}
          </option>
          {catalog.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label} ({t.key})
            </option>
          ))}
        </select>
      </div>

      {spec.source && (
        <>
          {/* Kolonlar */}
          <div className={grp()}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: 'var(--ink-mute)' }}>
                {lang === 'en'
                  ? 'COLUMNS'
                  : lang === 'de'
                    ? 'SPALTEN'
                    : lang === 'ar'
                      ? 'الأعمدة'
                      : 'KOLONLAR'}
              </span>
              <button className="btn" style={{ fontSize: 10 }} onClick={addCol}>
                +{' '}
                {lang === 'en'
                  ? 'Column'
                  : lang === 'de'
                    ? 'Spalte'
                    : lang === 'ar'
                      ? 'عمود'
                      : 'Kolon'}
              </button>
            </div>
            {spec.columns.map((c, i) => (
              <div key={i} className="flex items-center gap-1" style={{ flexWrap: 'wrap' }}>
                <select
                  className="input mono"
                  style={{ fontSize: 11, maxWidth: 180 }}
                  value={c.col}
                  onChange={(e) => setCol(i, { col: e.target.value })}
                >
                  {c.agg === 'count' && <option value="*">* (tümü)</option>}
                  {colOptions.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  style={{ fontSize: 11, maxWidth: 100 }}
                  value={c.agg || ''}
                  onChange={(e) => setCol(i, { agg: e.target.value })}
                >
                  {AGGS.map((a) => (
                    <option key={a} value={a}>
                      {a === ''
                        ? lang === 'en'
                          ? 'no agg'
                          : lang === 'de'
                            ? 'keine Agg.'
                            : lang === 'ar'
                              ? 'بدون تجميع'
                              : 'agg yok'
                        : a.toUpperCase()}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  style={{ fontSize: 11, maxWidth: 120 }}
                  placeholder={
                    lang === 'en'
                      ? 'alias'
                      : lang === 'de'
                        ? 'Alias'
                        : lang === 'ar'
                          ? 'اسم بديل'
                          : 'takma ad'
                  }
                  value={c.alias || ''}
                  onChange={(e) => setCol(i, { alias: e.target.value })}
                />
                <button
                  className="btn"
                  style={{ fontSize: 10, color: '#b91c1c' }}
                  onClick={() => delCol(i)}
                >
                  ✕
                </button>
              </div>
            ))}
            {hasAgg && (
              <div className="text-xs" style={{ color: 'var(--ink-mute)' }}>
                {lang === 'en'
                  ? 'ℹ Auto GROUP BY on non-aggregated columns.'
                  : lang === 'de'
                    ? 'ℹ Aggregation aktiv → nicht aggregierte Spalten werden automatisch gruppiert.'
                    : lang === 'ar'
                      ? 'ℹ توجد دالة تجميع ← تُجمَّع الأعمدة غير المجمَّعة تلقائيًا.'
                      : 'ℹ Agregasyon var → agregasız kolonlar otomatik gruplanır.'}
              </div>
            )}
          </div>

          {/* Filtreler */}
          <div className={grp()}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: 'var(--ink-mute)' }}>
                {lang === 'en'
                  ? 'FILTERS'
                  : lang === 'de'
                    ? 'FILTER'
                    : lang === 'ar'
                      ? 'المرشحات'
                      : 'FİLTRELER'}
              </span>
              <button className="btn" style={{ fontSize: 10 }} onClick={addFilter}>
                +{' '}
                {lang === 'en'
                  ? 'Filter'
                  : lang === 'de'
                    ? 'Filter'
                    : lang === 'ar'
                      ? 'مرشح'
                      : 'Filtre'}
              </button>
            </div>
            {(spec.filters || []).map((f, i) => (
              <div key={i} className="flex items-center gap-1" style={{ flexWrap: 'wrap' }}>
                <select
                  className="input mono"
                  style={{ fontSize: 11, maxWidth: 160 }}
                  value={f.col}
                  onChange={(e) => setFilter(i, { col: e.target.value })}
                >
                  {colOptions.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  style={{ fontSize: 11, maxWidth: 110 }}
                  value={f.op}
                  onChange={(e) => onOpChange(i, e.target.value)}
                >
                  {OPS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                {!NO_VALUE_OPS.has(f.op) && f.op === 'between' && (
                  <>
                    <input
                      className="input"
                      style={{ fontSize: 11, maxWidth: 90 }}
                      placeholder="min"
                      value={f.value?.[0] ?? ''}
                      onChange={(e) =>
                        setFilter(i, { value: [e.target.value, f.value?.[1] ?? ''] })
                      }
                    />
                    <input
                      className="input"
                      style={{ fontSize: 11, maxWidth: 90 }}
                      placeholder="max"
                      value={f.value?.[1] ?? ''}
                      onChange={(e) =>
                        setFilter(i, { value: [f.value?.[0] ?? '', e.target.value] })
                      }
                    />
                  </>
                )}
                {!NO_VALUE_OPS.has(f.op) && f.op === 'in' && (
                  <input
                    className="input"
                    style={{ fontSize: 11, maxWidth: 200 }}
                    placeholder="a, b, c"
                    value={(Array.isArray(f.value) ? f.value : []).join(', ')}
                    onChange={(e) =>
                      setFilter(i, {
                        value: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                )}
                {!NO_VALUE_OPS.has(f.op) && f.op !== 'between' && f.op !== 'in' && (
                  <input
                    className="input"
                    style={{ fontSize: 11, maxWidth: 160 }}
                    placeholder={
                      lang === 'en'
                        ? 'value'
                        : lang === 'de'
                          ? 'Wert'
                          : lang === 'ar'
                            ? 'قيمة'
                            : 'değer'
                    }
                    value={typeof f.value === 'string' ? f.value : ''}
                    onChange={(e) => setFilter(i, { value: e.target.value })}
                  />
                )}
                <button
                  className="btn"
                  style={{ fontSize: 10, color: '#b91c1c' }}
                  onClick={() => delFilter(i)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Sıralama + limit */}
          <div className={grp()}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: 'var(--ink-mute)' }}>
                {lang === 'en'
                  ? 'ORDER & LIMIT'
                  : lang === 'de'
                    ? 'SORTIERUNG & LIMIT'
                    : lang === 'ar'
                      ? 'الترتيب والحد'
                      : 'SIRALAMA & LİMİT'}
              </span>
              <button className="btn" style={{ fontSize: 10 }} onClick={addOrder}>
                +{' '}
                {lang === 'en'
                  ? 'Sort'
                  : lang === 'de'
                    ? 'Sortieren'
                    : lang === 'ar'
                      ? 'ترتيب'
                      : 'Sırala'}
              </button>
            </div>
            {(spec.orderBy || []).map((o, i) => (
              <div key={i} className="flex items-center gap-1">
                <select
                  className="input mono"
                  style={{ fontSize: 11, maxWidth: 180 }}
                  value={o.col}
                  onChange={(e) => setOrder(i, { col: e.target.value })}
                >
                  {colOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  style={{ fontSize: 11, maxWidth: 90 }}
                  value={o.dir}
                  onChange={(e) => setOrder(i, { dir: e.target.value })}
                >
                  <option value="asc">ASC</option>
                  <option value="desc">DESC</option>
                </select>
                <button
                  className="btn"
                  style={{ fontSize: 10, color: '#b91c1c' }}
                  onClick={() => delOrder(i)}
                >
                  ✕
                </button>
              </div>
            ))}
            <label className="text-xs flex items-center gap-2" style={{ color: 'var(--ink-mute)' }}>
              Limit
              <input
                className="input mono"
                type="number"
                style={{ fontSize: 11, maxWidth: 100 }}
                value={spec.limit ?? ''}
                onChange={(e) =>
                  set({ limit: e.target.value ? Number(e.target.value) : undefined })
                }
              />
            </label>
          </div>

          {/* Canlı SQL önizleme */}
          <div className="card p-2">
            <div className="text-xs font-bold mb-1" style={{ color: 'var(--ink-mute)' }}>
              {lang === 'en'
                ? 'SQL PREVIEW'
                : lang === 'de'
                  ? 'SQL-VORSCHAU (automatisch)'
                  : lang === 'ar'
                    ? 'معاينة SQL (تلقائية)'
                    : 'SQL ÖNİZLEME (otomatik)'}
            </div>
            {previewErr ? (
              <div className="text-xs" style={{ color: '#b91c1c' }}>
                ⚠ {previewErr}
              </div>
            ) : (
              <pre
                className="mono"
                style={{ fontSize: 11, whiteSpace: 'pre-wrap', margin: 0, color: 'var(--ink)' }}
              >
                {previewSql ||
                  (lang === 'en'
                    ? '(add columns)'
                    : lang === 'de'
                      ? '(Spalten hinzufügen)'
                      : lang === 'ar'
                        ? '(أضف أعمدة)'
                        : '(kolon ekleyin)')}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}
