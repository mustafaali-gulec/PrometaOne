/**
 * CashPositionCard — bir banka/kasa hesabının açılış + güncel bakiyesini
 * gösteren kart.
 */
import type { CashPositionDto } from '../../application/dto/FinanceDtos';

export interface CashPositionCardProps {
  position: CashPositionDto | null;
  loading?: boolean;
}

export function CashPositionCard({ position, loading }: CashPositionCardProps): JSX.Element {
  if (loading === true) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Yükleniyor…
      </div>
    );
  }
  if (position === null) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Hesap seçilmedi.
      </div>
    );
  }

  const typeLabel = position.endpointType === 'bank' ? 'Banka' : 'Kasa';

  return (
    <div
      data-testid="cash-position-card"
      style={{
        border: '1px solid var(--line, #e5e5e5)',
        borderRadius: 8,
        padding: 16,
        maxWidth: 320,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 15 }}>{position.name}</strong>
        <span
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 999,
            background: position.endpointType === 'bank' ? '#6366f1' : '#10b981',
            color: '#fff',
          }}
        >
          {typeLabel}
        </span>
      </div>
      <div
        style={{
          marginTop: 12,
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          rowGap: 6,
          fontSize: 13,
        }}
      >
        <span style={{ color: 'var(--ink-muted, #888)' }}>Açılış</span>
        <span style={{ textAlign: 'right' }}>
          {position.openingBalance} {position.currency}
        </span>
        <span style={{ color: 'var(--ink-muted, #888)' }}>Güncel Bakiye</span>
        <span style={{ textAlign: 'right', fontWeight: 700 }} data-testid="current-balance">
          {position.currentBalance} {position.currency}
        </span>
      </div>
    </div>
  );
}
