/**
 * Beyanname (KDV1 + GİB e-Beyan) modülü.
 *
 * Tam sunucu-backed (/v1/beyanname): beyanname listesi + KDV1 sekmeli editör +
 * GİB akışı (gönder → kontrol → onayla, kanuni süre dışında Özel Onay) + tahakkuk
 * özeti + PDF + GİB beyanname listesi + entegrasyon ayarları. Veri blob'a yazılmaz.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';

import { toast as toastApi, confirmDialog } from '../../shared/feedback';

import { makeBeyannameApi, openBeyannamePdf } from './beyannameApi.js';
import { tbn } from './i18n.js';
import {
  AYLAR,
  DAGILIM_INDIRIM_TURU,
  DEVREDEN_NEDEN,
  DIGER_INDIRIM_TURU,
  DIGER_ISLEM_TURU,
  GIB_DURUM,
  IHRAC_ISLEM_TURU,
  KDV_ORANLARI,
  KISMI_ISTISNA_TURU,
  LOKAL_DURUM,
  MATRAH_TEVKIFATSIZ,
  ODEME_TURU_109,
  TAM_ISTISNA_TURU,
  codeLabel,
  label,
} from './kdv1Catalog.js';

/* ---------- UI yardımcıları ---------- */
const S = {
  page: { padding: 20, maxWidth: 1280, margin: '0 auto' },
  h1: { fontSize: 20, fontWeight: 700, margin: 0 },
  sub: { color: '#737373', fontSize: 13, marginTop: 4 },
  card: {
    background: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  row: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  btn: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #d4d4d4',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 13,
  },
  btnPrimary: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #2563eb',
    background: '#2563eb',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
  },
  btnDanger: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #dc2626',
    background: '#fff',
    color: '#dc2626',
    cursor: 'pointer',
    fontSize: 13,
  },
  input: {
    padding: '6px 8px',
    borderRadius: 8,
    border: '1px solid #d4d4d4',
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box',
  },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    borderBottom: '2px solid #e5e5e5',
    color: '#525252',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    fontSize: 12,
  },
  td: {
    padding: '6px 8px',
    borderBottom: '1px solid #f5f5f4',
    verticalAlign: 'middle',
    fontSize: 13,
  },
  label: { fontSize: 12, color: '#525252', fontWeight: 600, display: 'block', marginBottom: 4 },
  field: { marginBottom: 12 },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
    overflowY: 'auto',
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 900,
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  modalHead: {
    padding: '14px 18px',
    borderBottom: '1px solid #e5e5e5',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalBody: { padding: 18, maxHeight: '70vh', overflowY: 'auto' },
  modalFoot: {
    padding: '12px 18px',
    borderTop: '1px solid #e5e5e5',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  tabBar: {
    display: 'flex',
    gap: 4,
    borderBottom: '1px solid #e5e5e5',
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  tab: (on) => ({
    padding: '8px 12px',
    border: 'none',
    borderBottom: on ? '2px solid #2563eb' : '2px solid transparent',
    background: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: on ? 700 : 500,
    color: on ? '#2563eb' : '#525252',
  }),
  badge: (bg, fg) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    background: bg,
    color: fg,
    fontSize: 11,
    fontWeight: 600,
  }),
};

const DURUM_RENK = {
  taslak: ['#f3f4f6', '#374151'],
  gonderildi: ['#dbeafe', '#1e40af'],
  kontrol_edildi: ['#e0e7ff', '#3730a3'],
  onaylandi: ['#dcfce7', '#166534'],
  hatali: ['#fee2e2', '#991b1b'],
};

const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const fmtMoney = (v) =>
  num(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function debounceNow() {
  // Kararlı reload kimliği için basit sinyal; gerçek debounce gerekmez.
  return true;
}

/* ==================== ANA MODÜL ==================== */
export default function BeyannameModule({
  data,
  session,
  canAct = () => false,
  lang = 'tr',
  logAudit = () => {},
  notify,
  initialView = 'bey_list',
}) {
  const companyId = Number(data?.activeCompanyId) || 1;
  const api = useMemo(() => makeBeyannameApi(companyId), [companyId]);
  const [view, setView] = useState(initialView);
  useEffect(() => setView(initialView), [initialView]);

  const may = useCallback((res, action) => canAct(`${res}.${action}`), [canAct]);
  const toast = useCallback(
    (msg, kind = 'info') => {
      if (typeof notify === 'function') notify(msg, kind);
      else if (kind === 'error') toastApi.error?.(msg);
      else toastApi.success?.(msg);
    },
    [notify],
  );

  return (
    <div style={S.page}>
      <div style={S.row}>
        <div style={{ flex: 1 }}>
          <h1 style={S.h1}>{tbn('module.title', lang)}</h1>
          <div style={S.sub}>KDV1 · GİB e-Beyan</div>
        </div>
      </div>

      {view === 'bey_list' && (
        <DeclarationsView
          api={api}
          lang={lang}
          may={may}
          toast={toast}
          logAudit={logAudit}
          session={session}
        />
      )}
      {view === 'bey_gib' && <GibListView api={api} lang={lang} toast={toast} />}
      {view === 'bey_settings' && <SettingsView api={api} lang={lang} may={may} toast={toast} />}
    </div>
  );
}

/* ==================== BEYANNAME LİSTESİ ==================== */
function DeclarationsView({ api, lang, may, toast, logAudit }) {
  const [rows, setRows] = useState(null); // null = yükleniyor
  const [durumF, setDurumF] = useState('');
  const [yilF, setYilF] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | record
  const [needCred, setNeedCred] = useState(false);
  const [ozelOnayFor, setOzelOnayFor] = useState(null); // record
  const [tahakkuk, setTahakkuk] = useState(null); // onay sonucu

  const reload = useCallback(async () => {
    try {
      const res = await api.listDeclarations({
        ...(durumF ? { durum: durumF } : {}),
        ...(yilF ? { yil: Number(yilF) } : {}),
      });
      setRows(res?.declarations || []);
    } catch (err) {
      setRows([]);
      toast(`${tbn('msg.loadError', lang)}: ${err.message}`, 'error');
    }
  }, [api, durumF, yilF, lang, toast]);

  useEffect(() => {
    if (debounceNow()) void reload();
  }, [reload]);

  const runAction = async (fn, okMsg, audit) => {
    try {
      const res = await fn();
      toast(okMsg, 'success');
      if (audit) logAudit(audit);
      await reload();
      return res;
    } catch (err) {
      if (err.status === 412) setNeedCred(true);
      toast(`${tbn('msg.actionError', lang)}: ${err.message}`, 'error');
      return null;
    }
  };

  const onSend = (r) => runAction(() => api.send(r.id), tbn('msg.sent', lang), 'beyanname.send');
  const onCheck = async (r) => {
    const res = await runAction(() => api.check(r.id), tbn('msg.checked', lang), 'beyanname.check');
    if (res) setEditing(null);
  };
  const onRefresh = (r) => runAction(() => api.refreshStatus(r.id), tbn('msg.checked', lang));
  const onMakeDraft = (r) => runAction(() => api.makeDraft(r.id), tbn('msg.saved', lang));
  const onDelete = async (r) => {
    const okConfirm = await confirmDialog({ message: tbn('msg.deleteConfirm', lang) });
    if (!okConfirm) return;
    await runAction(
      () => api.deleteDeclaration(r.id),
      tbn('msg.deleted', lang),
      'beyanname.delete',
    );
  };
  const onApproveClick = async (r) => {
    try {
      const oz = await api.getOzelOnay(r.id);
      if (oz && oz.kanuniSureIcinde === false) {
        setOzelOnayFor({ record: r, info: oz.ozelOnay });
      } else {
        await doApprove(r, {});
      }
    } catch (err) {
      toast(`${tbn('msg.actionError', lang)}: ${err.message}`, 'error');
    }
  };
  const doApprove = async (r, opts) => {
    const res = await runAction(
      () => api.approve(r.id, opts),
      tbn('msg.approved', lang),
      'beyanname.approve',
    );
    setOzelOnayFor(null);
    if (res?.record?.onaySonucu) setTahakkuk(res.record.onaySonucu);
  };

  if (rows === null) return <div style={S.card}>{tbn('msg.loading', lang)}</div>;

  const years = Array.from(new Set(rows.map((r) => r.donem?.yil).filter(Boolean))).sort(
    (a, b) => b - a,
  );

  return (
    <>
      {needCred && (
        <div style={{ ...S.card, background: '#fffbeb', borderColor: '#fde68a' }}>
          {tbn('msg.needCredential', lang)}
        </div>
      )}
      <div style={{ ...S.card }}>
        <div style={S.row}>
          {may('beyanname.beyannameler', 'create') && (
            <button style={S.btnPrimary} onClick={() => setEditing('new')}>
              + {tbn('list.new', lang)}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <select
            style={{ ...S.input, width: 180 }}
            value={durumF}
            onChange={(e) => setDurumF(e.target.value)}
          >
            <option value="">
              {tbn('list.filterStatus', lang)}: {tbn('list.all', lang)}
            </option>
            {Object.keys(LOKAL_DURUM).map((k) => (
              <option key={k} value={k}>
                {label(LOKAL_DURUM[k], lang)}
              </option>
            ))}
          </select>
          <select
            style={{ ...S.input, width: 120 }}
            value={yilF}
            onChange={(e) => setYilF(e.target.value)}
          >
            <option value="">
              {tbn('list.filterYear', lang)}: {tbn('list.all', lang)}
            </option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {rows.length === 0 ? (
          <div style={{ ...S.sub, marginTop: 16 }}>{tbn('list.empty', lang)}</div>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={S.th}>{tbn('list.period', lang)}</th>
                  <th style={S.th}>{tbn('list.type', lang)}</th>
                  <th style={S.th}>{tbn('list.vd', lang)}</th>
                  <th style={S.th}>{tbn('list.correction', lang)}</th>
                  <th style={S.th}>{tbn('list.status', lang)}</th>
                  <th style={S.th}>{tbn('list.gibStatus', lang)}</th>
                  <th style={S.th}>{tbn('list.actions', lang)}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <DeclarationRow
                    key={r.id}
                    r={r}
                    lang={lang}
                    may={may}
                    onEdit={() => setEditing(r)}
                    onSend={() => onSend(r)}
                    onCheck={() => onCheck(r)}
                    onApprove={() => onApproveClick(r)}
                    onRefresh={() => onRefresh(r)}
                    onMakeDraft={() => onMakeDraft(r)}
                    onDelete={() => onDelete(r)}
                    onPdf={(type) =>
                      openBeyannamePdf(api.pdfUrl(r.id, type)).catch((e) =>
                        toast(e.message, 'error'),
                      )
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing !== null && (
        <DeclarationEditor
          api={api}
          lang={lang}
          record={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
          toast={toast}
        />
      )}

      {ozelOnayFor && (
        <OzelOnayModal
          lang={lang}
          info={ozelOnayFor.info}
          onCancel={() => setOzelOnayFor(null)}
          onConfirm={(opts) => doApprove(ozelOnayFor.record, opts)}
        />
      )}

      {tahakkuk && <TahakkukModal lang={lang} data={tahakkuk} onClose={() => setTahakkuk(null)} />}
    </>
  );
}

function DeclarationRow({
  r,
  lang,
  may,
  onEdit,
  onSend,
  onCheck,
  onApprove,
  onRefresh,
  onMakeDraft,
  onDelete,
  onPdf,
}) {
  const [renk0, renk1] = DURUM_RENK[r.durum] || ['#f3f4f6', '#374151'];
  const donem = r.donem
    ? `${r.donem.yil} / ${label(AYLAR.find((a) => a.code === r.donem.ay) || { tr: r.donem.ay }, lang)}`
    : '—';
  const canUpdate = may('beyanname.beyannameler', 'update');
  const canApprove = may('beyanname.gonderim', 'approve');
  const sent = r.gibBeyannameId != null;
  return (
    <tr>
      <td style={S.td}>{donem}</td>
      <td style={S.td}>{r.tur}</td>
      <td style={S.td}>{r.vergiDairesiAd || r.vergiDairesiKod || '—'}</td>
      <td style={S.td}>{r.duzeltmeMi ? '✓' : ''}</td>
      <td style={S.td}>
        <span style={S.badge(renk0, renk1)}>{label(LOKAL_DURUM[r.durum] || {}, lang)}</span>
      </td>
      <td style={S.td}>
        {r.gibDurum ? label(GIB_DURUM[r.gibDurum] || { tr: r.gibDurum }, lang) : '—'}
      </td>
      <td style={S.td}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button style={S.btn} onClick={onEdit}>
            {canUpdate && !sent ? tbn('act.edit', lang) : tbn('act.view', lang)}
          </button>
          {canUpdate && (r.durum === 'taslak' || r.durum === 'hatali') && (
            <button style={S.btn} onClick={onSend}>
              {tbn('act.send', lang)}
            </button>
          )}
          {canUpdate && sent && (
            <button style={S.btn} onClick={onCheck}>
              {tbn('act.check', lang)}
            </button>
          )}
          {canApprove && sent && r.durum !== 'onaylandi' && (
            <button style={S.btnPrimary} onClick={onApprove}>
              {tbn('act.approve', lang)}
            </button>
          )}
          {canUpdate && sent && (
            <button style={S.btn} onClick={onRefresh}>
              {tbn('act.refresh', lang)}
            </button>
          )}
          {canUpdate && sent && r.durum !== 'taslak' && (
            <button style={S.btn} onClick={onMakeDraft}>
              {tbn('act.makeDraft', lang)}
            </button>
          )}
          {sent && (
            <>
              <button style={S.btn} onClick={() => onPdf('beyanname')}>
                {tbn('act.pdfBeyanname', lang)}
              </button>
              {r.durum === 'onaylandi' && (
                <button style={S.btn} onClick={() => onPdf('tahakkuk')}>
                  {tbn('act.pdfTahakkuk', lang)}
                </button>
              )}
            </>
          )}
          {may('beyanname.beyannameler', 'delete') && r.durum === 'taslak' && !sent && (
            <button style={S.btnDanger} onClick={onDelete}>
              {tbn('act.delete', lang)}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ==================== KDV1 EDİTÖRÜ ==================== */
const emptyPayload = () => ({
  matrah: { tevkifatUygulanmayan: [], digerIslemler: [] },
  indirimler: { indirilecekKdv: [], digerIndirimler: [], indirilecekKdvDagilimi: [] },
  istisnalar: { kismiIstisna: [], tamIstisna: [] },
  ihracKaydiylaTeslimler: { ihracKaydiylaTeslimlereAitBildirim: [] },
  ekler: { sorumluSifatiylaOdenenKdv: [] },
  sonucHesaplari: {},
});

function DeclarationEditor({ api, lang, record, onClose, onSaved, toast }) {
  const readOnly = record != null && record.gibBeyannameId != null && record.durum === 'onaylandi';
  const [tab, setTab] = useState('general');
  const now = new Date();
  const [donem, setDonem] = useState(
    record?.donem || { tip: 'AYLIK', yil: now.getFullYear(), ay: 'OCAK' },
  );
  const [vdKod, setVdKod] = useState(record?.vergiDairesiKod || '');
  const [vdAd, setVdAd] = useState(record?.vergiDairesiAd || '');
  const [duzeltmeMi, setDuzeltmeMi] = useState(record?.duzeltmeMi || false);
  const [payload, setPayload] = useState(() => ({ ...emptyPayload(), ...(record?.payload || {}) }));
  const [saving, setSaving] = useState(false);

  const setSection = (section, key, value) =>
    setPayload((p) => ({ ...p, [section]: { ...(p[section] || {}), [key]: value } }));

  const save = async () => {
    if (vdKod && !/^[0-9]{6}$/.test(vdKod)) {
      toast(`${tbn('field.vdKod', lang)}: 6 hane`, 'error');
      return;
    }
    setSaving(true);
    try {
      const body = {
        donem,
        vergiDairesiKod: vdKod || null,
        vergiDairesiAd: vdAd || null,
        duzeltmeMi,
        payload,
      };
      if (record) await api.updateDeclaration(record.id, body);
      else await api.createDeclaration(body);
      toast(tbn('msg.saved', lang), 'success');
      await onSaved();
    } catch (err) {
      toast(`${tbn('msg.actionError', lang)}: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Canlı toplamlar
  const totals = useMemo(() => {
    const tev = payload.matrah?.tevkifatUygulanmayan || [];
    const dig = payload.matrah?.digerIslemler || [];
    const toplamMatrah = tev.reduce((s, r) => s + num(r.matrah), 0);
    const hesKdv =
      tev.reduce((s, r) => s + num(r.matrah) * num(r.kdvOrani), 0) +
      dig.reduce((s, r) => s + num(r.vergi), 0);
    const ind =
      (payload.indirimler?.indirilecekKdv || []).reduce((s, r) => s + num(r.kdvTutari), 0) +
      (payload.indirimler?.digerIndirimler || []).reduce(
        (s, r) => s + num(r.indirilecekKdvTutari),
        0,
      ) +
      (payload.indirimler?.indirilecekKdvDagilimi || []).reduce((s, r) => s + num(r.kdvTutari), 0);
    return { toplamMatrah, hesKdv, ind };
  }, [payload]);

  const tabs = [
    ['general', 'editor.tab.general'],
    ['matrah', 'editor.tab.matrah'],
    ['indirimler', 'editor.tab.indirimler'],
    ['istisnalar', 'editor.tab.istisnalar'],
    ['ihrac', 'editor.tab.ihrac'],
    ['ekler', 'editor.tab.ekler'],
    ['sonuc', 'editor.tab.sonuc'],
  ];

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.modalHead}>
          <strong>{record ? tbn('editor.editTitle', lang) : tbn('editor.newTitle', lang)}</strong>
          <button style={S.btn} onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={S.modalBody}>
          <div style={S.tabBar}>
            {tabs.map(([id, key]) => (
              <button key={id} style={S.tab(tab === id)} onClick={() => setTab(id)}>
                {tbn(key, lang)}
              </button>
            ))}
          </div>

          {tab === 'general' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div style={S.field}>
                  <label style={S.label}>{tbn('field.donemTip', lang)}</label>
                  <select
                    style={S.input}
                    disabled={readOnly}
                    value={donem.tip}
                    onChange={(e) => setDonem({ ...donem, tip: e.target.value })}
                  >
                    <option value="AYLIK">{tbn('field.aylik', lang)}</option>
                    <option value="UC_AYLIK">{tbn('field.ucAylik', lang)}</option>
                  </select>
                </div>
                <div style={S.field}>
                  <label style={S.label}>{tbn('field.yil', lang)}</label>
                  <input
                    style={S.input}
                    type="number"
                    disabled={readOnly}
                    value={donem.yil}
                    onChange={(e) => setDonem({ ...donem, yil: Number(e.target.value) })}
                  />
                </div>
                <div style={S.field}>
                  <label style={S.label}>{tbn('field.ay', lang)}</label>
                  <select
                    style={S.input}
                    disabled={readOnly}
                    value={donem.ay}
                    onChange={(e) => setDonem({ ...donem, ay: e.target.value })}
                  >
                    {AYLAR.map((a) => (
                      <option key={a.code} value={a.code}>
                        {label(a, lang)}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={S.field}>
                  <label style={S.label}>{tbn('field.vdKod', lang)}</label>
                  <input
                    style={S.input}
                    disabled={readOnly}
                    value={vdKod}
                    placeholder="006257"
                    onChange={(e) => setVdKod(e.target.value)}
                  />
                </div>
                <div style={S.field}>
                  <label style={S.label}>{tbn('field.vdAd', lang)}</label>
                  <input
                    style={S.input}
                    disabled={readOnly}
                    value={vdAd}
                    onChange={(e) => setVdAd(e.target.value)}
                  />
                </div>
                <div style={{ ...S.field, display: 'flex', alignItems: 'flex-end' }}>
                  <label style={{ ...S.label, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={duzeltmeMi}
                      onChange={(e) => setDuzeltmeMi(e.target.checked)}
                    />
                    {tbn('field.duzeltme', lang)}
                  </label>
                </div>
              </div>
            </div>
          )}

          {tab === 'matrah' && (
            <>
              <RowTable
                title={label(MATRAH_TEVKIFATSIZ[0], lang)}
                lang={lang}
                readOnly={readOnly}
                rows={payload.matrah?.tevkifatUygulanmayan || []}
                onChange={(rows) => setSection('matrah', 'tevkifatUygulanmayan', rows)}
                newRow={() => ({ islemTuru: 'KDV1_1100', matrah: '', kdvOrani: 0.2 })}
                columns={[
                  {
                    key: 'islemTuru',
                    label: tbn('field.islemTuru', lang),
                    type: 'select',
                    options: MATRAH_TEVKIFATSIZ,
                  },
                  { key: 'matrah', label: tbn('field.matrah', lang), type: 'money' },
                  { key: 'kdvOrani', label: tbn('field.kdvOrani', lang), type: 'rate' },
                ]}
              />
              <RowTable
                title={tbn('editor.tab.matrah', lang) + ' — ' + tbn('field.islemTuru', lang)}
                lang={lang}
                readOnly={readOnly}
                rows={payload.matrah?.digerIslemler || []}
                onChange={(rows) => setSection('matrah', 'digerIslemler', rows)}
                newRow={() => ({ islemTuru: 'KDV1_503', matrah: '', vergi: '', aciklama: '' })}
                columns={[
                  {
                    key: 'islemTuru',
                    label: tbn('field.islemTuru', lang),
                    type: 'select',
                    options: DIGER_ISLEM_TURU,
                  },
                  { key: 'matrah', label: tbn('field.matrah', lang), type: 'money' },
                  { key: 'vergi', label: tbn('field.vergi', lang), type: 'money' },
                  { key: 'aciklama', label: tbn('field.aciklama', lang), type: 'text' },
                ]}
              />
            </>
          )}

          {tab === 'indirimler' && (
            <>
              <RowTable
                title={tbn('field.degisiklikNedeni', lang)}
                lang={lang}
                readOnly={readOnly}
                rows={payload.indirimler?.indirilecekKdv || []}
                onChange={(rows) => setSection('indirimler', 'indirilecekKdv', rows)}
                newRow={() => ({ degisiklikNedeni: 'KDV1_1', kdvTutari: '', aciklama: '' })}
                columns={[
                  {
                    key: 'degisiklikNedeni',
                    label: tbn('field.degisiklikNedeni', lang),
                    type: 'select',
                    options: DEVREDEN_NEDEN,
                  },
                  { key: 'kdvTutari', label: tbn('field.kdvTutari', lang), type: 'money' },
                  { key: 'aciklama', label: tbn('field.aciklama', lang), type: 'text' },
                ]}
              />
              <RowTable
                title={tbn('field.indirimTuru', lang)}
                lang={lang}
                readOnly={readOnly}
                rows={payload.indirimler?.digerIndirimler || []}
                onChange={(rows) => setSection('indirimler', 'digerIndirimler', rows)}
                newRow={() => ({ indirimTuru: 'KDV1_103', indirilecekKdvTutari: '' })}
                columns={[
                  {
                    key: 'indirimTuru',
                    label: tbn('field.indirimTuru', lang),
                    type: 'select',
                    options: DIGER_INDIRIM_TURU,
                  },
                  {
                    key: 'indirilecekKdvTutari',
                    label: tbn('field.kdvTutari', lang),
                    type: 'money',
                  },
                ]}
              />
              <RowTable
                title={tbn('field.kdvOrani', lang)}
                lang={lang}
                readOnly={readOnly}
                rows={payload.indirimler?.indirilecekKdvDagilimi || []}
                onChange={(rows) => setSection('indirimler', 'indirilecekKdvDagilimi', rows)}
                newRow={() => ({ indirimTuru: 'KDV1_108', kdvOrani: 0.2, kdvTutari: '' })}
                columns={[
                  {
                    key: 'indirimTuru',
                    label: tbn('field.indirimTuru', lang),
                    type: 'select',
                    options: DAGILIM_INDIRIM_TURU,
                  },
                  { key: 'kdvOrani', label: tbn('field.kdvOrani', lang), type: 'rate' },
                  { key: 'kdvTutari', label: tbn('field.kdvTutari', lang), type: 'money' },
                ]}
              />
            </>
          )}

          {tab === 'istisnalar' && (
            <>
              <RowTable
                title={
                  tbn('editor.tab.istisnalar', lang) +
                  ' — ' +
                  label(KISMI_ISTISNA_TURU[0], lang).split('(')[0]
                }
                lang={lang}
                readOnly={readOnly}
                rows={payload.istisnalar?.kismiIstisna || []}
                onChange={(rows) => setSection('istisnalar', 'kismiIstisna', rows)}
                newRow={() => ({
                  istisnaTuru: 'KDV1_201',
                  teslimVeHizmetTutari: '',
                  yuklenilenKdv: '',
                })}
                columns={[
                  {
                    key: 'istisnaTuru',
                    label: tbn('field.istisnaTuru', lang),
                    type: 'select',
                    options: KISMI_ISTISNA_TURU,
                  },
                  {
                    key: 'teslimVeHizmetTutari',
                    label: tbn('field.teslimTutar', lang),
                    type: 'money',
                  },
                  { key: 'yuklenilenKdv', label: tbn('field.yuklenilenKdv', lang), type: 'money' },
                ]}
              />
              <RowTable
                title={
                  tbn('editor.tab.istisnalar', lang) +
                  ' — ' +
                  label(TAM_ISTISNA_TURU[0], lang).split('(')[0]
                }
                lang={lang}
                readOnly={readOnly}
                rows={payload.istisnalar?.tamIstisna || []}
                onChange={(rows) => setSection('istisnalar', 'tamIstisna', rows)}
                newRow={() => ({
                  istisnaTuru: 'KDV1_301',
                  teslimVeHizmetTutari: '',
                  yuklenilenKdv: '',
                })}
                columns={[
                  {
                    key: 'istisnaTuru',
                    label: tbn('field.istisnaTuru', lang),
                    type: 'select',
                    options: TAM_ISTISNA_TURU,
                  },
                  {
                    key: 'teslimVeHizmetTutari',
                    label: tbn('field.teslimTutar', lang),
                    type: 'money',
                  },
                  { key: 'yuklenilenKdv', label: tbn('field.yuklenilenKdv', lang), type: 'money' },
                ]}
              />
            </>
          )}

          {tab === 'ihrac' && (
            <RowTable
              title={tbn('editor.tab.ihrac', lang)}
              lang={lang}
              readOnly={readOnly}
              rows={payload.ihracKaydiylaTeslimler?.ihracKaydiylaTeslimlereAitBildirim || []}
              onChange={(rows) =>
                setSection('ihracKaydiylaTeslimler', 'ihracKaydiylaTeslimlereAitBildirim', rows)
              }
              newRow={() => ({ islemTuru: 'KDV1_701', teslimBedeli: '', kdvOrani: 0.2 })}
              columns={[
                {
                  key: 'islemTuru',
                  label: tbn('field.islemTuru', lang),
                  type: 'select',
                  options: IHRAC_ISLEM_TURU,
                },
                { key: 'teslimBedeli', label: tbn('field.teslimBedeli', lang), type: 'money' },
                { key: 'kdvOrani', label: tbn('field.kdvOrani', lang), type: 'rate' },
              ]}
            />
          )}

          {tab === 'ekler' && (
            <RowTable
              title={tbn('editor.tab.ekler', lang)}
              lang={lang}
              readOnly={readOnly}
              rows={payload.ekler?.sorumluSifatiylaOdenenKdv || []}
              onChange={(rows) => setSection('ekler', 'sorumluSifatiylaOdenenKdv', rows)}
              newRow={() => ({ odemeTuru: 'KDV1_1', kdvTutari: '', belgeNo: '' })}
              columns={[
                {
                  key: 'odemeTuru',
                  label: tbn('field.odemeTuru', lang),
                  type: 'select',
                  options: ODEME_TURU_109,
                },
                { key: 'kdvTutari', label: tbn('field.kdvTutari', lang), type: 'money' },
                { key: 'belgeNo', label: tbn('field.aciklama', lang), type: 'text' },
              ]}
            />
          )}

          {tab === 'sonuc' && (
            <div>
              <div style={S.field}>
                <label style={S.label}>{tbn('field.krediKarti', lang)}</label>
                <input
                  style={S.input}
                  disabled={readOnly}
                  value={payload.sonucHesaplari?.krediKartiIleTahsilEdilenBedel || ''}
                  onChange={(e) =>
                    setSection('sonucHesaplari', 'krediKartiIleTahsilEdilenBedel', e.target.value)
                  }
                />
              </div>
              {duzeltmeMi && (
                <div style={S.field}>
                  <label style={S.label}>{tbn('field.aciklama', lang)}</label>
                  <input
                    style={S.input}
                    disabled={readOnly}
                    value={payload.sonucHesaplari?.duzeltmeAciklama || ''}
                    onChange={(e) =>
                      setSection('sonucHesaplari', 'duzeltmeAciklama', e.target.value)
                    }
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div style={S.modalFoot}>
          <div
            style={{
              flex: 1,
              fontSize: 12,
              color: '#525252',
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <span>
              {tbn('total.matrah', lang)}: <strong>{fmtMoney(totals.toplamMatrah)}</strong>
            </span>
            <span>
              {tbn('total.kdv', lang)}: <strong>{fmtMoney(totals.hesKdv)}</strong>
            </span>
            <span>
              {tbn('total.indirim', lang)}: <strong>{fmtMoney(totals.ind)}</strong>
            </span>
          </div>
          <button style={S.btn} onClick={onClose}>
            {tbn('act.cancel', lang)}
          </button>
          {!readOnly && (
            <button style={S.btnPrimary} disabled={saving} onClick={save}>
              {tbn('act.save', lang)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Genel amaçlı düzenlenebilir satır tablosu ---- */
function RowTable({ title, columns, rows, onChange, newRow, lang, readOnly }) {
  const update = (i, key, val) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r));
    onChange(next);
  };
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ ...S.row, marginBottom: 6 }}>
        <strong style={{ fontSize: 13 }}>{title}</strong>
        <div style={{ flex: 1 }} />
        {!readOnly && (
          <button style={S.btn} onClick={() => onChange([...rows, newRow()])}>
            + {tbn('act.add', lang)}
          </button>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={S.th}>
                  {c.label}
                </th>
              ))}
              {!readOnly && <th style={S.th} />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td style={{ ...S.td, color: '#a3a3a3' }} colSpan={columns.length + 1}>
                  —
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key} style={S.td}>
                      {c.type === 'select' ? (
                        <select
                          style={S.input}
                          disabled={readOnly}
                          value={r[c.key] ?? ''}
                          onChange={(e) => update(i, c.key, e.target.value)}
                        >
                          {c.options.map((o) => (
                            <option key={o.code} value={o.code}>
                              {codeLabel(c.options, o.code, lang)}
                            </option>
                          ))}
                        </select>
                      ) : c.type === 'rate' ? (
                        <select
                          style={S.input}
                          disabled={readOnly}
                          value={r[c.key] ?? 0}
                          onChange={(e) => update(i, c.key, Number(e.target.value))}
                        >
                          {KDV_ORANLARI.map((o) => (
                            <option key={o} value={o}>
                              %{(o * 100).toFixed(0)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          style={S.input}
                          disabled={readOnly}
                          inputMode={c.type === 'money' ? 'decimal' : 'text'}
                          value={r[c.key] ?? ''}
                          placeholder={c.type === 'money' ? '0.00' : ''}
                          onChange={(e) => update(i, c.key, e.target.value)}
                        />
                      )}
                    </td>
                  ))}
                  {!readOnly && (
                    <td style={S.td}>
                      <button
                        style={S.btnDanger}
                        onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                      >
                        {tbn('act.remove', lang)}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==================== ÖZEL ONAY MODALI ==================== */
function OzelOnayModal({ lang, onCancel, onConfirm }) {
  const [secim, setSecim] = useState({
    kanuniSuresindenSonra: true,
    pismanlikTalebi: false,
    izah: false,
    ihtiraziKayit: false,
  });
  const [gerekce, setGerekce] = useState('');
  const toggle = (k) => setSecim((s) => ({ ...s, [k]: !s[k] }));
  const confirm = () => {
    const opts = { ozelOnaySecim: secim };
    if (secim.ihtiraziKayit && gerekce.trim()) opts.duzeltmeAciklama = gerekce.trim();
    onConfirm(opts);
  };
  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={{ ...S.modal, maxWidth: 560 }}>
        <div style={S.modalHead}>
          <strong>{tbn('ozelOnay.title', lang)}</strong>
          <button style={S.btn} onClick={onCancel}>
            ✕
          </button>
        </div>
        <div style={S.modalBody}>
          <div style={{ ...S.sub, marginBottom: 12 }}>{tbn('ozelOnay.kanuniDisinda', lang)}</div>
          {[
            ['kanuniSuresindenSonra', 'ozelOnay.kss'],
            ['pismanlikTalebi', 'ozelOnay.pismanlik'],
            ['izah', 'ozelOnay.izah'],
            ['ihtiraziKayit', 'ozelOnay.ihtirazi'],
          ].map(([k, key]) => (
            <label
              key={k}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
                fontSize: 13,
              }}
            >
              <input type="checkbox" checked={secim[k]} onChange={() => toggle(k)} />
              {tbn(key, lang)}
            </label>
          ))}
          {secim.ihtiraziKayit && (
            <div style={{ ...S.field, marginTop: 8 }}>
              <label style={S.label}>{tbn('ozelOnay.gerekce', lang)}</label>
              <textarea
                style={{ ...S.input, minHeight: 80 }}
                value={gerekce}
                onChange={(e) => setGerekce(e.target.value)}
              />
            </div>
          )}
        </div>
        <div style={S.modalFoot}>
          <button style={S.btn} onClick={onCancel}>
            {tbn('act.cancel', lang)}
          </button>
          <button style={S.btnPrimary} onClick={confirm}>
            {tbn('ozelOnay.confirm', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==================== TAHAKKUK MODALI ==================== */
function TahakkukModal({ lang, data, onClose }) {
  const oid = data?.tahakkukOid || data?.tahakkukOId || '—';
  const tutarlar = data?.tahakkukTutarlari || {};
  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, maxWidth: 520 }}>
        <div style={S.modalHead}>
          <strong>{tbn('tahakkuk.title', lang)}</strong>
          <button style={S.btn} onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={S.modalBody}>
          <div style={S.field}>
            <strong>{tbn('tahakkuk.oid', lang)}:</strong> {oid}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {Object.entries(tutarlar).map(([k, v]) => (
                <tr key={k}>
                  <td style={S.td}>{k}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>
                    {typeof v === 'number' || /^[\d.,]+$/.test(String(v)) ? fmtMoney(v) : String(v)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={S.modalFoot}>
          <button style={S.btnPrimary} onClick={onClose}>
            {tbn('act.cancel', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==================== GİB BEYANNAMELERİ ==================== */
function GibListView({ api, lang, toast }) {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listGib({ page: 0, size: 20 });
      setPage(res);
    } catch (err) {
      toast(`${tbn('msg.loadError', lang)}: ${err.message}`, 'error');
      setPage({ content: [] });
    } finally {
      setLoading(false);
    }
  }, [api, lang, toast]);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) return <div style={S.card}>{tbn('msg.loading', lang)}</div>;
  const content = page?.content || [];
  return (
    <div style={S.card}>
      {content.length === 0 ? (
        <div style={S.sub}>{tbn('list.empty', lang)}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>{tbn('list.type', lang)}</th>
                <th style={S.th}>{tbn('list.period', lang)}</th>
                <th style={S.th}>{tbn('list.vd', lang)}</th>
                <th style={S.th}>{tbn('list.status', lang)}</th>
              </tr>
            </thead>
            <tbody>
              {content.map((b, i) => (
                <tr key={b.beyannameId || i}>
                  <td style={S.td}>{b.beyannameTuru || 'KDV1'}</td>
                  <td style={S.td}>{b.donemBaslangicTarih || '—'}</td>
                  <td style={S.td}>{b.vdAd || b.vdKod || '—'}</td>
                  <td style={S.td}>
                    {b.beyannameDurum
                      ? label(GIB_DURUM[b.beyannameDurum] || { tr: b.beyannameDurum }, lang)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ==================== AYARLAR ==================== */
function SettingsView({ api, lang, may, toast }) {
  const canEdit = may('beyanname.ayarlar', 'update');
  const [loaded, setLoaded] = useState(false);
  const [cred, setCred] = useState(null);
  const emptyForm = {
    apiKey: '',
    ortam: 'test',
    entegratorVkn: '',
    entegratorUnvan: '',
    mukellefVkn: '',
    sifat: { tip: 'MUKELLEF', adSoyadUnvan: '', tckn: '', vkn: '', eposta: '', telefon: '' },
    duzenleyen: { adSoyadUnvan: '', tckn: '', vkn: '', eposta: '', telefon: '' },
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getCredential();
        const c = res?.credential || null;
        setCred(c);
        if (c) {
          setForm((f) => ({
            ...f,
            apiKey: '',
            ortam: c.ortam || 'test',
            entegratorVkn: c.entegratorVkn || '',
            entegratorUnvan: c.entegratorUnvan || '',
            mukellefVkn: c.mukellefVkn || '',
            sifat: { ...f.sifat, ...(c.sifat || {}) },
            duzenleyen: { ...f.duzenleyen, ...(c.duzenleyen || {}) },
          }));
        }
      } catch (err) {
        toast(`${tbn('msg.loadError', lang)}: ${err.message}`, 'error');
      } finally {
        setLoaded(true);
      }
    })();
  }, [api, lang, toast]);

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setNested = (grp, k, v) => setForm((f) => ({ ...f, [grp]: { ...f[grp], [k]: v } }));

  const save = async () => {
    setSaving(true);
    try {
      await api.saveCredential(form);
      toast(tbn('msg.settingsSaved', lang), 'success');
      const res = await api.getCredential();
      setCred(res?.credential || null);
      setForm((f) => ({ ...f, apiKey: '' }));
    } catch (err) {
      toast(`${tbn('msg.actionError', lang)}: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };
  const test = async () => {
    setTesting(true);
    try {
      const res = await api.testConnection();
      toast(res?.message || 'OK', res?.ok ? 'success' : 'error');
    } catch (err) {
      toast(`${tbn('msg.actionError', lang)}: ${err.message}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  if (!loaded) return <div style={S.card}>{tbn('msg.loading', lang)}</div>;

  const grid3 = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 };
  return (
    <div style={S.card}>
      <h2 style={{ fontSize: 16, marginTop: 0 }}>{tbn('settings.title', lang)}</h2>
      {!cred && (
        <div style={{ ...S.sub, marginBottom: 12 }}>{tbn('settings.notConfigured', lang)}</div>
      )}
      {cred && (
        <div style={{ ...S.sub, marginBottom: 12 }}>
          {tbn('settings.lastUpdated', lang)}:{' '}
          {cred.updatedAt ? new Date(cred.updatedAt).toLocaleString('tr-TR') : '—'}
        </div>
      )}

      <div style={grid3}>
        <div style={S.field}>
          <label style={S.label}>{tbn('settings.apiKey', lang)}</label>
          <input
            style={S.input}
            type="password"
            disabled={!canEdit}
            value={form.apiKey}
            placeholder={cred?.apiKeyMask || ''}
            onChange={(e) => setF('apiKey', e.target.value)}
          />
          <div style={{ ...S.sub, fontSize: 11 }}>
            {cred ? tbn('settings.apiKeyStored', lang) : tbn('settings.apiKeyHint', lang)}
          </div>
        </div>
        <div style={S.field}>
          <label style={S.label}>{tbn('settings.ortam', lang)}</label>
          <select
            style={S.input}
            disabled={!canEdit}
            value={form.ortam}
            onChange={(e) => setF('ortam', e.target.value)}
          >
            <option value="test">{tbn('settings.ortam.test', lang)}</option>
            <option value="prod">{tbn('settings.ortam.prod', lang)}</option>
            <option value="mock">{tbn('settings.ortam.mock', lang)}</option>
          </select>
        </div>
        <div style={S.field}>
          <label style={S.label}>{tbn('settings.mukellefVkn', lang)}</label>
          <input
            style={S.input}
            disabled={!canEdit}
            value={form.mukellefVkn}
            onChange={(e) => setF('mukellefVkn', e.target.value)}
          />
        </div>
        <div style={S.field}>
          <label style={S.label}>{tbn('settings.entegratorVkn', lang)}</label>
          <input
            style={S.input}
            disabled={!canEdit}
            value={form.entegratorVkn}
            onChange={(e) => setF('entegratorVkn', e.target.value)}
          />
        </div>
        <div style={S.field}>
          <label style={S.label}>{tbn('settings.entegratorUnvan', lang)}</label>
          <input
            style={S.input}
            maxLength={20}
            disabled={!canEdit}
            value={form.entegratorUnvan}
            onChange={(e) => setF('entegratorUnvan', e.target.value)}
          />
          <div style={{ ...S.sub, fontSize: 11 }}>{tbn('settings.entegratorUnvanHint', lang)}</div>
        </div>
      </div>

      <h3 style={{ fontSize: 14, marginBottom: 8 }}>{tbn('settings.sifat', lang)}</h3>
      <div style={grid3}>
        <div style={S.field}>
          <label style={S.label}>{tbn('settings.sifatTip', lang)}</label>
          <select
            style={S.input}
            disabled={!canEdit}
            value={form.sifat.tip}
            onChange={(e) => setNested('sifat', 'tip', e.target.value)}
          >
            <option value="MUKELLEF">{tbn('settings.tip.mukellef', lang)}</option>
            <option value="MIRASCI">{tbn('settings.tip.mirasci', lang)}</option>
            <option value="KANUNI_TEMSILCI">{tbn('settings.tip.kanuniTemsilci', lang)}</option>
          </select>
        </div>
        <div style={S.field}>
          <label style={S.label}>{tbn('settings.adSoyadUnvan', lang)}</label>
          <input
            style={S.input}
            disabled={!canEdit}
            value={form.sifat.adSoyadUnvan}
            onChange={(e) => setNested('sifat', 'adSoyadUnvan', e.target.value)}
          />
        </div>
        <div style={S.field}>
          <label style={S.label}>{tbn('settings.eposta', lang)}</label>
          <input
            style={S.input}
            disabled={!canEdit}
            value={form.sifat.eposta}
            onChange={(e) => setNested('sifat', 'eposta', e.target.value)}
          />
        </div>
        <div style={S.field}>
          <label style={S.label}>{tbn('settings.telefon', lang)}</label>
          <input
            style={S.input}
            disabled={!canEdit}
            value={form.sifat.telefon}
            onChange={(e) => setNested('sifat', 'telefon', e.target.value)}
          />
        </div>
        <div style={S.field}>
          <label style={S.label}>{tbn('settings.tckn', lang)}</label>
          <input
            style={S.input}
            disabled={!canEdit}
            value={form.sifat.tckn}
            onChange={(e) => setNested('sifat', 'tckn', e.target.value)}
          />
        </div>
        <div style={S.field}>
          <label style={S.label}>{tbn('settings.vkn', lang)}</label>
          <input
            style={S.input}
            disabled={!canEdit}
            value={form.sifat.vkn}
            onChange={(e) => setNested('sifat', 'vkn', e.target.value)}
          />
        </div>
      </div>

      <h3 style={{ fontSize: 14, marginBottom: 8 }}>{tbn('settings.duzenleyen', lang)}</h3>
      <div style={grid3}>
        <div style={S.field}>
          <label style={S.label}>{tbn('settings.adSoyadUnvan', lang)}</label>
          <input
            style={S.input}
            disabled={!canEdit}
            value={form.duzenleyen.adSoyadUnvan}
            onChange={(e) => setNested('duzenleyen', 'adSoyadUnvan', e.target.value)}
          />
        </div>
        <div style={S.field}>
          <label style={S.label}>{tbn('settings.eposta', lang)}</label>
          <input
            style={S.input}
            disabled={!canEdit}
            value={form.duzenleyen.eposta}
            onChange={(e) => setNested('duzenleyen', 'eposta', e.target.value)}
          />
        </div>
        <div style={S.field}>
          <label style={S.label}>{tbn('settings.telefon', lang)}</label>
          <input
            style={S.input}
            disabled={!canEdit}
            value={form.duzenleyen.telefon}
            onChange={(e) => setNested('duzenleyen', 'telefon', e.target.value)}
          />
        </div>
        <div style={S.field}>
          <label style={S.label}>{tbn('settings.tckn', lang)}</label>
          <input
            style={S.input}
            disabled={!canEdit}
            value={form.duzenleyen.tckn}
            onChange={(e) => setNested('duzenleyen', 'tckn', e.target.value)}
          />
        </div>
        <div style={S.field}>
          <label style={S.label}>{tbn('settings.vkn', lang)}</label>
          <input
            style={S.input}
            disabled={!canEdit}
            value={form.duzenleyen.vkn}
            onChange={(e) => setNested('duzenleyen', 'vkn', e.target.value)}
          />
        </div>
      </div>

      {canEdit && (
        <div style={{ ...S.row, marginTop: 8 }}>
          <button style={S.btnPrimary} disabled={saving} onClick={save}>
            {tbn('settings.save', lang)}
          </button>
          <button style={S.btn} disabled={testing || !cred} onClick={test}>
            {tbn('settings.test', lang)}
          </button>
        </div>
      )}
    </div>
  );
}
