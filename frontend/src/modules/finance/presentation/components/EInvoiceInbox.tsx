/**
 * EInvoiceInbox — gelen/giden e-fatura cache tablosu + import/ignore aksiyonları.
 */
import type { EInvoiceDto, InvoiceDirection } from '../../application/dto/EInvoiceDtos';

export interface EInvoiceInboxProps {
  einvoices: ReadonlyArray<EInvoiceDto>;
  loading?: boolean;
  onImport?: (id: number) => void;
  onIgnore?: (id: number) => void;
}

const DIRECTION_LABELS: Record<InvoiceDirection, string> = {
  incoming: 'Gelen',
  outgoing: 'Giden',
};

function statusOf(e: EInvoiceDto): { label: string; color: string } {
  if (e.importedInvoiceId !== null) return { label: 'Aktarıldı', color: '#10b981' };
  if (e.ignored) return { label: 'Yok sayıldı', color: '#9ca3af' };
  return { label: 'Bekliyor', color: '#f59e0b' };
}

export function EInvoiceInbox({
  einvoices,
  loading,
  onImport,
  onIgnore,
}: EInvoiceInboxProps): JSX.Element {
  if (loading === true) {
    return <div style={msg()}>Yükleniyor…</div>;
  }
  if (einvoices.length === 0) {
    return <div style={msg()}>E-fatura bulunamadı.</div>;
  }
  return (
    <table data-testid="einvoice-inbox" style={tableStyle()}>
      <thead>
        <tr style={{ background: 'var(--paper-2, #f5f5f5)', textAlign: 'left' }}>
          <th style={cell()}>Yön</th>
          <th style={cell()}>Karşı Taraf</th>
          <th style={cell()}>Fatura No</th>
          <th style={cell()}>Tarih</th>
          <th style={{ ...cell(), textAlign: 'right' }}>Ödenecek</th>
          <th style={cell()}>Durum</th>
          <th style={cell()}>İşlem</th>
        </tr>
      </thead>
      <tbody>
        {einvoices.map((e) => {
          const s = statusOf(e);
          const pending = e.importedInvoiceId === null && !e.ignored;
          return (
            <tr key={e.id ?? e.uuid} style={{ borderBottom: '1px solid var(--line, #e5e5e5)' }}>
              <td style={cell()}>{DIRECTION_LABELS[e.direction]}</td>
              <td style={cell()}>
                <strong>{e.partyName ?? e.partyVknTckn ?? '—'}</strong>
              </td>
              <td style={cell()}>{e.invoiceNo || '—'}</td>
              <td style={cell()}>{e.issueDate}</td>
              <td style={{ ...cell(), textAlign: 'right' }}>
                {e.payableAmount} {e.currency}
              </td>
              <td style={cell()}>
                <span style={badge(s.color)}>{s.label}</span>
              </td>
              <td style={cell()}>
                {pending && e.id !== null ? (
                  <span style={{ display: 'flex', gap: 6 }}>
                    {onImport ? (
                      <button
                        type="button"
                        onClick={() => onImport(e.id as number)}
                        style={btn('#0066cc')}
                      >
                        Aktar
                      </button>
                    ) : null}
                    {onIgnore ? (
                      <button
                        type="button"
                        onClick={() => onIgnore(e.id as number)}
                        style={btn('#9ca3af')}
                      >
                        Yok say
                      </button>
                    ) : null}
                  </span>
                ) : (
                  <span style={{ color: 'var(--ink-muted, #999)', fontSize: 12 }}>—</span>
                )}
              </td>
            </tr>
          );
        })}
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
function btn(bg: string): React.CSSProperties {
  return {
    padding: '3px 10px',
    border: 'none',
    borderRadius: 4,
    background: bg,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
  };
}
function msg(): React.CSSProperties {
  return { padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' };
}
