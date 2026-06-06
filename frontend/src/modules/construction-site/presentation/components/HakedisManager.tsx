/**
 * HakedisManager — Hakediş yönetimi (SF-3). Sözleşme seç → hakediş listesi +
 * oluştur → seçili hakediş detayı: satır (bu dönem miktar) girişi, kesinti/fiyat
 * farkı, toplamlar ve durum aksiyonları (Gönder/Onayla/Reddet/Ödendi/İptal).
 *
 * Onay/ödeme butonları sunucuda yönetici (cfo/admin) yetkisi ister; yetki yoksa
 * 403 mesajı gösterilir.
 */
import { useEffect, useState } from 'react';

import type {
  ContractDto,
  DeductionKind,
  ProgressKind,
  ProgressPaymentDto,
  ProgressStatus,
  ProgressSummaryDto,
} from '../../application/dto/ConstructionDtos';
import type { ConstructionApi, DeductionBody } from '../../application/ports/ConstructionApi';

const STATUS_LABELS: Record<ProgressStatus, string> = {
  draft: 'Taslak',
  submitted: 'Gönderildi',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  paid: 'Ödendi',
  cancelled: 'İptal',
};
const STATUS_COLORS: Record<ProgressStatus, string> = {
  draft: '#9ca3af',
  submitted: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  paid: '#0ea5e9',
  cancelled: '#6b7280',
};
const DEDUCTION_LABELS: Record<DeductionKind, string> = {
  retention: 'Teminat Kesintisi',
  advance_offset: 'Avans Mahsubu',
  sgk: 'SGK',
  income_tax: 'Gelir Vergisi',
  stoppage: 'Stopaj',
  penalty: 'Gecikme Cezası',
  price_diff: 'Fiyat Farkı (ilave)',
  other: 'Diğer',
};

function isEditable(s: ProgressStatus): boolean {
  return s === 'draft' || s === 'rejected';
}
function nextStatusActions(
  s: ProgressStatus,
): Array<{ label: string; to: ProgressStatus; bg: string }> {
  switch (s) {
    case 'draft':
      return [{ label: 'Gönder', to: 'submitted', bg: '#f59e0b' }];
    case 'submitted':
      return [
        { label: 'Onayla', to: 'approved', bg: '#10b981' },
        { label: 'Reddet', to: 'rejected', bg: '#ef4444' },
      ];
    case 'approved':
      return [{ label: 'Ödendi İşaretle', to: 'paid', bg: '#0ea5e9' }];
    case 'rejected':
      return [{ label: 'Tekrar Gönder', to: 'submitted', bg: '#f59e0b' }];
    default:
      return [];
  }
}

export interface HakedisManagerProps {
  api: ConstructionApi;
  companyId: number;
}

export function HakedisManager({ api, companyId }: HakedisManagerProps): JSX.Element {
  const [contracts, setContracts] = useState<ReadonlyArray<ContractDto>>([]);
  const [contractId, setContractId] = useState<number>(0);
  const [list, setList] = useState<ReadonlyArray<ProgressSummaryDto>>([]);
  const [selected, setSelected] = useState<ProgressPaymentDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .listContracts(companyId)
      .then((r) => {
        if (!cancelled) setContracts(r.contracts);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [api, companyId]);

  const reloadList = async (cid: number): Promise<void> => {
    if (!(cid > 0)) {
      setList([]);
      return;
    }
    const r = await api.listProgress(companyId, cid);
    setList(r.progress);
  };

  useEffect(() => {
    setSelected(null);
    void reloadList(contractId).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  const open = async (id: number): Promise<void> => {
    setError(null);
    try {
      const dto = await api.getProgress(id, companyId);
      setSelected(dto);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const create = async (kind: ProgressKind): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const dto = await api.createProgress({ companyId, contractId, kind });
      await reloadList(contractId);
      setSelected(dto);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hakediş oluşturulamadı');
    } finally {
      setBusy(false);
    }
  };

  const refreshSelected = async (dto: ProgressPaymentDto): Promise<void> => {
    setSelected(dto);
    await reloadList(contractId);
  };

  return (
    <section>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-muted, #666)' }}>Sözleşme:</span>
        <select
          value={contractId}
          onChange={(ev) => setContractId(Number(ev.target.value))}
          style={field({ minWidth: 280 })}
        >
          <option value={0}>— Sözleşme seç —</option>
          {contracts.map((c) => (
            <option key={String(c.id)} value={c.id}>
              {c.contractNo} — {c.title} ({c.partyKind === 'employer' ? 'işveren' : 'taşeron'})
            </option>
          ))}
        </select>
        {contractId > 0 ? (
          <>
            <button onClick={() => void create('employer')} disabled={busy} style={btn()}>
              + İşveren Hakedişi
            </button>
            <button onClick={() => void create('subcontractor')} disabled={busy} style={btn()}>
              + Taşeron Hakedişi
            </button>
          </>
        ) : null}
      </div>

      {error !== null ? <div style={errorBox()}>Hata: {error}</div> : null}

      {contractId === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-muted, #888)' }}>
          Hakediş için bir sözleşme seçin.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 14, margin: '0 0 6px' }}>Hakedişler ({list.length})</h3>
            {list.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--ink-muted, #888)' }}>Henüz hakediş yok.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {list.map((p) => (
                  <button
                    key={String(p.id)}
                    onClick={() => void open(p.id)}
                    style={{
                      ...btn(),
                      textAlign: 'left',
                      borderColor: selected?.id === p.id ? 'var(--accent, #0066cc)' : undefined,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{p.hakedisNo}</span>{' '}
                    <span style={{ color: 'var(--ink-muted, #888)' }}>
                      ({p.kind === 'employer' ? 'işv.' : 'taş.'} #{p.seqNo})
                    </span>{' '}
                    <span style={badge(STATUS_COLORS[p.status])}>{STATUS_LABELS[p.status]}</span>
                    <div style={{ fontSize: 11, color: 'var(--ink-muted, #888)' }}>
                      Net: {p.netPayable.toLocaleString('tr-TR')} {p.currency}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            {selected !== null ? (
              <HakedisDetail
                api={api}
                companyId={companyId}
                progress={selected}
                onChanged={(dto) => void refreshSelected(dto)}
                onError={setError}
              />
            ) : (
              <p style={{ fontSize: 13, color: 'var(--ink-muted, #888)' }}>
                Detay için bir hakediş seçin veya yeni oluşturun.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

interface DeductionRow {
  kind: DeductionKind;
  amount: string;
}

function HakedisDetail({
  api,
  companyId,
  progress,
  onChanged,
  onError,
}: {
  api: ConstructionApi;
  companyId: number;
  progress: ProgressPaymentDto;
  onChanged: (dto: ProgressPaymentDto) => void;
  onError: (msg: string | null) => void;
}): JSX.Element {
  const editable = isEditable(progress.status);
  const [qty, setQty] = useState<Record<number, string>>({});
  const [priceDiff, setPriceDiff] = useState<string>(String(progress.priceDiff));
  const [deds, setDeds] = useState<DeductionRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q: Record<number, string> = {};
    for (const l of progress.lines) q[l.boqLineId] = String(l.thisQty);
    setQty(q);
    setPriceDiff(String(progress.priceDiff));
    setDeds(progress.deductions.map((d) => ({ kind: d.kind, amount: String(d.amount) })));
  }, [progress]);

  const saveLines = async (): Promise<void> => {
    setBusy(true);
    onError(null);
    try {
      const quantities = progress.lines.map((l) => ({
        boqLineId: l.boqLineId,
        thisQty: Number(qty[l.boqLineId] ?? '0') || 0,
      }));
      const dto = await api.saveProgressLines(progress.id, { companyId, quantities });
      onChanged(dto);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Satırlar kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  const saveDeductions = async (): Promise<void> => {
    setBusy(true);
    onError(null);
    try {
      const deductions: DeductionBody[] = deds
        .filter((d) => Number(d.amount) > 0)
        .map((d) => ({ kind: d.kind, amount: Number(d.amount) }));
      const dto = await api.saveDeductions(progress.id, {
        companyId,
        priceDiff: Number(priceDiff) || 0,
        deductions,
      });
      onChanged(dto);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Kesintiler kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (to: ProgressStatus): Promise<void> => {
    setBusy(true);
    onError(null);
    try {
      const dto = await api.changeProgressStatus(progress.id, { companyId, status: to });
      onChanged(dto);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Durum değiştirilemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <h3 style={{ fontSize: 15, margin: 0 }}>{progress.hakedisNo}</h3>
        <span style={badge(STATUS_COLORS[progress.status])}>{STATUS_LABELS[progress.status]}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-muted, #888)' }}>
          {progress.kind === 'employer' ? 'İşveren' : 'Taşeron'} ·{' '}
          {progress.ptype === 'final' ? 'Kesin' : 'Geçici'} · #{progress.seqNo}
        </span>
      </div>

      <table className="grid">
        <thead>
          <tr>
            <th style={cell()}>İş Kalemi</th>
            <th style={{ ...cell(), textAlign: 'right' }}>Önceki</th>
            <th style={{ ...cell(), textAlign: 'right' }}>Bu Dönem</th>
            <th style={{ ...cell(), textAlign: 'right' }}>Kümülatif</th>
            <th style={{ ...cell(), textAlign: 'right' }}>Birim Fiyat</th>
            <th style={{ ...cell(), textAlign: 'right' }}>Bu Dönem Tutar</th>
          </tr>
        </thead>
        <tbody>
          {progress.lines.map((l) => (
            <tr key={String(l.id)}>
              <td style={cell()}>#{l.boqLineId}</td>
              <td style={{ ...cell(), textAlign: 'right' }}>{l.prevQty}</td>
              <td style={{ ...cell(), textAlign: 'right' }}>
                {editable ? (
                  <input
                    type="number"
                    value={qty[l.boqLineId] ?? '0'}
                    onChange={(ev) => setQty((p) => ({ ...p, [l.boqLineId]: ev.target.value }))}
                    style={field({ width: 90, textAlign: 'right' })}
                  />
                ) : (
                  l.thisQty
                )}
              </td>
              <td style={{ ...cell(), textAlign: 'right' }}>{l.cumulQty}</td>
              <td style={{ ...cell(), textAlign: 'right' }}>
                {l.unitPrice.toLocaleString('tr-TR')}
              </td>
              <td style={{ ...cell(), textAlign: 'right' }}>
                {l.thisAmount.toLocaleString('tr-TR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editable ? (
        <button onClick={() => void saveLines()} disabled={busy} style={{ ...btn(), marginTop: 8 }}>
          Satırları Kaydet
        </button>
      ) : null}

      {/* Kesintiler */}
      <h4 style={{ fontSize: 13, margin: '16px 0 6px' }}>Kesintiler & Fiyat Farkı</h4>
      {editable ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ fontSize: 12 }}>
            Fiyat farkı (ilave):{' '}
            <input
              type="number"
              value={priceDiff}
              onChange={(ev) => setPriceDiff(ev.target.value)}
              style={field({ width: 120, textAlign: 'right' })}
            />
          </label>
          {deds.map((d, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 6 }}>
              <select
                value={d.kind}
                onChange={(ev) =>
                  setDeds((p) =>
                    p.map((x, i) =>
                      i === idx ? { ...x, kind: ev.target.value as DeductionKind } : x,
                    ),
                  )
                }
                style={field({ width: 180 })}
              >
                {(Object.keys(DEDUCTION_LABELS) as DeductionKind[]).map((k) => (
                  <option key={k} value={k}>
                    {DEDUCTION_LABELS[k]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={d.amount}
                onChange={(ev) =>
                  setDeds((p) =>
                    p.map((x, i) => (i === idx ? { ...x, amount: ev.target.value } : x)),
                  )
                }
                placeholder="Tutar"
                style={field({ width: 120, textAlign: 'right' })}
              />
              <button onClick={() => setDeds((p) => p.filter((_, i) => i !== idx))} style={btn()}>
                −
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setDeds((p) => [...p, { kind: 'retention', amount: '' }])}
              style={btn()}
            >
              + Kesinti
            </button>
            <button onClick={() => void saveDeductions()} disabled={busy} style={btn()}>
              Kesintileri Kaydet
            </button>
          </div>
        </div>
      ) : (
        <ul style={{ fontSize: 12, margin: 0, paddingLeft: 18 }}>
          {progress.deductions.length === 0 ? (
            <li style={{ color: 'var(--ink-muted, #888)' }}>Kesinti yok</li>
          ) : (
            progress.deductions.map((d) => (
              <li key={String(d.id)}>
                {DEDUCTION_LABELS[d.kind]}: {(d.sign * d.amount).toLocaleString('tr-TR')}
              </li>
            ))
          )}
        </ul>
      )}

      {/* Toplamlar */}
      <div style={{ marginTop: 14, fontSize: 13, display: 'grid', gap: 2, maxWidth: 320 }}>
        <Row
          label="Bu Dönem Yapılan İş"
          value={`${progress.grossThis.toLocaleString('tr-TR')} ${progress.currency}`}
        />
        <Row
          label="Kümülatif Yapılan İş"
          value={`${progress.grossCumul.toLocaleString('tr-TR')} ${progress.currency}`}
        />
        <Row
          label="Fiyat Farkı"
          value={`${progress.priceDiff.toLocaleString('tr-TR')} ${progress.currency}`}
        />
        <Row
          label="Kesinti Toplamı"
          value={`${progress.deductionsTot.toLocaleString('tr-TR')} ${progress.currency}`}
        />
        <Row
          label="Ödenecek Net"
          value={`${progress.netPayable.toLocaleString('tr-TR')} ${progress.currency}`}
          strong
        />
      </div>

      {/* Durum aksiyonları */}
      <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
        {nextStatusActions(progress.status).map((a) => (
          <button
            key={a.to}
            onClick={() => void changeStatus(a.to)}
            disabled={busy}
            style={{ ...btn(), background: a.bg, color: '#fff', border: 'none' }}
          >
            {a.label}
          </button>
        ))}
        {progress.status !== 'paid' && progress.status !== 'cancelled' ? (
          <button onClick={() => void changeStatus('cancelled')} disabled={busy} style={btn()}>
            İptal
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontWeight: strong === true ? 700 : 400,
        borderTop: strong === true ? '1px solid var(--line, #ccc)' : undefined,
        paddingTop: strong === true ? 4 : 0,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function cell(): React.CSSProperties {
  return {};
}
function field(extra: React.CSSProperties): React.CSSProperties {
  return {
    width: '100%',
    padding: '7px 10px',
    fontSize: 13,
    fontFamily: 'inherit',
    background: 'var(--paper, #fff)',
    border: '1px solid var(--line-strong, #d6d3d1)',
    borderRadius: 'var(--radius, 6px)',
    color: 'var(--ink, #1c1917)',
    outline: 'none',
    minWidth: 0,
    ...extra,
  };
}
function btn(): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: '6px 12px',
    fontSize: 12.5,
    fontWeight: 500,
    fontFamily: 'inherit',
    border: '1px solid var(--line-strong, #d6d3d1)',
    borderRadius: 'var(--radius, 6px)',
    background: 'var(--paper, #fff)',
    color: 'var(--ink, #1c1917)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}
function badge(bg: string): React.CSSProperties {
  return {
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 999,
    background: bg,
    color: '#fff',
  };
}
function errorBox(): React.CSSProperties {
  return {
    padding: 10,
    background: 'var(--danger-bg, #fee2e2)',
    color: 'var(--danger, #b91c1c)',
    border: '1px solid var(--danger, #fca5a5)',
    borderRadius: 6,
    marginBottom: 12,
    fontSize: 13,
  };
}
