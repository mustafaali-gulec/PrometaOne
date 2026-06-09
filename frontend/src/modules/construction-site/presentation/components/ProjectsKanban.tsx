/**
 * ProjectsKanban — projeleri DURUM panosunda gösterir (Satış CRM pipeline'ı stilinde).
 *
 * Kolonlar = proje durumları (planning → active → suspended → completed → closed).
 * Kart sürükle-bırak ile durum değişir → onSetStatus (api.changeProjectStatus).
 * Geçersiz geçişleri backend doğrular; hata Section üzerinden gösterilir.
 */
import { useState } from 'react';

import type { ProjectDto, ProjectStatus } from '../../application/dto/ConstructionDtos';

interface StatusColumn {
  key: ProjectStatus;
  label: string;
  color: string;
  bg: string;
}

const STATUS_COLUMNS: StatusColumn[] = [
  { key: 'planning', label: 'Planlama', color: '#6b7280', bg: '#f3f4f6' },
  { key: 'active', label: 'Aktif', color: '#10b981', bg: '#ecfdf5' },
  { key: 'suspended', label: 'Askıda', color: '#f59e0b', bg: '#fffbeb' },
  { key: 'completed', label: 'Tamamlandı', color: '#0ea5e9', bg: '#f0f9ff' },
  { key: 'closed', label: 'Kapandı', color: '#64748b', bg: '#f8fafc' },
];

const TYPE_LABELS: Record<ProjectDto['projectType'], string> = {
  private: 'Özel',
  public_tender: 'İhaleli (KİK)',
};

export interface ProjectsKanbanProps {
  projects: ReadonlyArray<ProjectDto>;
  onSetStatus: (id: number, status: ProjectStatus) => void;
}

export function ProjectsKanban({ projects, onSetStatus }: ProjectsKanbanProps): JSX.Element {
  const [dragId, setDragId] = useState<number | null>(null);

  const handleDrop = (status: ProjectStatus): void => {
    if (dragId !== null) {
      const p = projects.find((x) => x.id === dragId);
      if (p && p.status !== status) onSetStatus(dragId, status);
    }
    setDragId(null);
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${STATUS_COLUMNS.length}, minmax(190px, 1fr))`,
        gap: 8,
        overflowX: 'auto',
        minHeight: 440,
      }}
    >
      {STATUS_COLUMNS.map((col) => {
        const items = projects.filter((p) => p.status === col.key);
        const total = items.reduce((s, p) => s + (Number(p.budgetAmount) || 0), 0);
        return (
          <div
            key={col.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(col.key)}
            style={{
              background: col.bg,
              borderRadius: 'var(--radius-md, 8px)',
              padding: 8,
              minWidth: 190,
              border: `1px solid ${col.color}40`,
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
                borderBottom: `2px solid ${col.color}`,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: col.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {col.label}
              </span>
              <span
                style={{
                  background: '#fff',
                  color: col.color,
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
                color: col.color,
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
                  Buraya sürükle
                </div>
              ) : (
                items.map((p) => (
                  <div
                    key={String(p.id)}
                    draggable
                    onDragStart={() => setDragId(p.id)}
                    className="card"
                    style={{
                      padding: 9,
                      background: 'var(--paper, #fff)',
                      cursor: 'grab',
                      borderLeft: `3px solid ${col.color}`,
                    }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink, #1c1917)' }}>
                      {p.code}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft, #57534e)', marginTop: 2 }}>
                      {p.name}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 6,
                        gap: 6,
                      }}
                    >
                      <span
                        className="chip"
                        style={{ background: `${col.color}1a`, color: col.color }}
                      >
                        {TYPE_LABELS[p.projectType]}
                      </span>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: 'var(--ink, #1c1917)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {p.budgetAmount.toLocaleString('tr-TR')} {p.currency}
                      </span>
                    </div>
                    {p.startDate !== null ? (
                      <div
                        style={{ fontSize: 10, color: 'var(--ink-muted, #9ca3af)', marginTop: 4 }}
                      >
                        📅 {p.startDate}
                      </div>
                    ) : null}
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
