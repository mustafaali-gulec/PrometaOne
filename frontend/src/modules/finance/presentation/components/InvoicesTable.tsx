/**
 * InvoicesTable — fatura listesi tablosu (durum rozetli).
 *
 * Tutarlar backend'den decimal string olarak gelir; salt görüntüleme.
 * onSelect verilirse satır tıklanabilir olur.
 */
import type { FlowDirection, InvoiceDto, InvoiceStatus } from '../../application/dto/FinanceDtos';

export interface InvoicesTableProps {
  invoices: ReadonlyArray<InvoiceDto>;
  loading?: boolean;
  onSelect?: (id: number) => void;
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  open: 'Açık',
  partial: 'Kısmi',
  paid: 'Ödendi',
  overdue: 'Gecikmiş',
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  open: '#6366f1',
  partial: '#f59e0b',
  paid: '#10b981',
  overdue: '#ef4444',
};

const TYPE_LABELS: Record<FlowDirection, string> = {
  in: 'Alacak',
  out: 'Borç',
};

export function InvoicesTable({ invoices, loading, onSelect }: InvoicesTableProps): JSX.Element {
  if (loading === true) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Yükleniyor…
      </div>
    );
  }
  if (invoices.length === 0) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Fatura bulunamadı.
      </div>
    );
  }

  return (
    <table
      data-testid="invoices-table"
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <thead>
        <tr style={{ background: 'var(--paper-2, #f5f5f5)', textAlign: 'left' }}>
          <th style={cell()}>Tip</th>
          <th style={cell()}>Karşı Taraf</th>
          <th style={cell()}>Fatura No</th>
          <th style={cell()}>Vade</th>
          <th style={{ ...cell(), textAlign: 'right' }}>Toplam</th>
          <th style={{ ...cell(), textAlign: 'right' }}>Kalan</th>
          <th style={cell()}>Durum</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((inv) => (
          <tr
            key={inv.id ?? `${inv.counterparty}-${inv.dueDate}`}
            style={{
              borderBottom: '1px solid var(--line, #e5e5e5)',
              cursor: onSelect && inv.id !== null ? 'pointer' : 'default',
            }}
            onClick={onSelect && inv.id !== null ? () => onSelect(inv.id as number) : undefined}
          >
            <td style={cell()}>{TYPE_LABELS[inv.type]}</td>
            <td style={cell()}>
              <strong>{inv.counterparty}</strong>
            </td>
            <td style={cell()}>{inv.invoiceNo ?? '—'}</td>
            <td style={cell()}>{inv.dueDate}</td>
            <td style={{ ...cell(), textAlign: 'right' }}>
              {inv.total} {inv.currency}
            </td>
            <td style={{ ...cell(), textAlign: 'right' }}>
              {inv.remaining} {inv.currency}
            </td>
            <td style={cell()}>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: STATUS_COLORS[inv.status],
                  color: '#fff',
                }}
              >
                {STATUS_LABELS[inv.status]}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function cell(): React.CSSProperties {
  return { padding: '8px 12px', borderBottom: '1px solid var(--line, #e5e5e5)' };
}
