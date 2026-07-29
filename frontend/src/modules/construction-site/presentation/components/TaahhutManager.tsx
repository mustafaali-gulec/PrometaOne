/**
 * TaahhutManager — Taahhütler & EVM ekranı (FAZ 7).
 *
 * Üst şerit: sözleşme EVM kartları (BAC / EV / AC / açık taahhüt / maruziyet /
 * bütçe kalan / CPI). SPI ve klasik EAC bilerek YOK — zaman-fazlı baseline
 * olmadan hesaplanamaz, uydurmak yanlış güven verir (tooltip bunu söyler).
 *
 * Alt liste: taahhüt kayıtları. Teslimat KÜMÜLATİF tutar ister (delta değil) —
 * girdi alanının ipucu bunu açıkça söyler çünkü saha alışkanlığı "bu seferki
 * irsaliye tutarını" girmektir ve sessiz kabul çift sayıma yol açar.
 *
 * Satınalma senkronundan gelen kayıtlar (source=purchase_order) listede kaynak
 * etiketiyle ayrışır; kaynak-of-truth monolit olduğundan burada yapılan parasal
 * düzeltme bir sonraki senkronda kaynağın değerine döner.
 */
import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

import type {
  CommitmentDto,
  CommitmentSource,
  CommitmentStatus,
  ContractDto,
  ContractEvmDto,
  ProjectCommitmentSummaryDto,
  ProjectDto,
} from '../../application/dto/ConstructionDtos';
import type { ConstructionApi } from '../../application/ports/ConstructionApi';
import { commitmentSourceLabel, commitmentStatusLabel, csT } from '../../i18n';
import { useProjects } from '../hooks/useProjects';

const SOURCES: CommitmentSource[] = ['manual', 'subcontract', 'purchase_order'];

export interface TaahhutManagerProps {
  api: ConstructionApi;
  companyId: number;
  lang?: string | undefined;
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
const errBox: CSSProperties = {
  border: '1px solid #fca5a5',
  background: '#fef2f2',
  color: '#b91c1c',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 13,
};
const okBox: CSSProperties = {
  ...errBox,
  border: '1px solid #86efac',
  background: '#f0fdf4',
  color: '#15803d',
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

const ST_COLOR: Record<CommitmentStatus, string> = {
  open: '#b45309',
  partial: '#0369a1',
  closed: '#15803d',
  cancelled: '#94a3b8',
};

const money = (v: number): string => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
const opt = (v: number | null, digits = 2, suffix = ''): string =>
  v === null ? '—' : `${v.toLocaleString('tr-TR', { maximumFractionDigits: digits })}${suffix}`;

export function TaahhutManager({
  api,
  companyId,
  lang,
  confirmAsync,
}: TaahhutManagerProps): JSX.Element {
  const { projects } = useProjects(api, companyId);
  const [projectId, setProjectId] = useState(0);
  const [contracts, setContracts] = useState<ReadonlyArray<ContractDto>>([]);
  const [evm, setEvm] = useState<ReadonlyArray<ContractEvmDto>>([]);
  const [summary, setSummary] = useState<ProjectCommitmentSummaryDto | null>(null);
  const [commitments, setCommitments] = useState<ReadonlyArray<CommitmentDto>>([]);
  const [openOnly, setOpenOnly] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  /** Teslimat girişi açık olan kayıt + kümülatif tutar taslağı. */
  const [delivering, setDelivering] = useState<{ id: number; value: string } | null>(null);

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
      setEvm([]);
      setSummary(null);
      setCommitments([]);
      setContracts([]);
      return;
    }
    try {
      const [pevm, list, ctr] = await Promise.all([
        api.getProjectEvm(projectId, companyId),
        api.listCommitments(companyId, { projectId, ...(openOnly ? { openOnly: true } : {}) }),
        api.listContracts(companyId, { projectId }),
      ]);
      setEvm(pevm.contracts);
      setSummary(pevm.commitments);
      setCommitments(list.commitments);
      setContracts(ctr.contracts);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, companyId, projectId, openOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (msg: string): void => {
    setError(null);
    setInfo(msg);
  };

  const submitDelivery = async (): Promise<void> => {
    if (delivering === null) return;
    const v = Number(delivering.value.replace(',', '.'));
    if (!Number.isFinite(v) || v < 0) return;
    try {
      await api.recordCommitmentDelivery(delivering.id, { companyId, deliveredAmount: v });
      setDelivering(null);
      await load();
      flash(t('cs.qg.saved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const doClose = async (id: number): Promise<void> => {
    if (!(await confirm(t('cs.cmt.closeConfirm')))) return;
    try {
      await api.closeCommitment(id, companyId);
      await load();
      flash(t('cs.qg.saved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const doCancel = async (id: number): Promise<void> => {
    if (!(await confirm(t('cs.cmt.cancelConfirm')))) return;
    try {
      await api.cancelCommitment(id, companyId);
      await load();
      flash(t('cs.qg.saved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <h3 style={{ margin: '0 0 2px', fontSize: 16 }}>{t('cs.cmt.title')}</h3>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{t('cs.cmt.subtitle')}</p>
      </div>

      <div style={{ ...box, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260 }}>
          <span style={label}>{t('cs.common.project')}</span>
          <select
            style={input}
            value={projectId === 0 ? '' : String(projectId)}
            onChange={(e) => {
              setProjectId(e.target.value === '' ? 0 : Number(e.target.value));
              setInfo(null);
              setError(null);
            }}
          >
            <option value="">{t('cs.common.selectProject')}</option>
            {projects.map((p: ProjectDto) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
        </div>
        <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
          />
          {t('cs.qg.filter.openOnly')}
        </label>
        <button type="button" style={btn} onClick={() => void load()}>
          {t('cs.common.refresh')}
        </button>
        <button type="button" style={btn} onClick={() => setShowForm((v) => !v)}>
          {showForm ? t('cs.common.close') : t('cs.cmt.new')}
        </button>
      </div>

      {error !== null && <div style={errBox}>{error}</div>}
      {info !== null && <div style={okBox}>{info}</div>}

      {projectId === 0 ? (
        <div style={{ ...box, color: '#64748b', fontSize: 13 }}>{t('cs.common.selectProject')}</div>
      ) : (
        <>
          {summary !== null && (
            <div style={{ ...box, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <Metric
                label={t('cs.cmt.s.openTotal')}
                value={money(summary.openCommitted)}
                color="#b45309"
                hint={t('cs.evm.exposureHint')}
              />
              <Metric
                label={t('cs.cmt.s.committedTotal')}
                value={money(summary.committedTotal)}
                color="#334155"
              />
              <Metric
                label={t('cs.cmt.s.openCount')}
                value={String(summary.openCount)}
                color="#0369a1"
              />
              {summary.unlinkedCount > 0 && (
                <Metric
                  label={t('cs.cmt.s.unlinked')}
                  value={`${String(summary.unlinkedCount)} · ${money(summary.unlinkedAmount)}`}
                  color="#7c3aed"
                  hint={t('cs.cmt.s.unlinkedHint')}
                />
              )}
            </div>
          )}

          {evm.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {evm.map((e) => {
                const ctr = contracts.find((c) => c.id === e.contractId);
                const over = e.budgetRemaining < 0;
                return (
                  <div key={e.contractId} style={{ ...box, minWidth: 340, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      {t('cs.evm.title')} —{' '}
                      {ctr ? `${ctr.contractNo} · ${ctr.title}` : `#${String(e.contractId)}`}
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <Metric label={t('cs.evm.bac')} value={money(e.bac)} color="#334155" />
                      <Metric label={t('cs.evm.ev')} value={money(e.ev)} color="#15803d" />
                      <Metric label={t('cs.evm.ac')} value={money(e.ac)} color="#b45309" />
                      <Metric
                        label={t('cs.evm.openCommitted')}
                        value={money(e.openCommitted)}
                        color="#0369a1"
                      />
                      <Metric
                        label={t('cs.evm.exposure')}
                        value={money(e.costExposure)}
                        color="#c2410c"
                        hint={t('cs.evm.exposureHint')}
                      />
                      <Metric
                        label={t('cs.evm.remaining')}
                        value={money(e.budgetRemaining)}
                        color={over ? '#b91c1c' : '#15803d'}
                      />
                      <Metric
                        label={t('cs.evm.cpi')}
                        value={opt(e.cpi, 3)}
                        color={e.cpi !== null && e.cpi < 1 ? '#b91c1c' : '#15803d'}
                        hint={t('cs.evm.cpiHint')}
                      />
                      <Metric
                        label={t('cs.evm.pctEarned')}
                        value={opt(e.pctEarned, 1, '%')}
                        color="#334155"
                      />
                      <Metric
                        label={t('cs.evm.pctExposure')}
                        value={opt(e.pctExposure, 1, '%')}
                        color="#334155"
                      />
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>
                      {t('cs.evm.noSpi')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showForm && (
            <CommitmentForm
              lang={lang}
              contracts={contracts}
              onSubmit={async (body) => {
                try {
                  await api.createCommitment({ companyId, projectId, ...body });
                  setShowForm(false);
                  await load();
                  flash(t('cs.qg.saved'));
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            />
          )}

          <div style={{ ...box, padding: 0, overflowX: 'auto' }}>
            {commitments.length === 0 ? (
              <div style={{ padding: 12, fontSize: 13, color: '#64748b' }}>{t('cs.cmt.empty')}</div>
            ) : (
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1050 }}>
                <thead>
                  <tr>
                    <th style={th}>{t('cs.cmt.c.refNo')}</th>
                    <th style={th}>{t('cs.qg.c.description')}</th>
                    <th style={th}>{t('cs.cmt.c.source')}</th>
                    <th style={th}>{t('cs.cmt.c.boqLine')}</th>
                    <th style={th}>{t('cs.common.status')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('cs.cmt.c.amount')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('cs.cmt.c.delivered')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('cs.cmt.c.open')}</th>
                    <th style={th}>{t('cs.cmt.c.committedAt')}</th>
                    <th style={th} />
                  </tr>
                </thead>
                <tbody>
                  {commitments.map((cm) => (
                    <tr key={cm.id}>
                      <td style={{ ...td, fontWeight: 600 }}>
                        {cm.refNo}
                        {cm.refLineNo > 1 ? ` / ${String(cm.refLineNo)}` : ''}
                      </td>
                      <td style={{ ...td, whiteSpace: 'normal', minWidth: 160 }}>
                        {cm.description}
                      </td>
                      <td style={td}>{commitmentSourceLabel(cm.source, lang)}</td>
                      <td style={td}>{cm.boqLineId === null ? '—' : `#${String(cm.boqLineId)}`}</td>
                      <td style={{ ...td, color: ST_COLOR[cm.status], fontWeight: 600 }}>
                        {commitmentStatusLabel(cm.status, lang)}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>{money(cm.amount)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{money(cm.deliveredAmount)}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>
                        {money(cm.openAmount)}
                      </td>
                      <td style={td}>{cm.committedAt}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        {(cm.status === 'open' || cm.status === 'partial') && (
                          <>
                            <button
                              type="button"
                              style={{ ...btn, marginRight: 4 }}
                              title={t('cs.cmt.deliveryHint')}
                              onClick={() =>
                                setDelivering({ id: cm.id, value: String(cm.deliveredAmount) })
                              }
                            >
                              {t('cs.cmt.act.delivery')}
                            </button>
                            <button
                              type="button"
                              style={{ ...btn, marginRight: 4 }}
                              onClick={() => void doClose(cm.id)}
                            >
                              {t('cs.cmt.act.close')}
                            </button>
                            <button
                              type="button"
                              style={{ ...btn, color: '#b91c1c', borderColor: '#fca5a5' }}
                              onClick={() => void doCancel(cm.id)}
                            >
                              {t('cs.cmt.act.cancel')}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {delivering !== null && (
            <div style={{ ...box, display: 'grid', gap: 8, borderColor: '#93c5fd' }}>
              <div style={{ fontSize: 12, color: '#475569' }}>{t('cs.cmt.deliveryHint')}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ width: 180 }}>
                  <span style={label}>{t('cs.cmt.c.delivered')}</span>
                  <input
                    style={input}
                    value={delivering.value}
                    onChange={(e) =>
                      setDelivering((prev) =>
                        prev === null ? null : { ...prev, value: e.target.value },
                      )
                    }
                  />
                </div>
                <button type="button" style={btn} onClick={() => setDelivering(null)}>
                  {t('cs.common.cancel')}
                </button>
                <button type="button" style={btnPrimary} onClick={() => void submitDelivery()}>
                  {t('cs.common.save')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CommitmentForm({
  lang,
  contracts,
  onSubmit,
}: {
  lang: string | undefined;
  contracts: ReadonlyArray<ContractDto>;
  onSubmit: (body: {
    refNo: string;
    description: string;
    amount: number;
    source: CommitmentSource;
    contractId?: number | null;
    boqLineId?: number | null;
    vendorId?: number | null;
    quantity?: number;
    unit?: string | null;
    committedAt?: string;
  }) => Promise<void>;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0]): string => csT(k, lang);
  const [refNo, setRefNo] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState<CommitmentSource>('manual');
  const [contractId, setContractId] = useState(0);
  const [boqLineId, setBoqLineId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div style={{ ...box, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div style={{ width: 140 }}>
        <span style={label}>{t('cs.cmt.c.refNo')}</span>
        <input style={input} value={refNo} onChange={(e) => setRefNo(e.target.value)} />
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <span style={label}>{t('cs.qg.c.description')}</span>
        <input style={input} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div style={{ width: 130 }}>
        <span style={label}>{t('cs.cmt.c.amount')}</span>
        <input style={input} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div style={{ minWidth: 160 }}>
        <span style={label}>{t('cs.cmt.c.source')}</span>
        <select
          style={input}
          value={source}
          onChange={(e) => setSource(e.target.value as CommitmentSource)}
        >
          {SOURCES.map((src) => (
            <option key={src} value={src}>
              {commitmentSourceLabel(src, lang)}
            </option>
          ))}
        </select>
      </div>
      <div style={{ minWidth: 200 }}>
        <span style={label}>{t('cs.cmt.c.contract')}</span>
        <select
          style={input}
          value={contractId === 0 ? '' : String(contractId)}
          onChange={(e) => setContractId(e.target.value === '' ? 0 : Number(e.target.value))}
        >
          <option value="">—</option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.contractNo} · {c.title}
            </option>
          ))}
        </select>
      </div>
      <div style={{ width: 110 }}>
        <span style={label}>{t('cs.cmt.c.boqLine')}</span>
        <input style={input} value={boqLineId} onChange={(e) => setBoqLineId(e.target.value)} />
      </div>
      <div style={{ width: 110 }}>
        <span style={label}>{t('cs.qg.c.vendor')}</span>
        <input style={input} value={vendorId} onChange={(e) => setVendorId(e.target.value)} />
      </div>
      <button
        type="button"
        style={btnPrimary}
        onClick={() => {
          const amt = Number(amount.replace(',', '.'));
          if (
            refNo.trim() === '' ||
            description.trim() === '' ||
            !Number.isFinite(amt) ||
            amt < 0
          ) {
            setLocalError(t('cs.common.required'));
            return;
          }
          setLocalError(null);
          void onSubmit({
            refNo: refNo.trim(),
            description: description.trim(),
            amount: amt,
            source,
            contractId: contractId > 0 ? contractId : null,
            boqLineId: boqLineId.trim() === '' ? null : Number(boqLineId),
            vendorId: vendorId.trim() === '' ? null : Number(vendorId),
          });
        }}
      >
        {t('cs.common.save')}
      </button>
      {localError !== null && <div style={errBox}>{localError}</div>}
    </div>
  );
}

function Metric({
  label: lbl,
  value,
  color,
  hint,
}: {
  label: string;
  value: string;
  color: string;
  hint?: string;
}): JSX.Element {
  return (
    <div>
      <span style={label} {...(hint === undefined ? {} : { title: hint })}>
        {lbl}
      </span>
      <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.15, color }}>{value}</div>
    </div>
  );
}
