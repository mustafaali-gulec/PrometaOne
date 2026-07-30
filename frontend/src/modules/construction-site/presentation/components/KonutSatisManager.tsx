/**
 * KonutSatisManager — Konut Satış ekranı (FAZ 10).
 *
 * Envanter tablosu projenin TÜM dairelerini gösterir — satışsız daire
 * 'available' (Satışta) olarak TÜRETİLİR; parasal kolonları "—" basılır
 * (0 basmak "satıldı, bedava" okunur). Satılan ve iş karşılığı verilen
 * özette AYRI durur: barter nakit girişi değildir, taşeron mahsubudur.
 *
 * Liste fiyatı iki yerde yaşar ve arayüz bunu saklamaz: DEFTER (boş daire
 * satılırken donacak değer, tabloda kalem ikonu ile düzenlenir) ve SATIŞA
 * DONMUŞ kopya (detay panelinde "satış anındaki liste"). Defter sonradan
 * değişse tarihi iskonto oynamaz.
 *
 * İptal gerekçesi ve red gerekçesi YEREL olarak da zorunlu tutulur —
 * kullanıcı kuralı 400 ile öğrenmesin. Onaylı değişiklik bedeli düzenlenemez
 * (yalnız open'da kalem görünür); ipucu nedenini söyler.
 */
import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

import type {
  ProjectSalesSummaryDto,
  UnitInventoryRowDto,
  UnitSaleDetailDto,
  UnitSaleStatus,
} from '../../application/dto/ConstructionDtos';
import type { ConstructionApi } from '../../application/ports/ConstructionApi';
import {
  changeRequestStatusLabel,
  csT,
  unitPaymentKindLabel,
  unitPaymentMethodLabel,
  unitSaleStatusLabel,
} from '../../i18n';
import { useProjects } from '../hooks/useProjects';

export interface KonutSatisManagerProps {
  api: ConstructionApi;
  companyId: number;
  lang?: string | undefined;
  canCreate?: boolean | undefined;
  confirmAsync?: ((message: string) => Promise<boolean>) | undefined;
}

const box: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: 12,
  background: '#fff',
};
const label: CSSProperties = { fontSize: 12, color: '#64748b', display: 'block', marginBottom: 2 };
const input: CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 13,
  boxSizing: 'border-box',
};
const btn: CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  background: '#f8fafc',
  cursor: 'pointer',
  fontSize: 12,
};
const btnPrimary: CSSProperties = {
  ...btn,
  background: '#2563eb',
  borderColor: '#2563eb',
  color: '#fff',
};
const btnDanger: CSSProperties = {
  ...btn,
  background: '#fef2f2',
  borderColor: '#fca5a5',
  color: '#b91c1c',
};
const errBox: CSSProperties = {
  border: '1px solid #fca5a5',
  background: '#fef2f2',
  color: '#b91c1c',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 13,
};
const infoBox: CSSProperties = {
  ...errBox,
  border: '1px solid #bae6fd',
  background: '#f0f9ff',
  color: '#0369a1',
};
const warnBox: CSSProperties = {
  ...errBox,
  border: '1px solid #fcd34d',
  background: '#fffbeb',
  color: '#b45309',
};
const th: CSSProperties = {
  padding: '5px 7px',
  fontSize: 11,
  color: '#334155',
  background: '#f8fafc',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid #e2e8f0',
  fontWeight: 600,
};
const td: CSSProperties = {
  padding: '5px 7px',
  fontSize: 12,
  borderTop: '1px solid #f1f5f9',
  textAlign: 'left',
};

const ST_COLOR: Record<string, string> = {
  available: '#0369a1',
  reserved: '#b45309',
  sold: '#15803d',
  barter: '#7c3aed',
  cancelled: '#94a3b8',
};
const CR_COLOR: Record<string, string> = {
  open: '#b45309',
  approved: '#0369a1',
  rejected: '#94a3b8',
  done: '#15803d',
};

const money = (v: number): string => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
const opt = (v: number | null): string => (v === null ? '—' : money(v));

function StatusBadge({ status, lang }: { status: string; lang: string | undefined }): JSX.Element {
  const c = ST_COLOR[status] ?? '#334155';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        color: c,
        border: `1px solid ${c}55`,
        background: `${c}11`,
        whiteSpace: 'nowrap',
      }}
    >
      {unitSaleStatusLabel(status, lang)}
    </span>
  );
}

export function KonutSatisManager({
  api,
  companyId,
  lang,
  canCreate = true,
  confirmAsync,
}: KonutSatisManagerProps): JSX.Element {
  const { projects } = useProjects(api, companyId);
  const [projectId, setProjectId] = useState(0);
  const [units, setUnits] = useState<ReadonlyArray<UnitInventoryRowDto>>([]);
  const [summary, setSummary] = useState<ProjectSalesSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<UnitInventoryRowDto | null>(null);
  const [detail, setDetail] = useState<UnitSaleDetailDto | null>(null);
  /** Liste fiyatı düzenlenen daire + taslak değer. */
  const [pricing, setPricing] = useState<{ locationId: number; value: string } | null>(null);

  const t = useCallback(
    (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>) => csT(k, lang, vars),
    [lang],
  );

  const confirm = useCallback(
    async (msg: string): Promise<boolean> => {
      if (confirmAsync) return confirmAsync(msg);
      return Promise.resolve(globalThis.confirm(msg));
    },
    [confirmAsync],
  );

  const load = useCallback(async (): Promise<void> => {
    if (!(projectId > 0)) {
      setUnits([]);
      setSummary(null);
      return;
    }
    try {
      const inv = await api.getUnitInventory(projectId, companyId);
      setUnits(inv.units);
      setSummary(inv.summary);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, companyId, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = useCallback(
    async (saleId: number): Promise<void> => {
      try {
        setDetail(await api.getUnitSale(saleId, companyId));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [api, companyId],
  );

  const selectUnit = useCallback(
    (u: UnitInventoryRowDto): void => {
      setSelected(u);
      setDetail(null);
      if (u.saleId !== null) void loadDetail(u.saleId);
    },
    [loadDetail],
  );

  const refreshAll = useCallback(async (): Promise<void> => {
    await load();
    if (selected?.saleId != null) await loadDetail(selected.saleId);
  }, [load, loadDetail, selected]);

  /**
   * Satış OLUŞTUKTAN sonra: seçili daire envanterden tazelenir ki form yerini
   * detay paneline bıraksın. Genel load() seçimi bilerek tazelemez — iptal
   * sonrası panel açık kalmalı ki iade oradan girilebilsin (iade tam da
   * iptalden sonra olur).
   */
  const handleCreated = useCallback(async (): Promise<void> => {
    if (!(projectId > 0)) return;
    try {
      const inv = await api.getUnitInventory(projectId, companyId);
      setUnits(inv.units);
      setSummary(inv.summary);
      setSelected((prev) => {
        if (prev === null) return null;
        const fresh = inv.units.find((x) => x.locationId === prev.locationId) ?? null;
        if (fresh?.saleId != null) void loadDetail(fresh.saleId);
        return fresh;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, companyId, loadDetail, projectId]);

  const savePrice = useCallback(async (): Promise<void> => {
    if (pricing === null) return;
    const v = Number(pricing.value);
    if (!Number.isFinite(v) || v < 0) return;
    try {
      await api.setUnitListPrice(pricing.locationId, { companyId, listPrice: v });
      setPricing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, companyId, load, pricing]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>{t('cs.us.title')}</h2>
          <div style={{ fontSize: 12, color: '#64748b', maxWidth: 720 }}>{t('cs.us.subtitle')}</div>
        </div>
        <div style={{ marginLeft: 'auto', minWidth: 220 }}>
          <span style={label}>{t('cs.common.project')}</span>
          <select
            style={input}
            value={projectId}
            onChange={(e) => {
              setProjectId(Number(e.target.value));
              setSelected(null);
              setDetail(null);
            }}
          >
            <option value={0}>{t('cs.common.selectProject')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button style={btn} onClick={() => void refreshAll()}>
          {t('cs.common.refresh')}
        </button>
      </div>

      {error !== null && <div style={errBox}>{error}</div>}

      {projectId > 0 && summary !== null && <SummaryCards summary={summary} t={t} />}

      {projectId > 0 && units.length === 0 && <div style={infoBox}>{t('cs.us.empty')}</div>}

      {units.length > 0 && (
        <div style={{ ...box, padding: 0, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={th}>{t('cs.us.f.unit')}</th>
                <th style={th}>{t('cs.us.f.type')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('cs.us.f.area')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('cs.us.f.listPrice')}</th>
                <th style={th}>{t('cs.common.status')}</th>
                <th style={th}>{t('cs.us.f.buyer')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('cs.us.f.salePrice')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('cs.us.f.discount')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('cs.us.f.collected')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('cs.us.f.remaining')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('cs.us.f.openCr')}</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => {
                const isSel = selected?.locationId === u.locationId;
                return (
                  <tr
                    key={u.locationId}
                    onClick={() => {
                      selectUnit(u);
                    }}
                    style={{ cursor: 'pointer', background: isSel ? '#eff6ff' : undefined }}
                  >
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{u.path}</td>
                    <td style={td}>{u.unitType ?? '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{opt(u.grossArea)}</td>
                    <td
                      style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      {pricing?.locationId === u.locationId ? (
                        <span style={{ display: 'inline-flex', gap: 4 }}>
                          <input
                            style={{ ...input, width: 110, padding: '2px 6px' }}
                            type="number"
                            min={0}
                            value={pricing.value}
                            onChange={(e) => {
                              setPricing({ locationId: u.locationId, value: e.target.value });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void savePrice();
                              if (e.key === 'Escape') setPricing(null);
                            }}
                          />
                          <button style={btnPrimary} onClick={() => void savePrice()}>
                            ✓
                          </button>
                        </span>
                      ) : (
                        <span>
                          {opt(u.bookListPrice)}{' '}
                          {canCreate && (
                            <button
                              style={{ ...btn, padding: '0 5px' }}
                              title={`${t('cs.us.price.edit')} — ${t('cs.us.price.hint')}`}
                              onClick={() => {
                                setPricing({
                                  locationId: u.locationId,
                                  value: u.bookListPrice === null ? '' : String(u.bookListPrice),
                                });
                              }}
                            >
                              ✎
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                    <td style={td}>
                      <StatusBadge status={u.saleStatus} lang={lang} />
                    </td>
                    <td style={td}>
                      {u.buyerName ?? (u.vendorId !== null ? `#${String(u.vendorId)}` : '—')}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{opt(u.salePrice)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{opt(u.discount)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{opt(u.collected)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>
                      {opt(u.remaining)}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {u.openChangeRequests > 0 ? u.openChangeRequests : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected !== null && selected.saleId === null && canCreate && (
        <NewSaleForm
          key={selected.locationId}
          api={api}
          companyId={companyId}
          projectId={projectId}
          unit={selected}
          lang={lang}
          t={t}
          onError={setError}
          onSaved={() => void handleCreated()}
        />
      )}

      {detail !== null && (
        <SaleDetailPanel
          api={api}
          companyId={companyId}
          detail={detail}
          unit={selected}
          lang={lang}
          t={t}
          canCreate={canCreate}
          confirm={confirm}
          onError={setError}
          onChanged={() => void refreshAll()}
        />
      )}
    </div>
  );
}

// ===== ÖZET KARTLARI ========================================================

function SummaryCards({
  summary,
  t,
}: {
  summary: ProjectSalesSummaryDto;
  t: (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>) => string;
}): JSX.Element {
  const card = (title: string, value: string, color?: string): JSX.Element => (
    <div style={{ ...box, minWidth: 130, flex: '1 1 130px' }} key={title}>
      <div style={label}>{title}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color ?? '#0f172a' }}>{value}</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {card(t('cs.us.sum.units'), String(summary.unitCount))}
        {card(t('cs.us.sum.available'), String(summary.availableCount), ST_COLOR['available'])}
        {card(t('cs.us.sum.reserved'), String(summary.reservedCount), ST_COLOR['reserved'])}
        {card(t('cs.us.sum.sold'), String(summary.soldCount), ST_COLOR['sold'])}
        {card(t('cs.us.sum.barter'), String(summary.barterCount), ST_COLOR['barter'])}
        {card(t('cs.us.sum.soldValue'), money(summary.soldValue))}
        {card(t('cs.us.sum.barterValue'), money(summary.barterValue), ST_COLOR['barter'])}
        {card(t('cs.us.sum.collected'), money(summary.collectedTotal), '#15803d')}
        {card(t('cs.us.sum.remaining'), money(summary.remainingTotal), '#b45309')}
      </div>
      {summary.barterCount > 0 && <div style={infoBox}>{t('cs.us.barterInfo')}</div>}
      {summary.unpricedAvailableCount > 0 && (
        <div style={warnBox}>{t('cs.us.sum.unpriced', { n: summary.unpricedAvailableCount })}</div>
      )}
      {summary.refundLiability > 0 && (
        <div style={warnBox}>
          {t('cs.us.sum.refundLiability')}: {money(summary.refundLiability)}
        </div>
      )}
    </div>
  );
}

// ===== YENİ SATIŞ FORMU =====================================================

function NewSaleForm({
  api,
  companyId,
  projectId,
  unit,
  lang,
  t,
  onError,
  onSaved,
}: {
  api: ConstructionApi;
  companyId: number;
  projectId: number;
  unit: UnitInventoryRowDto;
  lang: string | undefined;
  t: (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>) => string;
  onError: (msg: string | null) => void;
  onSaved: () => void;
}): JSX.Element {
  const [status, setStatus] = useState<'reserved' | 'sold' | 'barter'>('reserved');
  const [buyerName, setBuyerName] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [note, setNote] = useState('');

  const save = async (): Promise<void> => {
    const sp = Number(salePrice);
    if (!Number.isFinite(sp) || sp < 0) return;
    try {
      await api.createUnitSale({
        companyId,
        projectId,
        locationId: unit.locationId,
        status,
        buyerName: buyerName.trim() === '' ? null : buyerName.trim(),
        vendorId: vendorId.trim() === '' ? null : Number(vendorId),
        ...(listPrice.trim() === '' ? {} : { listPrice: Number(listPrice) }),
        salePrice: sp,
        note: note.trim() === '' ? null : note.trim(),
      });
      onError(null);
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={box}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
        {t('cs.us.form.new')} — {unit.path}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ minWidth: 140 }}>
          <span style={label}>{t('cs.us.form.status')}</span>
          <select
            style={input}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as 'reserved' | 'sold' | 'barter');
            }}
          >
            {(['reserved', 'sold', 'barter'] as const).map((s) => (
              <option key={s} value={s}>
                {unitSaleStatusLabel(s, lang)}
              </option>
            ))}
          </select>
        </div>
        {status !== 'barter' && (
          <div style={{ minWidth: 180 }}>
            <span style={label}>{t('cs.us.form.buyer')} *</span>
            <input
              style={input}
              value={buyerName}
              onChange={(e) => {
                setBuyerName(e.target.value);
              }}
            />
          </div>
        )}
        {status === 'barter' && (
          <div style={{ minWidth: 180 }} title={t('cs.us.form.vendorHint')}>
            <span style={label}>{t('cs.us.form.vendor')} *</span>
            <input
              style={input}
              type="number"
              value={vendorId}
              onChange={(e) => {
                setVendorId(e.target.value);
              }}
            />
          </div>
        )}
        <div style={{ minWidth: 170 }} title={t('cs.us.form.listPriceHint')}>
          <span style={label}>{t('cs.us.form.listPrice')}</span>
          <input
            style={input}
            type="number"
            min={0}
            placeholder={unit.bookListPrice === null ? '' : String(unit.bookListPrice)}
            value={listPrice}
            onChange={(e) => {
              setListPrice(e.target.value);
            }}
          />
        </div>
        <div style={{ minWidth: 150 }}>
          <span style={label}>{t('cs.us.form.salePrice')} *</span>
          <input
            style={input}
            type="number"
            min={0}
            value={salePrice}
            onChange={(e) => {
              setSalePrice(e.target.value);
            }}
          />
        </div>
        <div style={{ minWidth: 180, flex: 1 }}>
          <span style={label}>{t('cs.common.note')}</span>
          <input
            style={input}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
            }}
          />
        </div>
        <button
          style={btnPrimary}
          disabled={
            salePrice.trim() === '' ||
            (status !== 'barter' && buyerName.trim() === '') ||
            (status === 'barter' && vendorId.trim() === '')
          }
          onClick={() => void save()}
        >
          {t('cs.us.form.create')}
        </button>
      </div>
    </div>
  );
}

// ===== SATIŞ DETAY PANELİ ===================================================

function SaleDetailPanel({
  api,
  companyId,
  detail,
  unit,
  lang,
  t,
  canCreate,
  confirm,
  onError,
  onChanged,
}: {
  api: ConstructionApi;
  companyId: number;
  detail: UnitSaleDetailDto;
  unit: UnitInventoryRowDto | null;
  lang: string | undefined;
  t: (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>) => string;
  canCreate: boolean;
  confirm: (msg: string) => Promise<boolean>;
  onError: (msg: string | null) => void;
  onChanged: () => void;
}): JSX.Element {
  const sale = detail.sale;
  const [cancelNote, setCancelNote] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [barterVendor, setBarterVendor] = useState('');
  const [showBarter, setShowBarter] = useState(false);

  const transition = async (
    to: UnitSaleStatus,
    extra?: { note?: string; vendorId?: number },
  ): Promise<void> => {
    try {
      await api.changeUnitSaleStatus(sale.id, { companyId, to, ...extra });
      onError(null);
      setShowCancel(false);
      setShowBarter(false);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  const info = (title: string, value: string): JSX.Element => (
    <div key={title} style={{ minWidth: 130 }}>
      <span style={label}>{title}</span>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
    </div>
  );

  return (
    <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {t('cs.us.det.title')} — {unit?.path ?? `#${String(sale.locationId)}`}
        </div>
        <StatusBadge status={sale.status} lang={lang} />
        {sale.source === 'crm' && (
          <span style={{ fontSize: 11, color: '#64748b' }}>
            {t('cs.us.det.refNo')}: {sale.refNo ?? '—'}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {canCreate && sale.allowedTransitions.includes('sold') && (
            <button style={btnPrimary} onClick={() => void transition('sold')}>
              {t('cs.us.tr.sold')}
            </button>
          )}
          {canCreate && sale.allowedTransitions.includes('barter') && (
            <button
              style={btn}
              onClick={() => {
                setShowBarter(!showBarter);
                setShowCancel(false);
              }}
            >
              {t('cs.us.tr.barter')}
            </button>
          )}
          {canCreate && sale.allowedTransitions.includes('cancelled') && (
            <button
              style={btnDanger}
              onClick={() => {
                setShowCancel(!showCancel);
                setShowBarter(false);
              }}
            >
              {t('cs.us.tr.cancelled')}
            </button>
          )}
        </div>
      </div>

      {showBarter && (
        <div
          style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}
          title={t('cs.us.form.vendorHint')}
        >
          <div style={{ minWidth: 200 }}>
            <span style={label}>{t('cs.us.form.vendor')} *</span>
            <input
              style={input}
              type="number"
              value={barterVendor}
              onChange={(e) => {
                setBarterVendor(e.target.value);
              }}
            />
          </div>
          <button
            style={btnPrimary}
            disabled={barterVendor.trim() === ''}
            onClick={() => void transition('barter', { vendorId: Number(barterVendor) })}
          >
            {t('cs.us.tr.barter')}
          </button>
        </div>
      )}

      {showCancel && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <span style={label}>{t('cs.us.det.cancelPrompt')}</span>
            <input
              style={input}
              value={cancelNote}
              placeholder={t('cs.us.det.needNote')}
              onChange={(e) => {
                setCancelNote(e.target.value);
              }}
            />
          </div>
          <button
            style={btnDanger}
            disabled={cancelNote.trim() === ''}
            onClick={() => void transition('cancelled', { note: cancelNote.trim() })}
          >
            {t('cs.us.tr.cancelled')}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {info(
          t('cs.us.f.buyer'),
          sale.buyerName ?? (sale.vendorId !== null ? `#${String(sale.vendorId)}` : '—'),
        )}
        {info(t('cs.us.det.frozenList'), sale.listPrice > 0 ? money(sale.listPrice) : '—')}
        {info(t('cs.us.f.salePrice'), money(sale.salePrice))}
        {info(t('cs.us.f.discount'), sale.discount === null ? '—' : money(sale.discount))}
        {info(t('cs.us.sum.collected'), money(detail.collected))}
        {info(t('cs.us.sum.remaining'), money(detail.remaining))}
        {sale.cancelNote !== null && info(t('cs.us.det.cancelNote'), sale.cancelNote)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <PaymentsPanel
          api={api}
          companyId={companyId}
          detail={detail}
          lang={lang}
          t={t}
          canCreate={canCreate}
          confirm={confirm}
          onError={onError}
          onChanged={onChanged}
        />
        <ChangeRequestsPanel
          api={api}
          companyId={companyId}
          detail={detail}
          lang={lang}
          t={t}
          canCreate={canCreate}
          onError={onError}
          onChanged={onChanged}
        />
      </div>
    </div>
  );
}

// ===== TAHSİLAT PANELİ ======================================================

function PaymentsPanel({
  api,
  companyId,
  detail,
  lang,
  t,
  canCreate,
  confirm,
  onError,
  onChanged,
}: {
  api: ConstructionApi;
  companyId: number;
  detail: UnitSaleDetailDto;
  lang: string | undefined;
  t: (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>) => string;
  canCreate: boolean;
  confirm: (msg: string) => Promise<boolean>;
  onError: (msg: string | null) => void;
  onChanged: () => void;
}): JSX.Element {
  const [kind, setKind] = useState<'collection' | 'refund'>('collection');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'bank' | 'cheque' | 'other'>('bank');

  const add = async (): Promise<void> => {
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) return;
    try {
      await api.addUnitPayment(detail.sale.id, { companyId, kind, paidAt, amount: v, method });
      setAmount('');
      onError(null);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (id: number): Promise<void> => {
    if (!(await confirm(t('cs.us.pay.deleteConfirm')))) return;
    try {
      await api.deleteUnitPayment(id, companyId);
      onError(null);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{ ...box, background: '#f8fafc' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{t('cs.us.pay.title')}</div>
      {detail.payments.length === 0 ? (
        <div style={{ fontSize: 12, color: '#64748b' }}>{t('cs.us.pay.none')}</div>
      ) : (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>{t('cs.us.pay.date')}</th>
              <th style={th}>{t('cs.us.pay.kind')}</th>
              <th style={{ ...th, textAlign: 'right' }}>{t('cs.us.pay.amount')}</th>
              <th style={th}>{t('cs.us.pay.method')}</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {detail.payments.map((p) => (
              <tr key={p.id}>
                <td style={td}>{p.paidAt}</td>
                <td style={{ ...td, color: p.kind === 'refund' ? '#b91c1c' : '#15803d' }}>
                  {unitPaymentKindLabel(p.kind, lang)}
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {p.kind === 'refund' ? '−' : ''}
                  {money(p.amount)}
                </td>
                <td style={td}>
                  {p.method === null ? '—' : unitPaymentMethodLabel(p.method, lang)}
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {canCreate && (
                    <button
                      style={{ ...btnDanger, padding: '1px 6px' }}
                      onClick={() => void remove(p.id)}
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canCreate && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginTop: 8,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <span style={label}>{t('cs.us.pay.kind')}</span>
            <select
              style={input}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as 'collection' | 'refund');
              }}
            >
              <option value="collection">{t('cs.us.pay.kind.collection')}</option>
              <option value="refund">{t('cs.us.pay.kind.refund')}</option>
            </select>
          </div>
          <div>
            <span style={label}>{t('cs.us.pay.date')}</span>
            <input
              style={input}
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={paidAt}
              onChange={(e) => {
                setPaidAt(e.target.value);
              }}
            />
          </div>
          <div style={{ width: 120 }}>
            <span style={label}>{t('cs.us.pay.amount')}</span>
            <input
              style={input}
              type="number"
              min={0}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
              }}
            />
          </div>
          <div>
            <span style={label}>{t('cs.us.pay.method')}</span>
            <select
              style={input}
              value={method}
              onChange={(e) => {
                setMethod(e.target.value as 'cash' | 'bank' | 'cheque' | 'other');
              }}
            >
              {(['bank', 'cash', 'cheque', 'other'] as const).map((m) => (
                <option key={m} value={m}>
                  {unitPaymentMethodLabel(m, lang)}
                </option>
              ))}
            </select>
          </div>
          <button style={btnPrimary} disabled={amount.trim() === ''} onClick={() => void add()}>
            {t('cs.us.pay.add')}
          </button>
        </div>
      )}
    </div>
  );
}

// ===== DEĞİŞİKLİK İSTEKLERİ PANELİ ==========================================

function ChangeRequestsPanel({
  api,
  companyId,
  detail,
  lang,
  t,
  canCreate,
  onError,
  onChanged,
}: {
  api: ConstructionApi;
  companyId: number;
  detail: UnitSaleDetailDto;
  lang: string | undefined;
  t: (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>) => string;
  canCreate: boolean;
  onError: (msg: string | null) => void;
  onChanged: () => void;
}): JSX.Element {
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('');
  const [rejecting, setRejecting] = useState<{ id: number; note: string } | null>(null);

  const add = async (): Promise<void> => {
    if (title.trim() === '') return;
    try {
      await api.createUnitChangeRequest(detail.sale.id, {
        companyId,
        title: title.trim(),
        ...(cost.trim() === '' ? {} : { cost: Number(cost) }),
      });
      setTitle('');
      setCost('');
      onError(null);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  const decide = async (
    id: number,
    to: 'approved' | 'rejected' | 'done',
    note?: string,
  ): Promise<void> => {
    try {
      await api.decideUnitChangeRequest(id, {
        companyId,
        to,
        ...(note !== undefined ? { note } : {}),
      });
      setRejecting(null);
      onError(null);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{ ...box, background: '#f8fafc' }}>
      <div
        style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}
        title={t('cs.us.cr.costFrozenHint')}
      >
        {t('cs.us.cr.title')}
      </div>
      {detail.changeRequests.length === 0 ? (
        <div style={{ fontSize: 12, color: '#64748b' }}>{t('cs.us.cr.none')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {detail.changeRequests.map((cr) => {
            const c = CR_COLOR[cr.status] ?? '#334155';
            return (
              <div
                key={cr.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: 8,
                  background: '#fff',
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{cr.code}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{cr.title}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: c,
                      border: `1px solid ${c}55`,
                      background: `${c}11`,
                      borderRadius: 999,
                      padding: '0 7px',
                    }}
                  >
                    {changeRequestStatusLabel(cr.status, lang)}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700 }}>
                    {money(cr.cost)}
                  </span>
                </div>
                {cr.note !== null && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{cr.note}</div>
                )}
                {canCreate && cr.allowedTransitions.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {cr.allowedTransitions.includes('approved') && (
                      <button style={btnPrimary} onClick={() => void decide(cr.id, 'approved')}>
                        {t('cs.us.cr.approve')}
                      </button>
                    )}
                    {cr.allowedTransitions.includes('done') && (
                      <button style={btn} onClick={() => void decide(cr.id, 'done')}>
                        {t('cs.us.cr.done')}
                      </button>
                    )}
                    {cr.allowedTransitions.includes('rejected') && (
                      <button
                        style={btnDanger}
                        onClick={() => {
                          setRejecting(rejecting?.id === cr.id ? null : { id: cr.id, note: '' });
                        }}
                      >
                        {t('cs.us.cr.reject')}
                      </button>
                    )}
                    {rejecting?.id === cr.id && (
                      <span style={{ display: 'inline-flex', gap: 4, flex: 1, minWidth: 200 }}>
                        <input
                          style={{ ...input, flex: 1 }}
                          placeholder={t('cs.us.cr.rejectNote')}
                          value={rejecting.note}
                          onChange={(e) => {
                            setRejecting({ id: cr.id, note: e.target.value });
                          }}
                        />
                        <button
                          style={btnDanger}
                          disabled={rejecting.note.trim() === ''}
                          onClick={() => void decide(cr.id, 'rejected', rejecting.note.trim())}
                        >
                          ✓
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {canCreate && detail.sale.status !== 'cancelled' && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginTop: 8,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 160 }}>
            <span style={label}>{t('cs.us.cr.field.title')} *</span>
            <input
              style={input}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
              }}
            />
          </div>
          <div style={{ width: 110 }} title={t('cs.us.cr.costFrozenHint')}>
            <span style={label}>{t('cs.us.cr.field.cost')}</span>
            <input
              style={input}
              type="number"
              min={0}
              value={cost}
              onChange={(e) => {
                setCost(e.target.value);
              }}
            />
          </div>
          <button style={btnPrimary} disabled={title.trim() === ''} onClick={() => void add()}>
            {t('cs.us.cr.add')}
          </button>
        </div>
      )}
    </div>
  );
}
