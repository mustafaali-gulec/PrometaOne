/**
 * RevaluationsTable — kur farkı değerleme listesi + muhasebeleştir (post) aksiyonu.
 */
import type { RevaluationDto } from '../../application/dto/EInvoiceDtos';

export interface RevaluationsTableProps {
  revaluations: ReadonlyArray<RevaluationDto>;
  loading?: boolean;
  onPost?: (id: number) => void;
}

export function RevaluationsTable({
  revaluations,
  loading,
  onPost,
}: RevaluationsTableProps): JSX.Element {
  if (loading === true) {
    return <div style={msg()}>Yükleniyor…</div>;
  }
  if (revaluations.length === 0) {
    return <div style={msg()}>Değerleme kaydı yok.</div>;
  }
  return (
    <table data-testid="revaluations-table" style={tableStyle()}>
      <thead>
        <tr style={{ background: 'var(--paper-2, #f5f5f5)', textAlign: 'left' }}>
          <th style={cell()}>Referans</th>
          <th style={cell()}>Değerleme</th>
          <th style={{ ...cell(), textAlign: 'right' }}>Kâr</th>
          <th style={{ ...cell(), textAlign: 'right' }}>Zarar</th>
          <th style={{ ...cell(), textAlign: 'right' }}>Net</th>
          <th style={cell()}>Durum</th>
          <th style={cell()}>İşlem</th>
        </tr>
      </thead>
      <tbody>
        {revaluations.map((r) => (
          <tr
            key={r.id ?? `${r.referenceDate}-${r.valuationDate}`}
            style={{ borderBottom: '1px solid var(--line, #e5e5e5)' }}
          >
            <td style={cell()}>{r.referenceDate}</td>
            <td style={cell()}>{r.valuationDate}</td>
            <td style={{ ...cell(), textAlign: 'right', color: '#10b981' }}>{r.gainTotal}</td>
            <td style={{ ...cell(), textAlign: 'right', color: '#ef4444' }}>{r.lossTotal}</td>
            <td style={{ ...cell(), textAlign: 'right', fontWeight: 700 }} data-testid="reval-net">
              {r.net}
            </td>
            <td style={cell()}>
              <span style={badge(r.posted ? '#10b981' : '#f59e0b')}>
                {r.posted ? 'Muhasebeleşti' : 'Taslak'}
              </span>
            </td>
            <td style={cell()}>
              {!r.posted && r.id !== null && onPost ? (
                <button type="button" onClick={() => onPost(r.id as number)} style={btn()}>
                  Muhasebeleştir
                </button>
              ) : (
                <span style={{ color: 'var(--ink-muted, #999)', fontSize: 12 }}>—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function tableStyle(): React.CSSProperties {
  return {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    fontFamily: 'system-ui, sans-serif',
  };
}
function cell(): React.CSSProperties {
  return { padding: '8px 12px', borderBottom: '1px solid var(--line, #e5e5e5)' };
}
function badge(color: string): React.CSSProperties {
  return { fontSize: 11, padding: '2px 8px', borderRadius: 999, background: color, color: '#fff' };
}
function btn(): React.CSSProperties {
  return {
    padding: '3px 10px',
    border: 'none',
    borderRadius: 4,
    background: 'var(--accent, #0066cc)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
  };
}
function msg(): React.CSSProperties {
  return { padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' };
}
