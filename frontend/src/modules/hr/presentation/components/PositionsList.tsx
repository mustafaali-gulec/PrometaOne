/**
 * PositionsList — basit pozisyon kartları listesi.
 */
import type { PositionDto, PositionStatus } from '../../application/dto/HrDtos';

export interface PositionsListProps {
  positions: ReadonlyArray<PositionDto>;
  loading?: boolean;
  onSelect?: (id: number) => void;
}

const STATUS_LABELS: Record<PositionStatus, string> = {
  draft: 'Taslak',
  open: 'Açık',
  closed: 'Kapalı',
};

const STATUS_COLORS: Record<PositionStatus, string> = {
  draft: '#9ca3af',
  open: '#10b981',
  closed: '#ef4444',
};

export function PositionsList({ positions, loading, onSelect }: PositionsListProps): JSX.Element {
  if (loading === true) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Yükleniyor…
      </div>
    );
  }
  if (positions.length === 0) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Pozisyon bulunamadı.
      </div>
    );
  }
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 12,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 13,
      }}
    >
      {positions.map((p) => (
        <div
          key={p.id}
          style={{
            border: '1px solid var(--line, #e5e5e5)',
            borderRadius: 8,
            padding: 12,
            background: 'var(--paper, #fff)',
            cursor: onSelect ? 'pointer' : 'default',
          }}
          {...(onSelect
            ? {
                role: 'button',
                tabIndex: 0,
                onClick: () => onSelect(p.id),
                onKeyDown: (ev: React.KeyboardEvent<HTMLDivElement>) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    onSelect(p.id);
                  }
                },
              }
            : {})}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <strong style={{ fontSize: 14 }}>{p.title}</strong>
            <span
              style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 999,
                background: STATUS_COLORS[p.status],
                color: '#fff',
              }}
            >
              {STATUS_LABELS[p.status]}
            </span>
          </div>
          {p.description !== null ? (
            <div style={{ marginTop: 6, color: 'var(--ink-muted, #666)', fontSize: 12 }}>
              {p.description}
            </div>
          ) : null}
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              gap: 12,
              fontSize: 11,
              color: 'var(--ink-muted, #666)',
            }}
          >
            <span>Kadro: {p.headcountTarget}</span>
            {p.minSalary !== null && p.maxSalary !== null ? (
              <span>
                Maaş: {fmt(p.minSalary)} – {fmt(p.maxSalary)}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function fmt(n: number): string {
  return new Intl.NumberFormat('tr-TR').format(n);
}
