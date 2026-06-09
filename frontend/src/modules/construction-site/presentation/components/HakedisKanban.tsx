/**
 * HakedisKanban — bir sözleşmenin hakedişlerini DURUM panosunda gösterir
 * (Satış CRM pipeline stilinde). Kolonlar tüm durumları kapsar; kart sürükle-bırak
 * yalnızca GEÇERLİ geçişlerde durumu değiştirir (changeProgressStatus), geçersiz
 * hedef kabul etmez (geri yaylanır). Karta tıklayınca detay açılır.
 *
 * Geçerli geçişler (HakedisManager iş akışıyla aynı):
 *   draft → submitted ; submitted → approved|rejected ; approved → paid ; rejected → submitted
 */
import { useState } from 'react';

import type { ProgressStatus, ProgressSummaryDto } from '../../application/dto/ConstructionDtos';

const STATUS_LABELS: Record<ProgressStatus, string> = {
  draft: 'Taslak',
  submitted: 'Gönderildi',
  approved: 'Onaylandı',
  paid: 'Ödendi',
  rejected: 'Reddedildi',
  cancelled: 'İptal',
};
const STATUS_COLORS: Record<ProgressStatus, string> = {
  draft: '#9ca3af',
  submitted: '#f59e0b',
  approved: '#10b981',
  paid: '#0ea5e9',
  rejected: '#ef4444',
  cancelled: '#6b7280',
};
// Pano kolon sırası: ana akış önce, yan durumlar sonra.
const COLUMN_ORDER: ProgressStatus[] = [
  'draft',
  'submitted',
  'approved',
  'paid',
  'rejected',
  'cancelled',
];
const VALID_TRANSITIONS: Record<ProgressStatus, ProgressStatus[]> = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: ['paid'],
  rejected: ['submitted'],
  paid: [],
  cancelled: [],
};

export interface HakedisKanbanProps {
  list: ReadonlyArray<ProgressSummaryDto>;
  selectedId?: number | null;
  onOpen: (id: number) => void;
  onSetStatus: (id: number, status: ProgressStatus) => void;
}

export function HakedisKanban({
  list,
  selectedId,
  onOpen,
  onSetStatus,
}: HakedisKanbanProps): JSX.Element {
  const [drag, setDrag] = useState<{ id: number; from: ProgressStatus } | null>(null);
  const [overCol, setOverCol] = useState<ProgressStatus | null>(null);

  const handleDrop = (to: ProgressStatus): void => {
    if (drag !== null && drag.from !== to && VALID_TRANSITIONS[drag.from].includes(to)) {
      onSetStatus(drag.id, to);
    }
    setDrag(null);
    setOverCol(null);
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLUMN_ORDER.length}, minmax(180px, 1fr))`,
        gap: 8,
        overflowX: 'auto',
        minHeight: 440,
      }}
    >
      {COLUMN_ORDER.map((st) => {
        const color = STATUS_COLORS[st];
        const items = list.filter((p) => p.status === st);
        const total = items.reduce((s, p) => s + (Number(p.netPayable) || 0), 0);
        const canDrop = drag !== null && VALID_TRANSITIONS[drag.from].includes(st);
        const isOver = overCol === st && canDrop;
        return (
          <div
            key={st}
            onDragOver={(e) => {
              if (canDrop) {
                e.preventDefault();
                setOverCol(st);
              }
            }}
            onDragLeave={() => setOverCol((c) => (c === st ? null : c))}
            onDrop={() => handleDrop(st)}
            style={{
              background: `${color}14`,
              borderRadius: 'var(--radius-md, 8px)',
              padding: 8,
              minWidth: 180,
              border: isOver ? `2px dashed ${color}` : `1px solid ${color}40`,
              opacity: drag !== null && !canDrop ? 0.55 : 1,
              transition: 'opacity 0.12s',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Sütun başlığı */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 6,
                borderBottom: `2px solid ${color}`,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {STATUS_LABELS[st]}
              </span>
              <span
                style={{
                  background: '#fff',
                  color,
                  padding: '1px 7px',
                  borderRadius: 999,
                  fontSize: 10.5,
                  fontWeight: 700,
                }}
              >
                {items.length}
              </span>
            </div>
            <div
              style={{
                fontSize: 10,
                color,
                opacity: 0.85,
                margin: '4px 0 8px',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {total > 0 ? `${total.toLocaleString('tr-TR')} ${items[0]?.currency ?? ''}` : '—'}
            </div>

            {/* Kartlar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {items.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 16,
                    color: 'var(--ink-muted, #9ca3af)',
                    fontSize: 10.5,
                    fontStyle: 'italic',
                  }}
                >
                  {isOver ? 'Buraya bırak' : '—'}
                </div>
              ) : (
                items.map((p) => (
                  <div
                    key={String(p.id)}
                    role="button"
                    tabIndex={0}
                    draggable
                    onDragStart={() => setDrag({ id: p.id, from: p.status })}
                    onDragEnd={() => {
                      setDrag(null);
                      setOverCol(null);
                    }}
                    onClick={() => onOpen(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpen(p.id);
                      }
                    }}
                    className="card"
                    style={{
                      padding: 9,
                      background: 'var(--paper, #fff)',
                      cursor: 'grab',
                      borderLeft: `3px solid ${color}`,
                      outline: selectedId === p.id ? `2px solid ${color}` : 'none',
                    }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink, #1c1917)' }}>
                      {p.hakedisNo}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft, #57534e)', marginTop: 2 }}>
                      {p.kind === 'employer' ? 'İşveren' : 'Taşeron'} · #{p.seqNo}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: 'var(--ink, #1c1917)',
                        marginTop: 4,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      Net: {p.netPayable.toLocaleString('tr-TR')} {p.currency}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
