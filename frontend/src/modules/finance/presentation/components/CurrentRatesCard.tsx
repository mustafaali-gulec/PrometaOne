/**
 * CurrentRatesCard — güncel USD/EUR TCMB kuru kartı.
 */
import type { CurrentRatesDto } from '../../application/dto/EInvoiceDtos';

export interface CurrentRatesCardProps {
  rates: CurrentRatesDto | null;
  loading?: boolean;
}

export function CurrentRatesCard({ rates, loading }: CurrentRatesCardProps): JSX.Element {
  if (loading === true) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Yükleniyor…
      </div>
    );
  }
  if (rates === null || (rates.USD === null && rates.EUR === null)) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Kur verisi yok.
      </div>
    );
  }
  return (
    <div
      data-testid="current-rates-card"
      style={{
        border: '1px solid var(--line, #e5e5e5)',
        borderRadius: 8,
        padding: 16,
        maxWidth: 280,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <strong style={{ fontSize: 15 }}>TCMB Kurları</strong>
        <span style={{ fontSize: 12, color: 'var(--ink-muted, #888)' }}>{rates.date ?? '—'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 6, fontSize: 14 }}>
        <span>USD/TRY</span>
        <span style={{ textAlign: 'right', fontWeight: 600 }} data-testid="rate-usd">
          {rates.USD !== null ? rates.USD.toFixed(4) : '—'}
        </span>
        <span>EUR/TRY</span>
        <span style={{ textAlign: 'right', fontWeight: 600 }} data-testid="rate-eur">
          {rates.EUR !== null ? rates.EUR.toFixed(4) : '—'}
        </span>
      </div>
    </div>
  );
}
