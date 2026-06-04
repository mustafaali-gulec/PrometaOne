/**
 * LeaveRequestsTable — izin talepleri listesi tablosu.
 *
 * Onay/red yetkisi backend'de hr_manager rolünde; UI'da action butonları
 * yalnızca pending kayıtlar için gösterilir. İptal pending/approved için açık.
 */
import type { LeaveRequestDto, LeaveStatus, LeaveType } from '../../application/dto/HrDtos';

export interface LeaveRequestsTableProps {
  leaveRequests: ReadonlyArray<LeaveRequestDto>;
  loading?: boolean;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  onCancel?: (id: number) => void;
}

const TYPE_LABELS: Record<LeaveType, string> = {
  annual: 'Yıllık',
  sick: 'Hastalık',
  unpaid: 'Ücretsiz',
  maternity: 'Doğum',
  other: 'Diğer',
};

const STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'Beklemede',
  approved: 'Onaylı',
  rejected: 'Reddedildi',
  cancelled: 'İptal',
};

const STATUS_COLORS: Record<LeaveStatus, string> = {
  pending: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  cancelled: '#9ca3af',
};

export function LeaveRequestsTable({
  leaveRequests,
  loading,
  onApprove,
  onReject,
  onCancel,
}: LeaveRequestsTableProps): JSX.Element {
  if (loading === true) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Yükleniyor…
      </div>
    );
  }
  if (leaveRequests.length === 0) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        İzin talebi bulunamadı.
      </div>
    );
  }
  const showActions = onApprove !== undefined || onReject !== undefined || onCancel !== undefined;
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
          <th style={cellStyle()}>Personel</th>
          <th style={cellStyle()}>Tür</th>
          <th style={cellStyle()}>Başlangıç</th>
          <th style={cellStyle()}>Bitiş</th>
          <th style={cellStyle()}>Gün</th>
          <th style={cellStyle()}>Durum</th>
          {showActions ? <th style={cellStyle()}>İşlem</th> : null}
        </tr>
      </thead>
      <tbody>
        {leaveRequests.map((lr) => (
          <tr key={lr.id} style={{ borderBottom: '1px solid var(--line, #e5e5e5)' }}>
            <td style={cellStyle()}>#{lr.employeeId}</td>
            <td style={cellStyle()}>{TYPE_LABELS[lr.leaveType]}</td>
            <td style={cellStyle()}>{lr.startDate}</td>
            <td style={cellStyle()}>{lr.endDate}</td>
            <td style={cellStyle()}>{lr.days}</td>
            <td style={cellStyle()}>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: STATUS_COLORS[lr.status],
                  color: '#fff',
                }}
              >
                {STATUS_LABELS[lr.status]}
              </span>
            </td>
            {showActions ? (
              <td style={cellStyle()}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {lr.status === 'pending' && onApprove !== undefined ? (
                    <button
                      type="button"
                      onClick={() => onApprove(lr.id)}
                      style={actionStyle('#10b981')}
                    >
                      Onayla
                    </button>
                  ) : null}
                  {lr.status === 'pending' && onReject !== undefined ? (
                    <button
                      type="button"
                      onClick={() => onReject(lr.id)}
                      style={actionStyle('#ef4444')}
                    >
                      Reddet
                    </button>
                  ) : null}
                  {(lr.status === 'pending' || lr.status === 'approved') &&
                  onCancel !== undefined ? (
                    <button
                      type="button"
                      onClick={() => onCancel(lr.id)}
                      style={actionStyle('#6b7280')}
                    >
                      İptal
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
