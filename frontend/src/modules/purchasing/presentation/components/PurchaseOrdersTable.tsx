/**
 * PurchaseOrdersTable — satınalma siparişleri tablosu (durum rozetli).
 *
 * Tutarlar salt görüntülemedir. onMarkOrdered/onMarkReceived/onCancel verilirse
 * uygun durumlardaki satırlarda aksiyon butonları gösterilir.
 */
import type { PoStatus, PurchaseOrderDto } from '../../application/dto/PurchasingDtos';

export interface PurchaseOrdersTableProps {
  orders: ReadonlyArray<PurchaseOrderDto>;
  loading?: boolean;
  onMarkOrdered?: (id: number) => void;
  onMarkReceived?: (id: number) => void;
  onCancel?: (id: number) => void;
}

const STATUS_LABELS: Record<PoStatus, string> = {
  draft: 'Taslak',
  ordered: 'Sipariş Verildi',
  partial: 'Kısmi',
  received: 'Teslim Alındı',
  closed: 'Kapatıldı',
  cancelled: 'İptal',
  invoiced: 'Faturalandı',
};

const STATUS_COLORS: Record<PoStatus, string> = {
  draft: '#9ca3af',
  ordered: '#6366f1',
  partial: '#f59e0b',
  received: '#10b981',
  closed: '#6b7280',
  cancelled: '#ef4444',
  invoiced: '#0ea5e9',
};

export function PurchaseOrdersTable({
  orders,
  loading,
  onMarkOrdered,
  onMarkReceived,
  onCancel,
}: PurchaseOrdersTableProps): JSX.Element {
  if (loading === true) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Yükleniyor…
      </div>
    );
  }
  if (orders.length === 0) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Sipariş bulunamadı.
      </div>
    );
  }

  const showActions =
    onMarkOrdered !== undefined || onMarkReceived !== undefined || onCancel !== undefined;

  return (
    <table
      data-testid="purchase-orders-table"
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <thead>
        <tr style={{ background: 'var(--paper-2, #f5f5f5)', textAlign: 'left' }}>
          <th style={cell()}>Sipariş No</th>
          <th style={cell()}>Tedarikçi</th>
          <th style={cell()}>Sipariş Tarihi</th>
          <th style={{ ...cell(), textAlign: 'right' }}>Toplam</th>
          <th style={cell()}>Durum</th>
          {showActions ? <th style={cell()}>İşlem</th> : null}
        </tr>
      </thead>
      <tbody>
        {orders.map((po) => (
          <tr key={String(po.id)} style={{ borderBottom: '1px solid var(--line, #e5e5e5)' }}>
            <td style={cell()}>
              <strong>{po.poNo}</strong>
            </td>
            <td style={cell()}>#{String(po.vendorId)}</td>
            <td style={cell()}>{po.orderedAt ?? '—'}</td>
            <td style={{ ...cell(), textAlign: 'right' }}>
              {po.totalAmount} {po.currency}
            </td>
            <td style={cell()}>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: STATUS_COLORS[po.status],
                  color: '#fff',
                }}
              >
                {STATUS_LABELS[po.status]}
              </span>
            </td>
            {showActions ? (
              <td style={cell()}>
                <span style={{ display: 'inline-flex', gap: 6 }}>
                  {onMarkOrdered !== undefined && po.status === 'draft' ? (
                    <button onClick={() => onMarkOrdered(po.id)} style={actionBtn('#6366f1')}>
                      Sipariş ver
                    </button>
                  ) : null}
                  {onMarkReceived !== undefined &&
                  (po.status === 'ordered' || po.status === 'partial') ? (
                    <button onClick={() => onMarkReceived(po.id)} style={actionBtn('#10b981')}>
                      Teslim al
                    </button>
                  ) : null}
                  {onCancel !== undefined && (po.status === 'draft' || po.status === 'ordered') ? (
                    <button onClick={() => onCancel(po.id)} style={actionBtn('#ef4444')}>
                      İptal
                    </button>
                  ) : null}
                </span>
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function cell(): React.CSSProperties {
  return { padding: '8px 12px', borderBottom: '1px solid var(--line, #e5e5e5)' };
}

function actionBtn(bg: string): React.CSSProperties {
  return {
    padding: '3px 10px',
    border: 'none',
    borderRadius: 4,
    background: bg,
    color: '#fff',
    fontSize: 11,
    cursor: 'pointer',
  };
}
