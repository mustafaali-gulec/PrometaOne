/**
 * PerformansManager — Adam×Saat & Verimlilik (FAZ 4).
 *
 * Imperium'un Keşif ekranındaki kolon grubu düzeni: PLANLANAN | MİKTAR |
 * ADAM×SAAT | VERİMLİLİK | TUTAR. Tablo iki satırlı başlık kullanır; grup
 * başlıkları alt kolonları kapsar, böylece 20+ kolon gözle taranabilir kalır.
 *
 * ORAN GÖSTERİMİ: backend payda 0 iken null döndürür ve burada "—" basılır.
 * 0 yazmak "verim yok" ile "verim ölçülemedi"yi karıştırır; şantiye şefi olmayan
 * bir problemi kovalar. Aynı nedenle planı olmayan satır sayısı özet şeridinde
 * uyarı olarak durur.
 *
 * Birim adam×saat yerinde düzenlenir ve tek PUT ile toplu kaydedilir — 200
 * pozluk bir keşifte satır satır istek atmak kullanılamaz.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

import type {
  ContractDto,
  EfficiencyBand,
  PerformanceReportDto,
  PerformanceRowDto,
  ProjectDto,
} from '../../application/dto/ConstructionDtos';
import type { ConstructionApi } from '../../application/ports/ConstructionApi';
import { csT, efficiencyBandLabel } from '../../i18n';
import { useProjects } from '../hooks/useProjects';

export interface PerformansManagerProps {
  api: ConstructionApi;
  companyId: number;
  lang?: string | undefined;
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
const warnBox: CSSProperties = {
  ...errBox,
  border: '1px solid #fcd34d',
  background: '#fffbeb',
  color: '#b45309',
};
const okBox: CSSProperties = {
  ...errBox,
  border: '1px solid #86efac',
  background: '#f0fdf4',
  color: '#15803d',
};

/** Kolon grubu zeminleri — 20+ kolonluk tabloda göz kaymasını önler. */
const GRP_TINT = {
  planned: '#f1f5f9',
  qty: '#eff6ff',
  manhours: '#fef3c7',
  productivity: '#f5f3ff',
  amount: '#f0fdf4',
} as const;

const BAND_COLOR: Record<EfficiencyBand, string> = {
  unknown: '#94a3b8',
  critical: '#b91c1c',
  behind: '#b45309',
  onTrack: '#15803d',
  ahead: '#0369a1',
};

const th = (tint?: string): CSSProperties => ({
  padding: '5px 7px',
  fontSize: 11,
  color: '#334155',
  background: tint ?? '#f8fafc',
  whiteSpace: 'nowrap',
  textAlign: 'right',
  borderBottom: '1px solid #e2e8f0',
  fontWeight: 600,
});
const thL = (tint?: string): CSSProperties => ({ ...th(tint), textAlign: 'left' });
const td: CSSProperties = {
  padding: '4px 7px',
  fontSize: 12,
  borderTop: '1px solid #f1f5f9',
  textAlign: 'right',
  whiteSpace: 'nowrap',
};
const tdL: CSSProperties = { ...td, textAlign: 'left', whiteSpace: 'normal' };

const num = (n: number, digits = 2): string =>
  n.toLocaleString('tr-TR', { maximumFractionDigits: digits });

/** null → "—". Oranın ölçülemediğini 0'dan ayırmak için. */
const opt = (n: number | null, digits = 2, suffix = ''): string =>
  n === null ? '—' : `${num(n, digits)}${suffix}`;

/** Sapma/makas gibi işaretli değerler: pozitif +, renk yönü çağırana bağlı. */
function Signed({
  value,
  digits = 2,
  goodWhenPositive,
  suffix = '',
}: {
  value: number | null;
  digits?: number;
  goodWhenPositive: boolean;
  suffix?: string;
}): JSX.Element {
  if (value === null) return <span style={{ color: '#94a3b8' }}>—</span>;
  const positive = value > 0.005;
  const negative = value < -0.005;
  const good = goodWhenPositive ? positive : negative;
  const bad = goodWhenPositive ? negative : positive;
  const color = good ? '#15803d' : bad ? '#b91c1c' : '#64748b';
  return (
    <span style={{ color, fontWeight: good || bad ? 600 : 400 }}>
      {value > 0 ? '+' : ''}
      {num(value, digits)}
      {suffix}
    </span>
  );
}

export function PerformansManager({ api, companyId, lang }: PerformansManagerProps): JSX.Element {
  const { projects } = useProjects(api, companyId);
  const [projectId, setProjectId] = useState<number>(0);
  const [contracts, setContracts] = useState<ReadonlyArray<ContractDto>>([]);
  /** 0 = tüm sözleşmeler (proje geneli) */
  const [contractId, setContractId] = useState<number>(0);
  const [report, setReport] = useState<PerformanceReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Yerelde düzenlenen birim a×s değerleri (metin — yazarken 0'a düşmesin). */
  const [draft, setDraft] = useState<ReadonlyMap<number, string>>(new Map());

  const t = useCallback(
    (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>) => csT(k, lang, vars),
    [lang],
  );

  useEffect(() => {
    if (!(projectId > 0)) {
      setContracts([]);
      setContractId(0);
      return;
    }
    let off = false;
    api
      .listContracts(companyId, { projectId })
      .then((r) => {
        if (!off) setContracts(r.contracts);
      })
      .catch((e: unknown) => {
        if (!off) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      off = true;
    };
  }, [api, companyId, projectId]);

  const load = useCallback(async (): Promise<void> => {
    if (!(projectId > 0)) {
      setReport(null);
      return;
    }
    setError(null);
    setDraft(new Map());
    try {
      const res =
        contractId > 0
          ? await api.getContractPerformance(contractId, companyId)
          : await api.getProjectPerformance(projectId, companyId);
      setReport(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, companyId, projectId, contractId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirtyCount = draft.size;

  /**
   * Kaydetme sözleşme başına gruplanır: proje geneli görünümde satırlar farklı
   * sözleşmelere ait olabilir ve uç sözleşme sınırını denetliyor.
   */
  const saveManhours = async (): Promise<void> => {
    if (report === null || dirtyCount === 0) return;
    const byContract = new Map<number, { boqLineId: number; unitManhours: number }[]>();
    for (const [boqLineId, text] of draft) {
      const row = report.rows.find((r) => r.boqLineId === boqLineId);
      if (!row) continue;
      const v = Number(text.trim().replace(',', '.'));
      if (!Number.isFinite(v) || v < 0) continue;
      const arr = byContract.get(row.contractId);
      if (arr) arr.push({ boqLineId, unitManhours: v });
      else byContract.set(row.contractId, [{ boqLineId, unitManhours: v }]);
    }

    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      let updated = 0;
      for (const [ctr, updates] of byContract) {
        const res = await api.setUnitManhours(ctr, { companyId, updates });
        updated += res.updated;
      }
      await load();
      setInfo(t('cs.perf.manhoursSaved', { n: updated }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const summary = report?.summary ?? null;

  const noPlanWarning = useMemo(() => {
    if (summary === null || summary.linesWithoutPlan === 0) return null;
    return t('cs.perf.noPlanWarn', { n: summary.linesWithoutPlan });
  }, [summary, t]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <h3 style={{ margin: '0 0 2px', fontSize: 16 }}>{t('cs.perf.title')}</h3>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{t('cs.perf.subtitle')}</p>
      </div>

      <div style={{ ...box, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 240 }}>
          <span style={label}>{t('cs.common.project')}</span>
          <select
            style={input}
            value={projectId === 0 ? '' : String(projectId)}
            onChange={(e) => {
              setProjectId(e.target.value === '' ? 0 : Number(e.target.value));
              setContractId(0);
              setInfo(null);
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
        <div style={{ minWidth: 240 }}>
          <span style={label}>{t('cs.perf.contract')}</span>
          <select
            style={input}
            value={contractId === 0 ? '' : String(contractId)}
            disabled={projectId === 0}
            onChange={(e) => setContractId(e.target.value === '' ? 0 : Number(e.target.value))}
          >
            <option value="">{t('cs.perf.allContracts')}</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.contractNo} · {c.title}
              </option>
            ))}
          </select>
        </div>
        <button type="button" style={btn} onClick={() => void load()}>
          {t('cs.common.refresh')}
        </button>
        {dirtyCount > 0 && (
          <button
            type="button"
            style={btnPrimary}
            disabled={busy}
            onClick={() => void saveManhours()}
          >
            {busy ? t('cs.common.loading') : `${t('cs.perf.saveManhours')} (${String(dirtyCount)})`}
          </button>
        )}
      </div>

      {error !== null && <div style={errBox}>{error}</div>}
      {info !== null && <div style={okBox}>{info}</div>}
      {noPlanWarning !== null && <div style={warnBox}>{noPlanWarning}</div>}

      {projectId === 0 ? (
        <div style={{ ...box, color: '#64748b', fontSize: 13 }}>{t('cs.common.selectProject')}</div>
      ) : report === null ? (
        <div style={{ ...box, color: '#64748b', fontSize: 13 }}>{t('cs.common.loading')}</div>
      ) : report.rows.length === 0 ? (
        <div style={{ ...box, color: '#64748b', fontSize: 13 }}>{t('cs.perf.noLines')}</div>
      ) : (
        <>
          {summary !== null && (
            <div
              style={{ ...box, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}
            >
              <div>
                <span style={label}>{t('cs.perf.c.efficiency')}</span>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color: BAND_COLOR[summary.band],
                  }}
                  title={t('cs.perf.h.efficiency')}
                >
                  {opt(summary.efficiency, 3)}
                </div>
                <div style={{ fontSize: 11, color: BAND_COLOR[summary.band] }}>
                  {efficiencyBandLabel(summary.band, lang)} · {t('cs.perf.s.weighted')}
                </div>
              </div>
              <Metric label={t('cs.perf.s.lineCount')} value={String(summary.lineCount)} />
              <Metric
                label={t('cs.perf.c.plannedManhours')}
                value={num(summary.plannedManhours, 1)}
              />
              <Metric
                label={t('cs.perf.c.actualManhours')}
                value={num(summary.actualManhours, 1)}
              />
              <Metric label={t('cs.perf.c.manhourPct')} value={opt(summary.manhourPct, 1, '%')} />
              <div>
                <span style={label}>{t('cs.perf.c.manhourVariance')}</span>
                <div style={{ fontSize: 15 }}>
                  <Signed value={summary.manhourVariance} digits={1} goodWhenPositive={false} />
                </div>
              </div>
              <div>
                <span style={label} title={t('cs.perf.h.eac')}>
                  {t('cs.perf.c.eacManhours')}
                </span>
                <div style={{ fontSize: 15 }}>
                  {num(summary.eacManhours, 1)}{' '}
                  <span style={{ fontSize: 12 }}>
                    (<Signed value={summary.eacVariance} digits={1} goodWhenPositive={false} />)
                  </span>
                </div>
              </div>
              <Metric
                label={t('cs.perf.c.machineHours')}
                value={num(summary.machineHours, 1)}
                hint={t('cs.perf.h.machineHours')}
              />
              <Metric
                label={t('cs.perf.c.earnedPursantaj')}
                value={`${num(summary.earnedPursantaj, 3)}%`}
              />
            </div>
          )}

          <div style={{ ...box, padding: 0, overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: 1900, width: '100%' }}>
              <thead>
                {/* Grup satırı — Imperium'un kolon grubu düzeni */}
                <tr>
                  <th style={thL()} colSpan={3} />
                  <th style={{ ...th(GRP_TINT.planned), textAlign: 'center' }} colSpan={5}>
                    {t('cs.perf.grp.planned')}
                  </th>
                  <th style={{ ...th(GRP_TINT.qty), textAlign: 'center' }} colSpan={6}>
                    {t('cs.perf.grp.qty')}
                  </th>
                  <th style={{ ...th(GRP_TINT.manhours), textAlign: 'center' }} colSpan={6}>
                    {t('cs.perf.grp.manhours')}
                  </th>
                  <th style={{ ...th(GRP_TINT.productivity), textAlign: 'center' }} colSpan={5}>
                    {t('cs.perf.grp.productivity')}
                  </th>
                  <th style={{ ...th(GRP_TINT.amount), textAlign: 'center' }} colSpan={2}>
                    {t('cs.perf.grp.amount')}
                  </th>
                </tr>
                <tr>
                  <th style={thL()}>{t('cs.perf.c.pozNo')}</th>
                  <th style={thL()}>{t('cs.perf.c.description')}</th>
                  <th style={thL()}>{t('cs.perf.c.unit')}</th>

                  <th style={th(GRP_TINT.planned)}>{t('cs.perf.c.plannedQty')}</th>
                  <th style={th(GRP_TINT.planned)}>{t('cs.perf.c.unitPrice')}</th>
                  <th style={th(GRP_TINT.planned)}>{t('cs.perf.c.plannedAmount')}</th>
                  <th style={th(GRP_TINT.planned)}>{t('cs.perf.c.pursantaj')}</th>
                  <th style={th(GRP_TINT.planned)} title={t('cs.perf.h.unitManhours')}>
                    {t('cs.perf.c.unitManhours')} ✎
                  </th>

                  <th style={th(GRP_TINT.qty)} title={t('cs.perf.h.progressQty')}>
                    {t('cs.perf.c.progressQty')}
                  </th>
                  <th style={th(GRP_TINT.qty)}>{t('cs.perf.c.progressPct')}</th>
                  <th style={th(GRP_TINT.qty)} title={t('cs.perf.h.producedQty')}>
                    {t('cs.perf.c.producedQty')}
                  </th>
                  <th style={th(GRP_TINT.qty)}>{t('cs.perf.c.producedPct')}</th>
                  <th style={th(GRP_TINT.qty)} title={t('cs.perf.h.productionVsProgress')}>
                    {t('cs.perf.c.productionVsProgress')}
                  </th>
                  <th style={th(GRP_TINT.qty)}>{t('cs.perf.c.earnedPursantaj')}</th>

                  <th style={th(GRP_TINT.manhours)}>{t('cs.perf.c.plannedManhours')}</th>
                  <th style={th(GRP_TINT.manhours)}>{t('cs.perf.c.ownManhours')}</th>
                  <th style={th(GRP_TINT.manhours)}>{t('cs.perf.c.subManhours')}</th>
                  <th style={th(GRP_TINT.manhours)}>{t('cs.perf.c.actualManhours')}</th>
                  <th style={th(GRP_TINT.manhours)}>{t('cs.perf.c.manhourPct')}</th>
                  <th style={th(GRP_TINT.manhours)} title={t('cs.perf.h.machineHours')}>
                    {t('cs.perf.c.machineHours')}
                  </th>

                  <th style={th(GRP_TINT.productivity)}>{t('cs.perf.c.actualUnitManhours')}</th>
                  <th style={th(GRP_TINT.productivity)}>{t('cs.perf.c.expectedManhours')}</th>
                  <th style={th(GRP_TINT.productivity)} title={t('cs.perf.h.efficiency')}>
                    {t('cs.perf.c.efficiency')}
                  </th>
                  <th style={th(GRP_TINT.productivity)} title={t('cs.perf.h.progressGap')}>
                    {t('cs.perf.c.progressGap')}
                  </th>
                  <th style={th(GRP_TINT.productivity)} title={t('cs.perf.h.eac')}>
                    {t('cs.perf.c.eacManhours')}
                  </th>

                  <th style={th(GRP_TINT.amount)}>{t('cs.perf.c.progressAmount')}</th>
                  <th style={th(GRP_TINT.amount)}>{t('cs.perf.c.expenseAmount')}</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r: PerformanceRowDto) => {
                  const dirty = draft.has(r.boqLineId);
                  const noPlan = r.plannedUnitManhours <= 0;
                  return (
                    <tr key={r.boqLineId} style={noPlan ? { background: '#fffdf5' } : undefined}>
                      <td style={{ ...tdL, fontWeight: 600 }}>
                        {r.pozNo ?? `#${String(r.lineNo)}`}
                      </td>
                      <td style={{ ...tdL, minWidth: 190 }}>{r.description}</td>
                      <td style={tdL}>{r.unit}</td>

                      <td style={{ ...td, background: GRP_TINT.planned }}>
                        {num(r.plannedQty, 3)}
                      </td>
                      <td style={{ ...td, background: GRP_TINT.planned }}>{num(r.unitPrice)}</td>
                      <td style={{ ...td, background: GRP_TINT.planned }}>
                        {num(r.plannedAmount)}
                      </td>
                      <td style={{ ...td, background: GRP_TINT.planned }}>
                        {num(r.pursantajPct, 3)}%
                      </td>
                      <td style={{ ...td, background: GRP_TINT.planned }}>
                        <input
                          style={{
                            ...input,
                            padding: '2px 4px',
                            width: 62,
                            textAlign: 'right',
                            borderColor: dirty ? '#f59e0b' : '#cbd5e1',
                            background: dirty ? '#fffbeb' : '#fff',
                          }}
                          value={draft.get(r.boqLineId) ?? String(r.plannedUnitManhours)}
                          title={t('cs.perf.h.unitManhours')}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraft((prev) => {
                              const next = new Map(prev);
                              // Özgün değere dönülürse kirli işareti kalkar
                              if (v === String(r.plannedUnitManhours)) next.delete(r.boqLineId);
                              else next.set(r.boqLineId, v);
                              return next;
                            });
                          }}
                        />
                      </td>

                      <td style={{ ...td, background: GRP_TINT.qty }}>{num(r.progressQty, 3)}</td>
                      <td style={{ ...td, background: GRP_TINT.qty }}>
                        {opt(r.progressPct, 1, '%')}
                      </td>
                      <td style={{ ...td, background: GRP_TINT.qty }}>{num(r.producedQty, 3)}</td>
                      <td style={{ ...td, background: GRP_TINT.qty }}>
                        {opt(r.producedPct, 1, '%')}
                      </td>
                      <td style={{ ...td, background: GRP_TINT.qty }}>
                        <Signed value={r.productionVsProgressQty} digits={3} goodWhenPositive />
                      </td>
                      <td style={{ ...td, background: GRP_TINT.qty }}>
                        {opt(r.earnedPursantaj, 3, '%')}
                      </td>

                      <td style={{ ...td, background: GRP_TINT.manhours }}>
                        {num(r.plannedManhours, 1)}
                      </td>
                      <td style={{ ...td, background: GRP_TINT.manhours }}>
                        {num(r.ownManhours, 1)}
                      </td>
                      <td style={{ ...td, background: GRP_TINT.manhours }}>
                        {num(r.subManhours, 1)}
                      </td>
                      <td
                        style={{
                          ...td,
                          background: GRP_TINT.manhours,
                          fontWeight: 600,
                        }}
                      >
                        {num(r.actualManhours, 1)}
                      </td>
                      <td style={{ ...td, background: GRP_TINT.manhours }}>
                        {opt(r.manhourPct, 1, '%')}
                      </td>
                      <td style={{ ...td, background: GRP_TINT.manhours, color: '#64748b' }}>
                        {num(r.machineHours, 1)}
                      </td>

                      <td style={{ ...td, background: GRP_TINT.productivity }}>
                        {opt(r.actualUnitManhours, 3)}
                      </td>
                      <td style={{ ...td, background: GRP_TINT.productivity }}>
                        {num(r.expectedManhours, 1)}
                      </td>
                      <td
                        style={{
                          ...td,
                          background: GRP_TINT.productivity,
                          fontWeight: 700,
                          color: BAND_COLOR[r.band],
                        }}
                        title={efficiencyBandLabel(r.band, lang)}
                      >
                        {opt(r.efficiency, 3)}
                      </td>
                      <td style={{ ...td, background: GRP_TINT.productivity }}>
                        <Signed value={r.progressGap} digits={1} goodWhenPositive suffix="%" />
                      </td>
                      <td style={{ ...td, background: GRP_TINT.productivity }}>
                        {num(r.eacManhours, 1)}{' '}
                        <span style={{ fontSize: 11 }}>
                          (<Signed value={r.eacVariance} digits={1} goodWhenPositive={false} />)
                        </span>
                      </td>

                      <td style={{ ...td, background: GRP_TINT.amount }}>
                        {num(r.progressAmount)}
                      </td>
                      <td style={{ ...td, background: GRP_TINT.amount }}>{num(r.expenseAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {summary !== null && (
                <tfoot>
                  <tr style={{ background: '#0f172a', color: '#fff', fontWeight: 600 }}>
                    <td style={{ ...tdL, color: '#fff' }} colSpan={3}>
                      {t('cs.common.total')}
                    </td>
                    <td style={td} />
                    <td style={td} />
                    <td style={td}>{num(summary.plannedAmount)}</td>
                    <td style={td} />
                    <td style={td} />
                    <td style={td} colSpan={5} />
                    <td style={td}>{num(summary.earnedPursantaj, 3)}%</td>
                    <td style={td}>{num(summary.plannedManhours, 1)}</td>
                    <td style={td}>{num(summary.ownManhours, 1)}</td>
                    <td style={td}>{num(summary.subManhours, 1)}</td>
                    <td style={td}>{num(summary.actualManhours, 1)}</td>
                    <td style={td}>{opt(summary.manhourPct, 1, '%')}</td>
                    <td style={td}>{num(summary.machineHours, 1)}</td>
                    <td style={td} />
                    <td style={td}>{num(summary.expectedManhours, 1)}</td>
                    <td style={td}>{opt(summary.efficiency, 3)}</td>
                    <td style={td} />
                    <td style={td}>{num(summary.eacManhours, 1)}</td>
                    <td style={td}>{num(summary.progressAmount)}</td>
                    <td style={td}>{num(summary.expenseAmount)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  label: lbl,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}): JSX.Element {
  return (
    <div>
      <span style={label} {...(hint === undefined ? {} : { title: hint })}>
        {lbl}
      </span>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
