/**
 * FinansManager — Şantiye harcama & finans (SF-4). Proje seç → maliyet özeti
 * (bütçe vs gerçekleşen) + alt sekmeler: Giderler / Avanslar / Kasa-Banka.
 * Her sekme: liste + hızlı ekleme + silme.
 */
import { useEffect, useState } from 'react';

import type {
  AdvanceDto,
  CashMovementDto,
  ExpenseDto,
  ProjectCostSummaryDto,
  ProjectDto,
} from '../../application/dto/ConstructionDtos';
import type { ConstructionApi } from '../../application/ports/ConstructionApi';
import { useProjects } from '../hooks/useProjects';

type Sub = 'expenses' | 'advances' | 'cash';
const SUB_LABELS: Record<Sub, string> = {
  expenses: 'Giderler',
  advances: 'Avanslar',
  cash: 'Kasa / Banka',
};

export interface FinansManagerProps {
  api: ConstructionApi;
  companyId: number;
}

export function FinansManager({ api, companyId }: FinansManagerProps): JSX.Element {
  const { projects } = useProjects(api, companyId);
  const [projectId, setProjectId] = useState<number>(0);
  const [sub, setSub] = useState<Sub>('expenses');
  const [summary, setSummary] = useState<ProjectCostSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // refresh tetikleyici

  useEffect(() => {
    if (!(projectId > 0)) {
      setSummary(null);
      return;
    }
    let off = false;
    api
      .getCostSummary(projectId, companyId)
      .then((s) => {
        if (!off) setSummary(s);
      })
      .catch((e: unknown) => {
        if (!off) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      off = true;
    };
  }, [api, companyId, projectId, tick]);

  const refresh = (): void => setTick((t) => t + 1);

  return (
    <section>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-muted, #666)' }}>Proje:</span>
        <select
          value={projectId}
          onChange={(ev) => setProjectId(Number(ev.target.value))}
          style={fld({ minWidth: 260 })}
        >
          <option value={0}>— Proje seç —</option>
          {projects.map((p: ProjectDto) => (
            <option key={String(p.id)} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </div>

      {error !== null ? <div style={errBox()}>Hata: {error}</div> : null}

      {projectId === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-muted, #888)' }}>Bir proje seçin.</p>
      ) : (
        <>
          {summary !== null ? (
            <div
              style={{
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
                padding: 12,
                border: '1px solid var(--line, #e5e7eb)',
                borderRadius: 6,
                background: 'var(--paper-2, #f9fafb)',
                marginBottom: 12,
                fontSize: 13,
              }}
            >
              <Metric
                label="Bütçe"
                value={`${summary.budgetAmount.toLocaleString('tr-TR')} ${summary.currency}`}
              />
              <Metric
                label="Gerçekleşen"
                value={`${summary.spentTotal.toLocaleString('tr-TR')} ${summary.currency}`}
              />
              <Metric
                label="Sapma (kalan)"
                value={`${summary.variance.toLocaleString('tr-TR')} ${summary.currency}`}
                color={summary.variance < 0 ? '#b91c1c' : '#15803d'}
              />
              {summary.byCategory.map((c) => (
                <Metric
                  key={c.category}
                  label={c.category}
                  value={c.amount.toLocaleString('tr-TR')}
                />
              ))}
            </div>
          ) : null}

          <nav
            style={{
              display: 'flex',
              gap: 4,
              borderBottom: '1px solid var(--line, #e5e5e5)',
              marginBottom: 12,
            }}
          >
            {(Object.keys(SUB_LABELS) as Sub[]).map((s) => (
              <button
                key={s}
                onClick={() => setSub(s)}
                style={{
                  padding: '6px 14px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: sub === s ? 600 : 400,
                  borderBottom:
                    sub === s ? '2px solid var(--accent, #0066cc)' : '2px solid transparent',
                  color: sub === s ? 'var(--accent, #0066cc)' : 'var(--ink, #111)',
                }}
              >
                {SUB_LABELS[s]}
              </button>
            ))}
          </nav>

          {sub === 'expenses' ? (
            <ExpensesSection
              api={api}
              companyId={companyId}
              projectId={projectId}
              onChanged={refresh}
              onError={setError}
            />
          ) : null}
          {sub === 'advances' ? (
            <AdvancesSection
              api={api}
              companyId={companyId}
              projectId={projectId}
              onError={setError}
            />
          ) : null}
          {sub === 'cash' ? (
            <CashSection api={api} companyId={companyId} projectId={projectId} onError={setError} />
          ) : null}
        </>
      )}
    </section>
  );
}

function ExpensesSection({
  api,
  companyId,
  projectId,
  onChanged,
  onError,
}: {
  api: ConstructionApi;
  companyId: number;
  projectId: number;
  onChanged: () => void;
  onError: (m: string | null) => void;
}): JSX.Element {
  const [rows, setRows] = useState<ReadonlyArray<ExpenseDto>>([]);
  const [cat, setCat] = useState('malzeme');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [spentAt, setSpentAt] = useState('');
  const [busy, setBusy] = useState(false);

  const load = (): void => {
    api
      .listExpenses(companyId, projectId)
      .then((r) => setRows(r.expenses))
      .catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(load, [api, companyId, projectId]);

  const add = async (): Promise<void> => {
    if (amount === '' || spentAt === '') {
      onError('Tutar ve tarih zorunlu');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await api.createExpense({
        companyId,
        projectId,
        category: cat,
        description: desc.trim() === '' ? null : desc.trim(),
        amount: Number(amount),
        spentAt,
      });
      setDesc('');
      setAmount('');
      load();
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Gider eklenemedi');
    } finally {
      setBusy(false);
    }
  };
  const del = async (id: number): Promise<void> => {
    await api.deleteExpense(id, companyId);
    load();
    onChanged();
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={fld({ width: 130 })}>
          <option value="malzeme">Malzeme</option>
          <option value="iscilik">İşçilik</option>
          <option value="makine">Makine</option>
          <option value="genel">Genel</option>
          <option value="other">Diğer</option>
        </select>
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Açıklama"
          style={fld({ flex: 1, minWidth: 140 })}
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Tutar"
          style={fld({ width: 120 })}
        />
        <input
          type="date"
          value={spentAt}
          onChange={(e) => setSpentAt(e.target.value)}
          style={fld({ width: 150 })}
        />
        <button onClick={() => void add()} disabled={busy} style={btn()}>
          + Gider
        </button>
      </div>
      <Table
        head={['Tarih', 'Kategori', 'Açıklama', 'Tutar', '']}
        rows={rows.map((e) => [
          e.spentAt,
          e.category,
          e.description ?? '—',
          `${e.amount.toLocaleString('tr-TR')} ${e.currency}`,
          <button key="d" onClick={() => void del(e.id)} style={delBtn()}>
            Sil
          </button>,
        ])}
        empty="Gider yok."
      />
    </div>
  );
}

function AdvancesSection({
  api,
  companyId,
  projectId,
  onError,
}: {
  api: ConstructionApi;
  companyId: number;
  projectId: number;
  onError: (m: string | null) => void;
}): JSX.Element {
  const [rows, setRows] = useState<ReadonlyArray<AdvanceDto>>([]);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [offset, setOffset] = useState('');
  const [givenAt, setGivenAt] = useState('');
  const [busy, setBusy] = useState(false);

  const load = (): void => {
    api
      .listAdvances(companyId, projectId)
      .then((r) => setRows(r.advances))
      .catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(load, [api, companyId, projectId]);

  const add = async (): Promise<void> => {
    if (amount === '' || givenAt === '') {
      onError('Tutar ve tarih zorunlu');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await api.createAdvance({
        companyId,
        projectId,
        description: desc.trim() === '' ? null : desc.trim(),
        amount: Number(amount),
        offsetAmount: offset === '' ? 0 : Number(offset),
        givenAt,
      });
      setDesc('');
      setAmount('');
      setOffset('');
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Avans eklenemedi');
    } finally {
      setBusy(false);
    }
  };
  const del = async (id: number): Promise<void> => {
    await api.deleteAdvance(id, companyId);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Açıklama"
          style={fld({ flex: 1, minWidth: 140 })}
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Avans tutarı"
          style={fld({ width: 130 })}
        />
        <input
          type="number"
          value={offset}
          onChange={(e) => setOffset(e.target.value)}
          placeholder="Mahsup"
          style={fld({ width: 110 })}
        />
        <input
          type="date"
          value={givenAt}
          onChange={(e) => setGivenAt(e.target.value)}
          style={fld({ width: 150 })}
        />
        <button onClick={() => void add()} disabled={busy} style={btn()}>
          + Avans
        </button>
      </div>
      <Table
        head={['Tarih', 'Açıklama', 'Tutar', 'Mahsup', 'Kalan', '']}
        rows={rows.map((a) => [
          a.givenAt,
          a.description ?? '—',
          a.amount.toLocaleString('tr-TR'),
          a.offsetAmount.toLocaleString('tr-TR'),
          `${a.remaining.toLocaleString('tr-TR')} ${a.currency}`,
          <button key="d" onClick={() => void del(a.id)} style={delBtn()}>
            Sil
          </button>,
        ])}
        empty="Avans yok."
      />
    </div>
  );
}

function CashSection({
  api,
  companyId,
  projectId,
  onError,
}: {
  api: ConstructionApi;
  companyId: number;
  projectId: number;
  onError: (m: string | null) => void;
}): JSX.Element {
  const [rows, setRows] = useState<ReadonlyArray<CashMovementDto>>([]);
  const [direction, setDirection] = useState<1 | -1>(-1);
  const [accountRef, setAccountRef] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [movedAt, setMovedAt] = useState('');
  const [busy, setBusy] = useState(false);

  const load = (): void => {
    api
      .listCash(companyId, projectId)
      .then((r) => setRows(r.movements))
      .catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(load, [api, companyId, projectId]);

  const add = async (): Promise<void> => {
    if (amount === '' || movedAt === '') {
      onError('Tutar ve tarih zorunlu');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await api.createCash({
        companyId,
        projectId,
        direction,
        accountRef: accountRef.trim() === '' ? null : accountRef.trim(),
        description: desc.trim() === '' ? null : desc.trim(),
        amount: Number(amount),
        movedAt,
      });
      setAccountRef('');
      setDesc('');
      setAmount('');
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Hareket eklenemedi');
    } finally {
      setBusy(false);
    }
  };
  const del = async (id: number): Promise<void> => {
    await api.deleteCash(id, companyId);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <select
          value={direction}
          onChange={(e) => setDirection(Number(e.target.value) as 1 | -1)}
          style={fld({ width: 120 })}
        >
          <option value={-1}>Tediye (-)</option>
          <option value={1}>Tahsilat (+)</option>
        </select>
        <input
          value={accountRef}
          onChange={(e) => setAccountRef(e.target.value)}
          placeholder="Kasa/Banka"
          style={fld({ width: 130 })}
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Açıklama"
          style={fld({ flex: 1, minWidth: 120 })}
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Tutar"
          style={fld({ width: 120 })}
        />
        <input
          type="date"
          value={movedAt}
          onChange={(e) => setMovedAt(e.target.value)}
          style={fld({ width: 150 })}
        />
        <button onClick={() => void add()} disabled={busy} style={btn()}>
          + Hareket
        </button>
      </div>
      <Table
        head={['Tarih', 'Yön', 'Hesap', 'Açıklama', 'Tutar', '']}
        rows={rows.map((m) => [
          m.movedAt,
          m.direction > 0 ? 'Tahsilat' : 'Tediye',
          m.accountRef ?? '—',
          m.description ?? '—',
          `${(m.direction * m.amount).toLocaleString('tr-TR')} ${m.currency}`,
          <button key="d" onClick={() => void del(m.id)} style={delBtn()}>
            Sil
          </button>,
        ])}
        empty="Hareket yok."
      />
    </div>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}): JSX.Element {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--ink-muted, #888)', textTransform: 'capitalize' }}>
        {label}
      </div>
      <div style={{ fontWeight: 600, color: color ?? 'inherit' }}>{value}</div>
    </div>
  );
}

function Table({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: Array<Array<React.ReactNode>>;
  empty: string;
}): JSX.Element {
  if (rows.length === 0) {
    return <p style={{ fontSize: 12, color: 'var(--ink-muted, #888)' }}>{empty}</p>;
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
      <thead>
        <tr style={{ background: 'var(--paper-2, #f5f5f5)', textAlign: 'left' }}>
          {head.map((h, i) => (
            <th
              key={i}
              style={{ padding: '7px 9px', borderBottom: '1px solid var(--line, #e5e5e5)' }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} style={{ borderBottom: '1px solid var(--line, #eee)' }}>
            {r.map((cell, ci) => (
              <td key={ci} style={{ padding: '7px 9px' }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function fld(extra: React.CSSProperties): React.CSSProperties {
  return {
    padding: '6px 8px',
    border: '1px solid var(--line, #d1d5db)',
    borderRadius: 4,
    fontSize: 12,
    ...extra,
  };
}
function btn(): React.CSSProperties {
  return {
    padding: '6px 12px',
    border: '1px solid var(--line, #d1d5db)',
    borderRadius: 4,
    background: 'var(--paper, #fff)',
    cursor: 'pointer',
    fontSize: 12,
  };
}
function delBtn(): React.CSSProperties {
  return {
    padding: '3px 10px',
    border: 'none',
    borderRadius: 4,
    background: '#ef4444',
    color: '#fff',
    fontSize: 11,
    cursor: 'pointer',
  };
}
function errBox(): React.CSSProperties {
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
