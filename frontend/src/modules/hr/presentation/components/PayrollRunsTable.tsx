/**
 * PayrollRunsTable — bordro koşuları listesi tablosu.
 *
 * Hesapla (run-batch) ve Kesinleştir (finalize) yetkisi backend'de
 * hr_manager rolünde; UI'da action butonları yalnızca draft kayıtlar için
 * gösterilir. Fiş görüntüleme (slip) tüm koşular için açık.
 */
import type { PayrollRunDto, PayrollRunStatus } from '../../application/dto/HrDtos';

export interface PayrollRunsTableProps {
  payrollRuns: ReadonlyArray<PayrollRunDto>;
  loading?: boolean;
  onRunBatch?: (id: number) => void;
  onFinalize?: (id: number) => void;
  onView?: (id: number) => void;
}

const STATUS_LABELS: Record<PayrollRunStatus, string> = {
  draft: 'Taslak',
  finalized: 'Kesinleşti',
};

const STATUS_COLORS: Record<PayrollRunStatus, string> = {
  draft: '#f59e0b',
  finalized: '#10b981',
};

const MONTH_LABELS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

function periodLabel(run: PayrollRunDto): string {
  const m = MONTH_LABELS[run.periodMonth - 1] ?? String(run.periodMonth);
  return `${m} ${run.periodYear}`;
}

export function PayrollRunsTable({
  payrollRuns,
  loading,
  onRunBatch,
  onFinalize,
  onView,
}: PayrollRunsTableProps): JSX.Element {
  if (loading === true) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Yükleniyor…
      </div>
    );
  }
  if (payrollRuns.length === 0) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Bordro koşusu bulunamadı.
      </div>
    );
  }
  const showActions = onRunBatch !== undefined || onFinalize !== undefined || onView !== undefined;
  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <thead>
        <tr style={{ background: 'var(--paper-2, #f5f5f5)', textAlign: 'left' }}>
          <th style={cellStyle()}>Dönem</th>
          <th style={cellStyle()}>Durum</th>
          <th style={cellStyle()}>Not</th>
          <th style={cellStyle()}>Kesinleşme</th>
          {showActions ? <th style={cellStyle()}>İşlem</th> : null}
        </tr>
      </thead>
      <tbody>
        {payrollRuns.map((run) => (
          <tr key={run.id} style={{ borderBottom: '1px solid var(--line, #e5e5e5)' }}>
            <td style={cellStyle()}>{periodLabel(run)}</td>
            <td style={cellStyle()}>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: STATUS_COLORS[run.status],
                  color: '#fff',
                }}
              >
                {STATUS_LABELS[run.status]}
              </span>
            </td>
            <td style={cellStyle()}>{run.note ?? '—'}</td>
            <td style={cellStyle()}>
              {run.finalizedAt !== null ? run.finalizedAt.slice(0, 10) : '—'}
            </td>
            {showActions ? (
              <td style={cellStyle()}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {onView !== undefined ? (
                    <button
                      type="button"
                      onClick={() => onView(run.id)}
                      style={actionStyle('#3b82f6')}
                    >
                      Fiş
                    </button>
                  ) : null}
                  {run.status === 'draft' && onRunBatch !== undefined ? (
                    <button
                      type="button"
                      onClick={() => onRunBatch(run.id)}
                      style={actionStyle('#6366f1')}
                    >
                      Hesapla
                    </button>
                  ) : null}
                  {run.status === 'draft' && onFinalize !== undefined ? (
                    <button
                      type="button"
                      onClick={() => onFinalize(run.id)}
                      style={actionStyle('#10b981')}
                    >
                      Kesinleştir
                    </button>
                  ) : null}
                </div>
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function cellStyle(): React.CSSProperties {
  return {
    padding: '8px 12px',
    borderBottom: '1px solid var(--line, #e5e5e5)',
  };
}

function actionStyle(bg: string): React.CSSProperties {
  return {
    padding: '4px 10px',
    border: 'none',
    background: bg,
    color: '#fff',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
  };
}
