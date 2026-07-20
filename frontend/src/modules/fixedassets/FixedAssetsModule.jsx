/**
 * Sabit Kıymet Yönetimi modülü — kıymet kartları, amortisman koşumu (otomatik
 * yevmiye fişi), hareketler (transfer/satış/hurda) ve raporlar.
 *
 * Veri: app-state blob (kaynak-of-truth) — fixedAssets / fixedAssetMovements /
 * fixedAssetDepreciationRuns (+ fişler accJournalEntries'e yazılır). Backend'e
 * best-effort write-through: POST /v1/fixed-assets/sync (performance kalıbı).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { toast as toastApi, confirmDialog, msg as M } from '../../shared/feedback';
import { tfa } from './i18n.js';
import {
  FA_CATEGORIES,
  round2,
  monthEnd,
  computeAnnualPlan,
  computeRunLines,
  bookedAccumulated,
  generateVoucherFromDepreciationRun,
  generateVoucherFromAssetSale,
  generateVoucherFromAssetScrap,
  nextAssetCode,
} from './depreciation.js';

const fmt = (n) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(n) || 0,
  );
const todayIso = () => new Date().toISOString().slice(0, 10);
const currentPeriod = () => new Date().toISOString().slice(0, 7);

// Backend SQL aynasına best-effort yansıt (kaynak-of-truth blob; hata sessiz geçilir)
function syncFixedAssetsBackend(nextData) {
  try {
    const token =
      typeof localStorage !== 'undefined' ? localStorage.getItem('promet_access_token') : null;
    if (!token) return;
    const companyId = Number(nextData?.activeCompanyId) || 1;
    fetch('/v1/fixed-assets/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        companyId,
        prune: true,
        assets: nextData?.fixedAssets || [],
        movements: nextData?.fixedAssetMovements || [],
        runs: nextData?.fixedAssetDepreciationRuns || [],
      }),
    }).catch(() => {});
  } catch {
    /* no-op */
  }
}

/* ---------- küçük UI yardımcıları ---------- */
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
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    borderBottom: '2px solid #e5e5e5',
    color: '#525252',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  td: { padding: '8px 10px', borderBottom: '1px solid #f5f5f4', verticalAlign: 'middle' },
  tdNum: {
    padding: '8px 10px',
    borderBottom: '1px solid #f5f5f4',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  btn: {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid #d4d4d4',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  btnPrimary: {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid #dc2626',
    background: '#dc2626',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  btnSm: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #d4d4d4',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 12,
  },
  input: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #d4d4d4',
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box',
  },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#525252', marginBottom: 4 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 },
  badge: (color, bg) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    color,
    background: bg,
  }),
};

const STATUS_STYLE = {
  active: { color: '#15803d', bg: '#dcfce7' },
  sold: { color: '#b45309', bg: '#fef3c7' },
  scrapped: { color: '#b91c1c', bg: '#fee2e2' },
  inactive: { color: '#525252', bg: '#f5f5f4' },
};

function Modal({ title, onClose, children, width = 640 }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '40px 16px',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '100%',
          maxWidth: width,
          padding: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
          <button
            style={{ ...S.btnSm, border: 'none', fontSize: 16 }}
            onClick={onClose}
            aria-label="close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Kıymet kartı formu ---------- */
function AssetFormModal({ asset, assets, accounts, data, lang, EntitySelect, onSave, onClose }) {
  const isNew = !asset?.id;
  const [f, setF] = useState(
    () =>
      asset || {
        code: nextAssetCode(assets),
        name: '',
        category: 'demirbas',
        location: '',
        departmentId: '',
        employeeId: '',
        acquisitionDate: todayIso(),
        acquisitionCost: '',
        usefulLifeYears: 5,
        method: 'normal',
        isPassengerCar: false,
        salvageValue: 0,
        openingAccumulated: 0,
        assetAccountCode: '255',
        accumAccountCode: '257',
        expenseAccountCode: '770',
        status: 'active',
        notes: '',
      },
  );
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const applyCategory = (cat) => {
    const c = FA_CATEGORIES[cat] || FA_CATEGORIES.diger;
    setF((p) => ({
      ...p,
      category: cat,
      usefulLifeYears: c.life,
      isPassengerCar: c.kist,
      assetAccountCode: c.asset,
      accumAccountCode: c.accum,
      expenseAccountCode: c.expense,
    }));
  };

  const txnAccounts = useMemo(
    () => (accounts || []).filter((a) => a.allowTransaction !== false && a.active !== false),
    [accounts],
  );
  const accSelect = (field, filterPrefix) => (
    <EntitySelect
      value={f[field]}
      onChange={(id) => set(field, id)}
      items={
        filterPrefix
          ? txnAccounts.filter((a) => filterPrefix.some((p) => a.code.startsWith(p)))
          : txnAccounts
      }
      getId={(a) => a.code}
      getLabel={(a) => a.name}
      getCode={(a) => a.code}
      placeholder={tfa('common.select', lang)}
      lang={lang}
    />
  );

  const depreciable = (Number(f.usefulLifeYears) || 0) > 0;
  const submit = () => {
    if (!String(f.name).trim()) return toastApi.warning(tfa('err.nameRequired', lang));
    if (!f.acquisitionDate) return toastApi.warning(tfa('err.dateRequired', lang));
    if (!(Number(f.acquisitionCost) > 0)) return toastApi.warning(tfa('err.costPositive', lang));
    if (depreciable && (!f.assetAccountCode || !f.accumAccountCode || !f.expenseAccountCode)) {
      return toastApi.warning(tfa('err.accountsRequired', lang));
    }
    onSave({
      ...f,
      acquisitionCost: round2(f.acquisitionCost),
      salvageValue: round2(f.salvageValue),
      openingAccumulated: round2(f.openingAccumulated),
      usefulLifeYears: Number(f.usefulLifeYears) || 0,
    });
  };

  return (
    <Modal
      title={isNew ? tfa('cards.newTitle', lang) : tfa('cards.editTitle', lang)}
      onClose={onClose}
      width={720}
    >
      <div style={S.row2}>
        <div>
          <label style={S.label}>{tfa('field.code', lang)}</label>
          <input style={S.input} value={f.code} onChange={(e) => set('code', e.target.value)} />
        </div>
        <div>
          <label style={S.label}>{tfa('field.name', lang)} *</label>
          <input style={S.input} value={f.name} onChange={(e) => set('name', e.target.value)} />
        </div>
      </div>
      <div style={S.row2}>
        <div>
          <label style={S.label}>{tfa('field.category', lang)}</label>
          <select
            style={S.input}
            value={f.category}
            onChange={(e) => applyCategory(e.target.value)}
          >
            {Object.keys(FA_CATEGORIES).map((c) => (
              <option key={c} value={c}>
                {tfa(`cat.${c}`, lang)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={S.label}>{tfa('field.acquisitionDate', lang)} *</label>
          <input
            type="date"
            style={S.input}
            value={f.acquisitionDate}
            onChange={(e) => set('acquisitionDate', e.target.value)}
          />
        </div>
      </div>
      <div style={S.row2}>
        <div>
          <label style={S.label}>{tfa('field.acquisitionCost', lang)} *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            style={S.input}
            value={f.acquisitionCost}
            onChange={(e) => set('acquisitionCost', e.target.value)}
          />
        </div>
        <div>
          <label style={S.label}>{tfa('field.usefulLife', lang)}</label>
          <input
            type="number"
            min="0"
            step="1"
            style={S.input}
            value={f.usefulLifeYears}
            onChange={(e) => set('usefulLifeYears', e.target.value)}
          />
        </div>
      </div>
      <div style={S.row2}>
        <div>
          <label style={S.label}>{tfa('field.method', lang)}</label>
          <select style={S.input} value={f.method} onChange={(e) => set('method', e.target.value)}>
            <option value="normal">{tfa('method.normal', lang)}</option>
            <option value="declining">{tfa('method.declining', lang)}</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
          <label
            style={{
              fontSize: 13,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={!!f.isPassengerCar}
              onChange={(e) => set('isPassengerCar', e.target.checked)}
            />
            {tfa('field.isPassengerCar', lang)}
          </label>
        </div>
      </div>
      <div style={S.row2}>
        <div>
          <label style={S.label}>{tfa('field.salvageValue', lang)}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            style={S.input}
            value={f.salvageValue}
            onChange={(e) => set('salvageValue', e.target.value)}
          />
        </div>
        <div>
          <label style={S.label}>{tfa('field.openingAccumulated', lang)}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            style={S.input}
            value={f.openingAccumulated}
            onChange={(e) => set('openingAccumulated', e.target.value)}
          />
        </div>
      </div>
      {depreciable && (
        <>
          <div style={S.row2}>
            <div>
              <label style={S.label}>{tfa('field.assetAccount', lang)}</label>
              {accSelect('assetAccountCode', ['25', '26'])}
            </div>
            <div>
              <label style={S.label}>{tfa('field.accumAccount', lang)}</label>
              {accSelect('accumAccountCode', ['257', '268', '299'])}
            </div>
          </div>
          <div style={S.row2}>
            <div>
              <label style={S.label}>{tfa('field.expenseAccount', lang)}</label>
              {accSelect('expenseAccountCode', ['7'])}
            </div>
            <div />
          </div>
        </>
      )}
      <div style={S.row2}>
        <div>
          <label style={S.label}>{tfa('field.department', lang)}</label>
          <EntitySelect
            value={f.departmentId}
            onChange={(id) => set('departmentId', id)}
            items={data.hrDepartments || []}
            getId={(d) => d.id}
            getLabel={(d) => d.name}
            placeholder={tfa('common.select', lang)}
            lang={lang}
            createType="department"
          />
        </div>
        <div>
          <label style={S.label}>{tfa('field.employee', lang)}</label>
          <EntitySelect
            value={f.employeeId}
            onChange={(id) => set('employeeId', id)}
            items={(data.hrEmployees || []).filter(
              (e) => e.status === 'active' || e.status === 'probation',
            )}
            getId={(e) => e.id}
            getLabel={(e) => `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || e.id}
            placeholder={tfa('common.select', lang)}
            lang={lang}
          />
        </div>
      </div>
      <div style={S.row2}>
        <div>
          <label style={S.label}>{tfa('field.location', lang)}</label>
          <input
            style={S.input}
            value={f.location}
            onChange={(e) => set('location', e.target.value)}
          />
        </div>
        <div>
          <label style={S.label}>{tfa('common.notes', lang)}</label>
          <input style={S.input} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button style={S.btn} onClick={onClose}>
          {tfa('common.cancel', lang)}
        </button>
        <button style={S.btnPrimary} onClick={submit}>
          {tfa('common.save', lang)}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Hareket formu ---------- */
function MovementFormModal({ assets, runs, accounts, lang, EntitySelect, onSave, onClose }) {
  const [f, setF] = useState({
    type: 'transfer',
    assetId: '',
    date: todayIso(),
    amount: '',
    vatRate: 20,
    counterAccountCode: '136',
    toLocation: '',
    notes: '',
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const asset = assets.find((a) => a.id === f.assetId);
  const accumulated = asset ? bookedAccumulated(asset, runs) : 0;
  const nbv = asset ? round2(asset.acquisitionCost - accumulated) : 0;
  const gainLoss = asset && f.type === 'sale' ? round2((Number(f.amount) || 0) - nbv) : 0;

  const txnAccounts = useMemo(
    () => (accounts || []).filter((a) => a.allowTransaction !== false && a.active !== false),
    [accounts],
  );

  const submit = () => {
    if (!asset) return toastApi.warning(tfa('err.assetRequired', lang));
    if (f.type === 'sale' && !(Number(f.amount) >= 0 && String(f.amount) !== ''))
      return toastApi.warning(tfa('err.priceRequired', lang));
    onSave({ ...f, amount: round2(f.amount), vatRate: Number(f.vatRate) || 0 });
  };

  return (
    <Modal title={tfa('mov.new', lang)} onClose={onClose}>
      <div style={S.row2}>
        <div>
          <label style={S.label}>{tfa('mov.type', lang)}</label>
          <select style={S.input} value={f.type} onChange={(e) => set('type', e.target.value)}>
            <option value="transfer">{tfa('mov.transfer', lang)}</option>
            <option value="sale">{tfa('mov.sale', lang)}</option>
            <option value="scrap">{tfa('mov.scrap', lang)}</option>
          </select>
        </div>
        <div>
          <label style={S.label}>{tfa('common.date', lang)}</label>
          <input
            type="date"
            style={S.input}
            value={f.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={S.label}>{tfa('mov.asset', lang)} *</label>
        <EntitySelect
          value={f.assetId}
          onChange={(id) => set('assetId', id)}
          items={assets.filter((a) => a.status === 'active')}
          getId={(a) => a.id}
          getLabel={(a) => a.name}
          getCode={(a) => a.code}
          placeholder={tfa('common.select', lang)}
          lang={lang}
        />
      </div>
      {f.type === 'sale' && (
        <>
          <div style={S.row2}>
            <div>
              <label style={S.label}>{tfa('mov.salePrice', lang)} *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                style={S.input}
                value={f.amount}
                onChange={(e) => set('amount', e.target.value)}
              />
            </div>
            <div>
              <label style={S.label}>{tfa('mov.vatRate', lang)}</label>
              <input
                type="number"
                min="0"
                step="1"
                style={S.input}
                value={f.vatRate}
                onChange={(e) => set('vatRate', e.target.value)}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={S.label}>{tfa('mov.counterAccount', lang)}</label>
            <EntitySelect
              value={f.counterAccountCode}
              onChange={(id) => set('counterAccountCode', id)}
              items={txnAccounts}
              getId={(a) => a.code}
              getLabel={(a) => a.name}
              getCode={(a) => a.code}
              placeholder={tfa('common.select', lang)}
              lang={lang}
            />
          </div>
          {asset && (
            <div
              style={{
                background: '#fafaf9',
                border: '1px solid #e7e5e4',
                borderRadius: 8,
                padding: 12,
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              <div>
                {tfa('field.nbv', lang)}: <b>{fmt(nbv)}</b> ({tfa('field.accumulated', lang)}:{' '}
                {fmt(accumulated)})
              </div>
              <div style={{ marginTop: 4 }}>
                {tfa('mov.gainLoss', lang)}:{' '}
                <b style={{ color: gainLoss >= 0 ? '#15803d' : '#b91c1c' }}>{fmt(gainLoss)}</b>
              </div>
            </div>
          )}
        </>
      )}
      {f.type === 'transfer' && (
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>{tfa('mov.toLocation', lang)}</label>
          <input
            style={S.input}
            value={f.toLocation}
            onChange={(e) => set('toLocation', e.target.value)}
          />
        </div>
      )}
      {f.type === 'scrap' && asset && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: 12,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {tfa('mov.scrapConfirm', lang)} — {tfa('field.nbv', lang)}: <b>{fmt(nbv)}</b>
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <label style={S.label}>{tfa('common.notes', lang)}</label>
        <input style={S.input} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button style={S.btn} onClick={onClose}>
          {tfa('common.cancel', lang)}
        </button>
        <button style={S.btnPrimary} onClick={submit}>
          {tfa('common.save', lang)}
        </button>
      </div>
    </Modal>
  );
}

/* ==================== ANA MODÜL ==================== */
export default function FixedAssetsModule({
  data,
  session,
  users = [],
  canAct,
  lang,
  onChange,
  logAudit = () => {},
  notify = () => {},
  initialView = 'fa_cards',
  EntitySelect,
}) {
  const [view, setView] = useState(initialView);
  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const assets = data.fixedAssets || [];
  const movements = data.fixedAssetMovements || [];
  const runs = data.fixedAssetDepreciationRuns || [];
  const accounts = data.accChartOfAccounts || [];
  const entries = data.accJournalEntries || [];
  const me = session?.username || session?.name || '';

  const save = (patch) => {
    const next = { ...data, ...patch };
    onChange(next);
    syncFixedAssetsBackend(next);
  };

  // Kartlar sekmesi state
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingAsset, setEditingAsset] = useState(null); // null | {} (yeni) | asset
  // Amortisman sekmesi state
  const [period, setPeriod] = useState(currentPeriod());
  const [previewLines, setPreviewLines] = useState(null);
  const [planAssetId, setPlanAssetId] = useState('');
  // Hareket sekmesi state
  const [movementOpen, setMovementOpen] = useState(false);

  const filteredAssets = useMemo(() => {
    const needle = q.toLocaleLowerCase('tr');
    return assets.filter(
      (a) =>
        (!statusFilter || a.status === statusFilter) &&
        (!needle || `${a.code} ${a.name}`.toLocaleLowerCase('tr').includes(needle)),
    );
  }, [assets, q, statusFilter]);

  /* ---- kart CRUD ---- */
  const saveAsset = (form) => {
    let next;
    if (form.id) {
      next = assets.map((a) =>
        a.id === form.id
          ? { ...a, ...form, updatedAt: new Date().toISOString(), updatedBy: me }
          : a,
      );
      toastApi.success(M.crud.updated(form.name));
    } else {
      const rec = {
        ...form,
        id: 'fa_' + Date.now(),
        createdAt: new Date().toISOString(),
        createdBy: me,
      };
      next = [...assets, rec];
      toastApi.success(M.crud.created(rec.name));
    }
    save({ fixedAssets: next });
    logAudit('fixedasset_card_save', { name: form.name });
    setEditingAsset(null);
  };

  const deleteAsset = async (a) => {
    const reasons = [];
    if (runs.some((r) => (r.lines || []).some((l) => l.assetId === a.id)))
      reasons.push(tfa('cards.deleteBlockedRuns', lang));
    if (movements.some((m) => m.assetId === a.id))
      reasons.push(tfa('cards.deleteBlockedMovements', lang));
    if (reasons.length) return toastApi.error(M.crud.cannotDelete(a.name, reasons));
    if (!(await confirmDialog(M.crud.deleteConfirm(a.name)))) return;
    save({ fixedAssets: assets.filter((x) => x.id !== a.id) });
    toastApi.success(M.crud.deleted(a.name));
    logAudit('fixedasset_card_delete', { name: a.name });
  };

  /* ---- amortisman koşumu ---- */
  const doPreview = () => setPreviewLines(computeRunLines(period, assets, runs));

  const runAndPost = async () => {
    const lines = computeRunLines(period, assets, runs);
    if (!lines.length) return toastApi.info(tfa('dep.noLines', lang));
    const runId = 'far_' + Date.now();
    const gen = generateVoucherFromDepreciationRun({
      period,
      runId,
      runLines: lines,
      accounts,
      entries,
      createdBy: me,
    });
    if (!gen.success) {
      return toastApi.error(
        `${tfa('err.voucherFailed', lang)}${gen.accountCode ? ` (${gen.accountCode})` : ''}`,
      );
    }
    const total = round2(lines.reduce((s, l) => s + l.amount, 0));
    const run = {
      id: runId,
      periodStart: period,
      periodEnd: period,
      runDate: todayIso(),
      lines,
      total,
      journalEntryId: gen.voucher.id,
      voucherNo: gen.voucher.voucherNo,
      status: 'posted',
      createdAt: new Date().toISOString(),
      createdBy: me,
    };
    save({
      fixedAssetDepreciationRuns: [...runs, run],
      accJournalEntries: [...entries, gen.voucher],
    });
    toastApi.success(
      `${tfa('dep.voucherCreated', lang)} — ${gen.voucher.voucherNo} (${fmt(total)})`,
    );
    logAudit('fixedasset_depreciation_run', { period, total, voucherNo: gen.voucher.voucherNo });
    setPreviewLines(null);
  };

  const deleteRun = async (r) => {
    const latest = [...runs]
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
      .pop();
    if (!latest || latest.id !== r.id)
      return toastApi.warning(tfa('dep.onlyLatestDeletable', lang));
    if (
      !(await confirmDialog({
        title: tfa('common.delete', lang) + '?',
        message: tfa('dep.deleteRunConfirm', lang),
        tone: 'danger',
      }))
    )
      return;
    save({
      fixedAssetDepreciationRuns: runs.filter((x) => x.id !== r.id),
      accJournalEntries: entries.filter((e) => e.id !== r.journalEntryId),
    });
    toastApi.success(M.crud.deleted(r.voucherNo || r.id));
    logAudit('fixedasset_depreciation_run_delete', { period: r.periodEnd, voucherNo: r.voucherNo });
  };

  /* ---- hareketler ---- */
  const saveMovement = (form) => {
    const asset = assets.find((a) => a.id === form.assetId);
    if (!asset) return;
    const mov = {
      ...form,
      id: 'fam_' + Date.now(),
      createdAt: new Date().toISOString(),
      createdBy: me,
    };
    let assetPatch = null;
    let voucher = null;

    if (form.type === 'sale' || form.type === 'scrap') {
      const accumulated = bookedAccumulated(asset, runs);
      const gen =
        form.type === 'sale'
          ? generateVoucherFromAssetSale({
              asset,
              movement: mov,
              accumulated,
              accounts,
              entries,
              createdBy: me,
            })
          : generateVoucherFromAssetScrap({
              asset,
              movement: mov,
              accumulated,
              accounts,
              entries,
              createdBy: me,
            });
      if (!gen.success) {
        return toastApi.error(
          `${tfa('err.voucherFailed', lang)}${gen.accountCode ? ` (${gen.accountCode})` : ''}`,
        );
      }
      voucher = gen.voucher;
      mov.journalEntryId = voucher.id;
      if (form.type === 'sale') mov.gainLoss = gen.gainLoss;
      assetPatch = {
        status: form.type === 'sale' ? 'sold' : 'scrapped',
        disposalDate: form.date,
        disposalAmount: form.type === 'sale' ? mov.amount : 0,
        disposalJournalEntryId: voucher.id,
      };
    } else if (form.type === 'transfer') {
      mov.fromLocation = asset.location || '';
      assetPatch = { location: form.toLocation || asset.location };
    }

    save({
      fixedAssetMovements: [...movements, mov],
      ...(assetPatch
        ? {
            fixedAssets: assets.map((a) =>
              a.id === asset.id
                ? { ...a, ...assetPatch, updatedAt: new Date().toISOString(), updatedBy: me }
                : a,
            ),
          }
        : {}),
      ...(voucher ? { accJournalEntries: [...entries, voucher] } : {}),
    });
    toastApi.success(
      tfa(
        form.type === 'sale'
          ? 'mov.saleDone'
          : form.type === 'scrap'
            ? 'mov.scrapDone'
            : 'mov.transferDone',
        lang,
      ),
    );
    logAudit('fixedasset_movement', { type: form.type, asset: asset.name });
    setMovementOpen(false);
  };

  const deleteMovement = async (m) => {
    if (m.type !== 'transfer') return toastApi.warning(tfa('mov.onlyTransferDeletable', lang));
    if (!(await confirmDialog(M.crud.deleteConfirm(tfa('mov.transfer', lang))))) return;
    save({ fixedAssetMovements: movements.filter((x) => x.id !== m.id) });
    toastApi.success(M.crud.deleted(tfa('mov.transfer', lang)));
  };

  /* ---- raporlar ---- */
  const summary = useMemo(() => {
    const act = assets.filter((a) => a.status === 'active');
    const cost = round2(act.reduce((s, a) => s + (Number(a.acquisitionCost) || 0), 0));
    const accum = round2(act.reduce((s, a) => s + bookedAccumulated(a, runs), 0));
    return { count: act.length, cost, accum, nbv: round2(cost - accum) };
  }, [assets, runs]);

  const byCategory = useMemo(() => {
    const map = {};
    assets
      .filter((a) => a.status === 'active')
      .forEach((a) => {
        const k = a.category || 'diger';
        if (!map[k]) map[k] = { count: 0, cost: 0, accum: 0 };
        map[k].count += 1;
        map[k].cost = round2(map[k].cost + (Number(a.acquisitionCost) || 0));
        map[k].accum = round2(map[k].accum + bookedAccumulated(a, runs));
      });
    return map;
  }, [assets, runs]);

  const exportCsv = () => {
    const head = [
      'code',
      'name',
      'category',
      'acquisitionDate',
      'acquisitionCost',
      'usefulLife',
      'method',
      'accumulated',
      'nbv',
      'status',
    ];
    const rows = assets.map((a) => {
      const accum = bookedAccumulated(a, runs);
      return [
        a.code,
        a.name,
        tfa(`cat.${a.category || 'diger'}`, lang),
        a.acquisitionDate,
        a.acquisitionCost,
        a.usefulLifeYears,
        tfa(`method.${a.method}`, lang),
        accum,
        round2((Number(a.acquisitionCost) || 0) - accum),
        tfa(`status.${a.status}`, lang),
      ];
    });
    const csv =
      '﻿' +
      [head, ...rows]
        .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
        .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `sabit-kiymet-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const planAsset = assets.find((a) => a.id === planAssetId);
  const assetById = (id) => assets.find((a) => a.id === id);

  const title =
    {
      fa_cards: 'tab.cards',
      fa_depreciation: 'tab.depreciation',
      fa_movements: 'tab.movements',
      fa_reports: 'tab.reports',
    }[view] || 'tab.cards';

  return (
    <div style={S.page}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1 style={S.h1}>
            {tfa('module.title', lang)} — {tfa(title, lang)}
          </h1>
          <div style={S.sub}>{view === 'fa_depreciation' ? tfa('dep.periodHint', lang) : null}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {view === 'fa_cards' && canAct('fixedassets.cards.create') && (
            <button style={S.btnPrimary} onClick={() => setEditingAsset({})}>
              + {tfa('cards.new', lang)}
            </button>
          )}
          {view === 'fa_movements' && canAct('fixedassets.movements.create') && (
            <button style={S.btnPrimary} onClick={() => setMovementOpen(true)}>
              + {tfa('mov.new', lang)}
            </button>
          )}
          {view === 'fa_reports' && canAct('fixedassets.reports.export') && (
            <button style={S.btn} onClick={exportCsv}>
              {tfa('rep.exportCsv', lang)}
            </button>
          )}
        </div>
      </div>

      {/* ============ KIYMET KARTLARI ============ */}
      {view === 'fa_cards' && (
        <div style={S.card}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input
              style={{ ...S.input, width: 260 }}
              placeholder={tfa('common.search', lang)}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              style={{ ...S.input, width: 180 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">{tfa('common.all', lang)}</option>
              {['active', 'sold', 'scrapped', 'inactive'].map((s) => (
                <option key={s} value={s}>
                  {tfa(`status.${s}`, lang)}
                </option>
              ))}
            </select>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>{tfa('field.code', lang)}</th>
                  <th style={S.th}>{tfa('field.name', lang)}</th>
                  <th style={S.th}>{tfa('field.category', lang)}</th>
                  <th style={S.th}>{tfa('field.acquisitionDate', lang)}</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>{tfa('rep.totalCost', lang)}</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>{tfa('field.accumulated', lang)}</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>{tfa('field.nbv', lang)}</th>
                  <th style={S.th}>{tfa('field.status', lang)}</th>
                  <th style={S.th}>{tfa('common.actions', lang)}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.length === 0 && (
                  <tr>
                    <td style={S.td} colSpan={9}>
                      {tfa('common.empty', lang)}
                    </td>
                  </tr>
                )}
                {filteredAssets.map((a) => {
                  const accum = bookedAccumulated(a, runs);
                  const st = STATUS_STYLE[a.status] || STATUS_STYLE.inactive;
                  return (
                    <tr key={a.id}>
                      <td style={S.td}>{a.code}</td>
                      <td style={S.td}>
                        <b>{a.name}</b>
                        {a.isPassengerCar ? ' 🚗' : ''}
                      </td>
                      <td style={S.td}>{tfa(`cat.${a.category || 'diger'}`, lang)}</td>
                      <td style={S.td}>{a.acquisitionDate}</td>
                      <td style={S.tdNum}>{fmt(a.acquisitionCost)}</td>
                      <td style={S.tdNum}>{fmt(accum)}</td>
                      <td style={S.tdNum}>{fmt((Number(a.acquisitionCost) || 0) - accum)}</td>
                      <td style={S.td}>
                        <span style={S.badge(st.color, st.bg)}>
                          {tfa(`status.${a.status}`, lang)}
                        </span>
                      </td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {canAct('fixedassets.cards.update') && (
                            <button style={S.btnSm} onClick={() => setEditingAsset(a)}>
                              {tfa('common.edit', lang)}
                            </button>
                          )}
                          {canAct('fixedassets.cards.delete') && (
                            <button
                              style={{ ...S.btnSm, color: '#b91c1c' }}
                              onClick={() => deleteAsset(a)}
                            >
                              {tfa('common.delete', lang)}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ AMORTİSMAN ============ */}
      {view === 'fa_depreciation' && (
        <>
          <div style={S.card}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>{tfa('dep.runPanel', lang)}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={S.label}>{tfa('dep.period', lang)}</label>
                <input
                  type="month"
                  style={{ ...S.input, width: 180 }}
                  value={period}
                  onChange={(e) => {
                    setPeriod(e.target.value);
                    setPreviewLines(null);
                  }}
                />
              </div>
              <button style={S.btn} onClick={doPreview}>
                {tfa('dep.preview', lang)}
              </button>
              {canAct('fixedassets.depreciation.create') && (
                <button style={S.btnPrimary} onClick={runAndPost}>
                  {tfa('dep.runAndPost', lang)}
                </button>
              )}
            </div>
            {previewLines && (
              <div style={{ marginTop: 16, overflowX: 'auto' }}>
                {previewLines.length === 0 ? (
                  <div style={{ color: '#737373', fontSize: 13 }}>{tfa('dep.noLines', lang)}</div>
                ) : (
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>{tfa('mov.asset', lang)}</th>
                        <th style={S.th}>{tfa('field.expenseAccount', lang)}</th>
                        <th style={S.th}>{tfa('field.accumAccount', lang)}</th>
                        <th style={{ ...S.th, textAlign: 'right' }}>{tfa('dep.amount', lang)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewLines.map((l) => (
                        <tr key={l.assetId}>
                          <td style={S.td}>
                            {l.assetCode} — {l.assetName}
                          </td>
                          <td style={S.td}>{l.expenseAccountCode}</td>
                          <td style={S.td}>{l.accumAccountCode}</td>
                          <td style={S.tdNum}>{fmt(l.amount)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td style={{ ...S.td, fontWeight: 700 }} colSpan={3}>
                          {tfa('common.total', lang)}
                        </td>
                        <td style={{ ...S.tdNum, fontWeight: 700 }}>
                          {fmt(previewLines.reduce((s, l) => s + l.amount, 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          <div style={S.card}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>{tfa('dep.history', lang)}</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>{tfa('dep.period', lang)}</th>
                    <th style={S.th}>{tfa('common.date', lang)}</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>{tfa('dep.lineCount', lang)}</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>{tfa('common.total', lang)}</th>
                    <th style={S.th}>{tfa('dep.voucherNo', lang)}</th>
                    <th style={S.th}>{tfa('common.actions', lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.length === 0 && (
                    <tr>
                      <td style={S.td} colSpan={6}>
                        {tfa('common.empty', lang)}
                      </td>
                    </tr>
                  )}
                  {[...runs]
                    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
                    .map((r) => (
                      <tr key={r.id}>
                        <td style={S.td}>{r.periodEnd}</td>
                        <td style={S.td}>{r.runDate}</td>
                        <td style={S.tdNum}>{(r.lines || []).length}</td>
                        <td style={S.tdNum}>{fmt(r.total)}</td>
                        <td style={S.td}>{r.voucherNo}</td>
                        <td style={S.td}>
                          {canAct('fixedassets.depreciation.delete') && (
                            <button
                              style={{ ...S.btnSm, color: '#b91c1c' }}
                              onClick={() => deleteRun(r)}
                            >
                              {tfa('common.delete', lang)}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={S.card}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>{tfa('dep.planViewer', lang)}</div>
            <div style={{ maxWidth: 420, marginBottom: 12 }}>
              <EntitySelect
                value={planAssetId}
                onChange={(id) => setPlanAssetId(id)}
                items={assets}
                getId={(a) => a.id}
                getLabel={(a) => a.name}
                getCode={(a) => a.code}
                placeholder={tfa('common.select', lang)}
                lang={lang}
              />
            </div>
            {planAsset && (
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>{tfa('dep.planYear', lang)}</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>{tfa('dep.planAnnual', lang)}</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>{tfa('dep.planAccum', lang)}</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>{tfa('dep.planNbv', lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computeAnnualPlan(planAsset).map((p) => (
                      <tr key={p.year}>
                        <td style={S.td}>{p.year}</td>
                        <td style={S.tdNum}>{fmt(p.annual)}</td>
                        <td style={S.tdNum}>{fmt(p.accumulatedEnd)}</td>
                        <td style={S.tdNum}>{fmt(p.nbvEnd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ============ HAREKETLER ============ */}
      {view === 'fa_movements' && (
        <div style={S.card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>{tfa('common.date', lang)}</th>
                  <th style={S.th}>{tfa('mov.type', lang)}</th>
                  <th style={S.th}>{tfa('mov.asset', lang)}</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>{tfa('dep.amount', lang)}</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>{tfa('mov.gainLoss', lang)}</th>
                  <th style={S.th}>{tfa('dep.voucherNo', lang)}</th>
                  <th style={S.th}>{tfa('common.notes', lang)}</th>
                  <th style={S.th}>{tfa('common.actions', lang)}</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 && (
                  <tr>
                    <td style={S.td} colSpan={8}>
                      {tfa('common.empty', lang)}
                    </td>
                  </tr>
                )}
                {[...movements]
                  .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                  .map((m) => {
                    const a = assetById(m.assetId);
                    const voucher = entries.find((e) => e.id === m.journalEntryId);
                    return (
                      <tr key={m.id}>
                        <td style={S.td}>{m.date}</td>
                        <td style={S.td}>{tfa(`mov.${m.type}`, lang)}</td>
                        <td style={S.td}>{a ? `${a.code} — ${a.name}` : m.assetId}</td>
                        <td style={S.tdNum}>{m.type === 'sale' ? fmt(m.amount) : '—'}</td>
                        <td
                          style={{
                            ...S.tdNum,
                            color: (m.gainLoss || 0) >= 0 ? '#15803d' : '#b91c1c',
                          }}
                        >
                          {m.type === 'sale' ? fmt(m.gainLoss || 0) : '—'}
                        </td>
                        <td style={S.td}>{voucher?.voucherNo || '—'}</td>
                        <td style={S.td}>
                          {m.type === 'transfer'
                            ? `${m.fromLocation || '?'} → ${m.toLocation || '?'}`
                            : m.notes}
                        </td>
                        <td style={S.td}>
                          {canAct('fixedassets.movements.delete') && m.type === 'transfer' && (
                            <button
                              style={{ ...S.btnSm, color: '#b91c1c' }}
                              onClick={() => deleteMovement(m)}
                            >
                              {tfa('common.delete', lang)}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ RAPORLAR ============ */}
      {view === 'fa_reports' && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
              marginTop: 16,
            }}
          >
            {[
              [tfa('rep.activeCount', lang), String(summary.count)],
              [tfa('rep.totalCost', lang), fmt(summary.cost)],
              [tfa('rep.totalAccum', lang), fmt(summary.accum)],
              [tfa('rep.totalNbv', lang), fmt(summary.nbv)],
            ].map(([label, value]) => (
              <div key={label} style={{ ...S.card, marginTop: 0 }}>
                <div style={{ fontSize: 12, color: '#737373', fontWeight: 600 }}>{label}</div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    marginTop: 6,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>{tfa('rep.byCategory', lang)}</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>{tfa('field.category', lang)}</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>{tfa('rep.count', lang)}</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>{tfa('rep.totalCost', lang)}</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>{tfa('rep.totalAccum', lang)}</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>{tfa('rep.totalNbv', lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(byCategory).length === 0 && (
                    <tr>
                      <td style={S.td} colSpan={5}>
                        {tfa('common.empty', lang)}
                      </td>
                    </tr>
                  )}
                  {Object.entries(byCategory).map(([cat, v]) => (
                    <tr key={cat}>
                      <td style={S.td}>{tfa(`cat.${cat}`, lang)}</td>
                      <td style={S.tdNum}>{v.count}</td>
                      <td style={S.tdNum}>{fmt(v.cost)}</td>
                      <td style={S.tdNum}>{fmt(v.accum)}</td>
                      <td style={S.tdNum}>{fmt(v.cost - v.accum)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modallar */}
      {editingAsset !== null && (
        <AssetFormModal
          asset={editingAsset.id ? editingAsset : null}
          assets={assets}
          accounts={accounts}
          data={data}
          lang={lang}
          EntitySelect={EntitySelect}
          onSave={saveAsset}
          onClose={() => setEditingAsset(null)}
        />
      )}
      {movementOpen && (
        <MovementFormModal
          assets={assets}
          runs={runs}
          accounts={accounts}
          lang={lang}
          EntitySelect={EntitySelect}
          onSave={saveMovement}
          onClose={() => setMovementOpen(false)}
        />
      )}
    </div>
  );
}
