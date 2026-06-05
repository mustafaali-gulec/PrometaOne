/**
 * PurchaseRequestsTable — satınalma talepleri tablosu (durum rozetli).
 *
 * Tutarlar salt görüntülemedir. onApprove/onReject verilirse pending_approval
 * durumundaki satırlarda aksiyon butonları gösterilir.
 */
import type { PrStatus, PurchaseRequestDto } from '../../application/dto/PurchasingDtos';

export interface PurchaseRequestsTableProps {
  requests: ReadonlyArray<PurchaseRequestDto>;
  loading?: boolean;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
}

const STATUS_LABELS: Record<PrStatus, string> = {
  draft: 'Taslak',
  pending_approval: 'Onay Bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  ordered: 'Sipariş Verildi',
  received: 'Teslim Alındı',
  closed: 'Kapatıldı',
};

const STATUS_COLORS: Record<PrStatus, string> = {
  draft: '#9ca3af',
  pending_approval: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  ordered: '#6366f1',
  received: '#0ea5e9',
  closed: '#6b7280',
};

export function PurchaseRequestsTable({
  requests,
  loading,
  onApprove,
  onReject,
}: PurchaseRequestsTableProps): JSX.Element {
  if (loading === true) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Yükleniyor…
      </div>
    );
  }
  if (requests.length === 0) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Talep bulunamadı.
      </div>
    );
  }

  const showActions = onApprove !== undefined || onReject !== undefined;

  return (
    <table
      data-testid="purchase-requests-table"
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <thead>
        <tr style={{ background: 'var(--paper-2, #f5f5f5)', textAlign: 'left' }}>
          <th style={cell()}>Talep No</th>
          <th style={cell()}>Kategori</th>
          <th style={cell()}>Öncelik</th>
          <th style={cell()}>İhtiyaç Tarihi</th>
          <th style={{ ...cell(), textAlign: 'right' }}>Toplam</th>
          <th style={cell()}>Durum</th>
          {showActions ? <th style={cell()}>İşlem</th> : null}
        </tr>
      </thead>
      <tbody>
        {requests.map((pr) => (
          <tr key={String(pr.id)} style={{ borderBottom: '1px solid var(--line, #e5e5e5)' }}>
            <td style={cell()}>
              <strong>{pr.prNo}</strong>
            </td>
            <td style={cell()}>{pr.category}</td>
            <td style={cell()}>{pr.priority}</td>
            <td style={cell()}>{pr.requiredBy ?? '—'}</td>
            <td style={{ ...cell(), textAlign: 'right' }}>
              {pr.totalAmount} {pr.currency}
            </td>
            <td style={cell()}>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: STATUS_COLORS[pr.status],
                  color: '#fff',
                }}
              >
                {STATUS_LABELS[pr.status]}
              </span>
            </td>
            {showActions ? (
              <td style={cell()}>
                {pr.status === 'pending_approval' ? (
                  <span style={{ display: 'inline-flex', gap: 6 }}>
                    {onApprove !== undefined ? (
                      <button onClick={() => onApprove(pr.id)} style={actionBtn('#10b981')}>
                        Onayla
                      </button>
                    ) : null}
                    {onReject !== undefined ? (
                      <button onClick={() => onReject(pr.id)} style={actionBtn('#ef4444')}>
                        Reddet
                      </button>
                    ) : null}
                  </span>
                ) : (
                  <span style={{ color: 'var(--ink-muted, #888)' }}>—</span>
                )}
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
