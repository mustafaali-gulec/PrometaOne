/**
 * ReportBuilder — Rapor Üreteci (Report Studio) ekranı.
 *
 * İki mod (toggle): **SQL** (ham SQL editörü, P1) ve **Görsel** (no-code sorgu
 * kurucu, P2 — VisualQueryBuilder). Kayıtlı raporlar, çalıştır/önizle, sonuç
 * tablosu, Excel/CSV dışa aktarım ve kaydet iki modda ortaktır. Backend:
 * /v1/reports (güvenli salt-okunur). App.jsx global'lerine bağımlı değildir;
 * yalnız mevcut CSS sınıflarını (card, input, btn, mono, table.grid) kullanır.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { confirmDialog } from '../../shared/feedback';
import { makeReportsApi } from './reportsApi.js';
import { ResultPanel } from './ResultPanel.jsx';
import { ScheduleManager } from './ScheduleManager.jsx';
import { VisualQueryBuilder } from './VisualQueryBuilder.jsx';

// Backend ParamBinder ile aynı: :ad (cast/slice hariç) yakalar.
const NAMED_PARAM_RE = /(?<![:\w\]]):(?!:)([a-zA-Z_]\w*)/g;

function inferType(name) {
  const n = name.toLowerCase();
  if (/(date|tarih|baslangic|bitis|gun|ay|yil|year)/.test(n)) return 'date';
  if (/(min|max|tutar|amount|adet|count|qty|miktar|^id$|_id$|no|tutari)/.test(n)) return 'number';
  return 'text';
}

function extractParams(sql, prev) {
  const prevMap = new Map((prev || []).map((p) => [p.name, p]));
  const out = [];
  NAMED_PARAM_RE.lastIndex = 0;
  let m;
  while ((m = NAMED_PARAM_RE.exec(sql)) !== null) {
    const name = m[1];
    if (!out.find((p) => p.name === name)) {
      out.push(prevMap.get(name) || { name, type: inferType(name), label: name, required: false });
    }
  }
  return out;
}

const emptySpec = { source: '', columns: [], filters: [], orderBy: [], limit: 1000 };
const defaultViz = { chart: { type: 'none', xKey: '', yKeys: [], color: '#7c3aed' }, columns: {} };
const defaultLayout = {
  paper: 'A4',
  orientation: 'portrait',
  margins: { top: 18, right: 18, bottom: 18, left: 18 },
  title: '',
  companyName: '',
  preparedBy: '',
  footer: '',
  showDate: true,
  groupBy: '',
};

export function ReportBuilder({ companyId, canAct, lang = 'tr', notify }) {
  const api = useMemo(() => makeReportsApi(companyId), [companyId]);
  const canSql = canAct ? !!canAct('reports.sql.view') : true;

  const [mode, setMode] = useState(canSql ? 'sql' : 'visual'); // 'sql' | 'visual'
  const [catalog, setCatalog] = useState([]);
  const [sql, setSql] = useState(
    'SELECT id, type, total, paid_amount, due_date\nFROM invoices\nORDER BY due_date DESC\nLIMIT 50',
  );
  const [spec, setSpec] = useState(emptySpec);
  const [params, setParams] = useState([]);
  const [paramValues, setParamValues] = useState({});
  const [result, setResult] = useState(null);
  const [viz, setViz] = useState(defaultViz);
  const [layout, setLayout] = useState(defaultLayout);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [currentId, setCurrentId] = useState(null);
  const [explorerOpen, setExplorerOpen] = useState({});
  const taRef = useRef(null);

  useEffect(() => {
    api
      .catalog()
      .then((c) => setCatalog(c?.tables || []))
      .catch(() => {});
    api
      .list()
      .then(setSaved)
      .catch(() => {});
  }, [api]);

  useEffect(() => {
    if (mode === 'sql') setParams((prev) => extractParams(sql, prev));
  }, [sql, mode]);

  const insertText = (text) => {
    const ta = taRef.current;
    if (!ta) {
      setSql((s) => s + text);
      return;
    }
    const start = ta.selectionStart ?? sql.length;
    const end = ta.selectionEnd ?? sql.length;
    const next = sql.slice(0, start) + text + sql.slice(end);
    setSql(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const buildBody = () =>
    mode === 'sql'
      ? { mode: 'sql', sql, paramDefs: params, params: paramValues }
      : { mode: 'visual', spec };

  const run = async (preview = false) => {
    setRunning(true);
    setError('');
    try {
      const body = buildBody();
      const res = await (preview ? api.preview(body) : api.run(body));
      setResult(res);
    } catch (e) {
      setError(e.message || 'Hata');
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  const doSave = async () => {
    const name = saveName.trim();
    if (!name) return;
    setError('');
    const base =
      mode === 'sql'
        ? { mode: 'sql', sqlText: sql, params }
        : { mode: 'visual', querySpec: spec, params: [] };
    const payload = { name, ...base, vizConfig: viz, layoutConfig: layout };
    try {
      if (currentId) {
        await api.update(currentId, payload);
      } else {
        const d = await api.create(payload);
        setCurrentId(d?.id ?? null);
      }
      notify?.(
        lang === 'en'
          ? 'Report saved'
          : lang === 'de'
            ? 'Bericht gespeichert'
            : lang === 'ar'
              ? 'تم حفظ التقرير'
              : 'Rapor kaydedildi',
      );
      setSaveOpen(false);
      api
        .list()
        .then(setSaved)
        .catch(() => {});
    } catch (e) {
      setError(e.message || 'Kaydedilemedi');
    }
  };

  const loadReport = (r) => {
    setCurrentId(r.id);
    setSaveName(r.name || '');
    setResult(null);
    setError('');
    setViz(r.vizConfig && Object.keys(r.vizConfig).length ? r.vizConfig : defaultViz);
    setLayout(
      r.layoutConfig && Object.keys(r.layoutConfig).length ? r.layoutConfig : defaultLayout,
    );
    if (r.mode === 'visual') {
      setMode('visual');
      setSpec(r.querySpec || emptySpec);
    } else {
      setMode('sql');
      setSql(r.sqlText || '');
      setParams(r.params || []);
    }
  };

  const deleteReport = async (r) => {
    if (
      !(await confirmDialog({
        title:
          lang === 'en'
            ? `Delete "${r.name}"?`
            : lang === 'de'
              ? `"${r.name}" löschen?`
              : lang === 'ar'
                ? `حذف "${r.name}"؟`
                : `"${r.name}" silinsin mi?`,
        tone: 'danger',
      }))
    )
      return;
    try {
      await api.remove(r.id);
      if (currentId === r.id) setCurrentId(null);
      api
        .list()
        .then(setSaved)
        .catch(() => {});
    } catch (e) {
      setError(e.message);
    }
  };

  const newReport = () => {
    setCurrentId(null);
    setSaveName('');
    setResult(null);
    setError('');
    setViz(defaultViz);
    setLayout(defaultLayout);
    if (mode === 'sql') setSql('SELECT ');
    else setSpec(emptySpec);
  };

  const ModeBtn = ({ value, label, disabled }) => (
    <button
      className="btn"
      disabled={disabled}
      onClick={() => !disabled && setMode(value)}
      style={{
        background: mode === value ? '#7c3aed' : 'transparent',
        color: mode === value ? '#fff' : disabled ? 'var(--ink-mute)' : 'var(--ink)',
        fontWeight: mode === value ? 700 : 400,
        opacity: disabled ? 0.5 : 1,
      }}
      title={
        disabled
          ? lang === 'en'
            ? 'No raw-SQL permission'
            : lang === 'de'
              ? 'Keine Berechtigung für Roh-SQL'
              : lang === 'ar'
                ? 'لا توجد صلاحية SQL خام'
                : 'Ham SQL yetkiniz yok'
          : ''
      }
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      {/* Üst şerit: mod + kayıtlı raporlar + aksiyonlar */}
      <div className="card p-2 flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
        <div
          className="flex gap-1"
          style={{ border: '1px solid var(--line)', borderRadius: 4, padding: 2 }}
        >
          <ModeBtn value="sql" label="SQL" disabled={!canSql} />
          <ModeBtn
            value="visual"
            label={
              lang === 'en'
                ? 'Visual'
                : lang === 'de'
                  ? 'Visuell'
                  : lang === 'ar'
                    ? 'مرئي'
                    : 'Görsel'
            }
            disabled={false}
          />
        </div>
        <select
          className="input"
          style={{ maxWidth: 240 }}
          value={currentId ?? ''}
          onChange={(e) => {
            const r = saved.find((x) => String(x.id) === e.target.value);
            if (r) loadReport(r);
          }}
        >
          <option value="">
            {lang === 'en'
              ? '— Saved report —'
              : lang === 'de'
                ? '— Gespeicherter Bericht —'
                : lang === 'ar'
                  ? '— تقرير محفوظ —'
                  : '— Kayıtlı rapor —'}
          </option>
          {saved.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} {r.mode === 'visual' ? '◧' : '⌨'}
            </option>
          ))}
        </select>
        <button className="btn" onClick={newReport}>
          {lang === 'en' ? 'New' : lang === 'de' ? 'Neu' : lang === 'ar' ? 'جديد' : 'Yeni'}
        </button>
        {currentId && (
          <button
            className="btn"
            style={{ color: '#b91c1c' }}
            onClick={() =>
              deleteReport(
                saved.find((x) => x.id === currentId) || { id: currentId, name: saveName },
              )
            }
          >
            {lang === 'en' ? 'Delete' : lang === 'de' ? 'Löschen' : lang === 'ar' ? 'حذف' : 'Sil'}
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button className="btn" disabled={running} onClick={() => run(true)}>
          {lang === 'en'
            ? 'Preview'
            : lang === 'de'
              ? 'Vorschau'
              : lang === 'ar'
                ? 'معاينة'
                : 'Önizle'}
        </button>
        <button
          className="btn"
          disabled={running}
          onClick={() => run(false)}
          style={{ background: '#7c3aed', color: '#fff', fontWeight: 700 }}
        >
          {running
            ? lang === 'en'
              ? 'Running…'
              : lang === 'de'
                ? 'Läuft…'
                : lang === 'ar'
                  ? 'قيد التشغيل…'
                  : 'Çalışıyor…'
            : lang === 'en'
              ? 'Run'
              : lang === 'de'
                ? 'Ausführen'
                : lang === 'ar'
                  ? 'تشغيل'
                  : 'Çalıştır'}
        </button>
        <button
          className="btn"
          onClick={() => {
            setSaveName(
              saveName ||
                (lang === 'en'
                  ? 'New Report'
                  : lang === 'de'
                    ? 'Neuer Bericht'
                    : lang === 'ar'
                      ? 'تقرير جديد'
                      : 'Yeni Rapor'),
            );
            setSaveOpen(true);
          }}
        >
          {lang === 'en' ? 'Save' : lang === 'de' ? 'Speichern' : lang === 'ar' ? 'حفظ' : 'Kaydet'}
        </button>
        <button
          className="btn"
          disabled={!currentId}
          title={
            !currentId
              ? lang === 'en'
                ? 'Save the report first'
                : lang === 'de'
                  ? 'Bericht zuerst speichern'
                  : lang === 'ar'
                    ? 'احفظ التقرير أولاً'
                    : 'Önce raporu kaydedin'
              : ''
          }
          style={{ opacity: currentId ? 1 : 0.5 }}
          onClick={() => setScheduleOpen(true)}
        >
          🕒{' '}
          {lang === 'en'
            ? 'Schedule'
            : lang === 'de'
              ? 'Planen'
              : lang === 'ar'
                ? 'جدولة'
                : 'Zamanla'}
        </button>
      </div>

      {/* Editör alanı */}
      {mode === 'sql' ? (
        <div className="flex gap-3" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Şema gezgini */}
          <div
            className="card p-2"
            style={{ width: 240, maxHeight: 460, overflow: 'auto', flexShrink: 0 }}
          >
            <div className="text-xs font-bold mb-1" style={{ color: 'var(--ink-mute)' }}>
              {lang === 'en'
                ? 'SCHEMA (click → insert)'
                : lang === 'de'
                  ? 'SCHEMA (Klick → einfügen)'
                  : lang === 'ar'
                    ? 'المخطط (انقر → إدراج)'
                    : 'ŞEMA (tıkla → ekle)'}
            </div>
            {catalog.length === 0 && (
              <div className="text-xs" style={{ color: 'var(--ink-mute)' }}>
                {lang === 'en'
                  ? 'Loading…'
                  : lang === 'de'
                    ? 'Katalog wird geladen…'
                    : lang === 'ar'
                      ? 'جارٍ تحميل الكتالوج…'
                      : 'Katalog yükleniyor…'}
              </div>
            )}
            {catalog.map((t) => (
              <div key={t.key} style={{ marginBottom: 2 }}>
                <div
                  className="mono text-xs"
                  style={{ cursor: 'pointer', fontWeight: 700, padding: '2px 0' }}
                  onClick={() => setExplorerOpen((s) => ({ ...s, [t.key]: !s[t.key] }))}
                  title={t.label}
                >
                  {explorerOpen[t.key] ? '▾' : '▸'}{' '}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      insertText(t.key);
                    }}
                  >
                    {t.key}
                  </span>
                </div>
                {explorerOpen[t.key] && (
                  <div style={{ paddingLeft: 14 }}>
                    {(t.columns || []).map((c) => (
                      <div
                        key={c.key}
                        className="mono"
                        style={{
                          cursor: 'pointer',
                          fontSize: 10,
                          padding: '1px 0',
                          color: 'var(--ink-mute)',
                        }}
                        onClick={() => insertText(c.key)}
                        title={`${c.key} (${c.type})`}
                      >
                        {c.key}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* SQL editör + parametreler */}
          <div className="space-y-2" style={{ flex: 1, minWidth: 360 }}>
            <textarea
              ref={taRef}
              className="input mono"
              spellCheck={false}
              style={{ width: '100%', minHeight: 150, fontSize: 12, resize: 'vertical' }}
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              placeholder="SELECT ... ( :parametre ile parametre tanımlayın )"
            />
            {params.length > 0 && (
              <div
                className="card p-2 flex items-center gap-2"
                style={{ flexWrap: 'wrap', background: 'var(--bg-alt)' }}
              >
                <span className="text-xs font-bold" style={{ color: 'var(--ink-mute)' }}>
                  {lang === 'en'
                    ? 'Params:'
                    : lang === 'de'
                      ? 'Parameter:'
                      : lang === 'ar'
                        ? 'المعاملات:'
                        : 'Parametreler:'}
                </span>
                {params.map((p) => (
                  <label
                    key={p.name}
                    className="text-xs"
                    style={{ display: 'flex', flexDirection: 'column' }}
                  >
                    <span className="mono" style={{ color: 'var(--ink-mute)' }}>
                      :{p.name}
                    </span>
                    <input
                      className="input mono"
                      type={p.type === 'date' ? 'date' : p.type === 'number' ? 'number' : 'text'}
                      style={{ fontSize: 11, padding: '2px 6px' }}
                      value={paramValues[p.name] ?? ''}
                      onChange={(e) => setParamValues((v) => ({ ...v, [p.name]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <VisualQueryBuilder
          catalog={catalog}
          value={spec}
          onChange={setSpec}
          api={api}
          lang={lang}
        />
      )}

      {error && (
        <div
          className="card p-2 text-xs"
          style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c' }}
        >
          ⚠ {error}
        </div>
      )}

      {/* Sonuç + çıktı tasarımı (ortak) */}
      {result && (
        <ResultPanel
          result={result}
          viz={viz}
          onViz={setViz}
          layout={layout}
          onLayout={setLayout}
          lang={lang}
        />
      )}

      {/* Kaydet modalı */}
      {saveOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSaveOpen(false)}
        >
          <div
            className="card p-3 space-y-2"
            style={{ width: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-bold">
              {lang === 'en'
                ? 'Save Report'
                : lang === 'de'
                  ? 'Bericht speichern'
                  : lang === 'ar'
                    ? 'حفظ التقرير'
                    : 'Raporu Kaydet'}{' '}
              {mode === 'visual' ? '◧' : '⌨'}
            </div>
            <input
              className="input"
              style={{ width: '100%' }}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder={
                lang === 'en'
                  ? 'Report name'
                  : lang === 'de'
                    ? 'Berichtsname'
                    : lang === 'ar'
                      ? 'اسم التقرير'
                      : 'Rapor adı'
              }
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => setSaveOpen(false)}>
                {lang === 'en'
                  ? 'Cancel'
                  : lang === 'de'
                    ? 'Abbrechen'
                    : lang === 'ar'
                      ? 'إلغاء'
                      : 'İptal'}
              </button>
              <button
                className="btn"
                style={{ background: '#7c3aed', color: '#fff' }}
                onClick={doSave}
              >
                {lang === 'en'
                  ? 'Save'
                  : lang === 'de'
                    ? 'Speichern'
                    : lang === 'ar'
                      ? 'حفظ'
                      : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {scheduleOpen && currentId && (
        <ScheduleManager
          api={api}
          reportId={currentId}
          reportName={
            saveName ||
            (lang === 'en'
              ? 'Report'
              : lang === 'de'
                ? 'Bericht'
                : lang === 'ar'
                  ? 'تقرير'
                  : 'Rapor')
          }
          lang={lang}
          notify={notify}
          onClose={() => setScheduleOpen(false)}
        />
      )}
    </div>
  );
}
