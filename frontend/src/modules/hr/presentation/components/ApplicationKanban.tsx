/**
 * ApplicationKanban — pozisyon bazlı başvuru kanban'ı.
 *
 * 4 kolon (new/screening/interview/offer) + drag-drop ile stage geçişi.
 * Native HTML5 drag API kullanır (ek lib yok).
 *
 * Stage geçişi backend transition policy'sini tetikler — yasak geçiş
 * (örn. new → offer atlama) backend tarafından 400 ile reddedilir;
 * onError ile yukarı iletilir.
 */
import { useState } from 'react';

import type { ApplicationDto, RecruitmentStage } from '../../application/dto/HrDtos';

export interface ApplicationKanbanProps {
  applications: ReadonlyArray<ApplicationDto>;
  loading?: boolean;
  /** Drag-drop sonucu — başarılıysa kanban refresh edilmeli. */
  onMoveStage: (applicationId: number, newStage: RecruitmentStage) => Promise<void>;
}

const COLUMNS: { stage: RecruitmentStage; label: string; color: string }[] = [
  { stage: 'new', label: 'Yeni', color: '#6366f1' },
  { stage: 'screening', label: 'Tarama', color: '#0ea5e9' },
  { stage: 'interview', label: 'Mülakat', color: '#f59e0b' },
  { stage: 'offer', label: 'Teklif', color: '#8b5cf6' },
];

export function ApplicationKanban({
  applications,
  loading,
  onMoveStage,
}: ApplicationKanbanProps): JSX.Element {
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [hoverStage, setHoverStage] = useState<RecruitmentStage | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  // Sadece aktif (non-terminal) başvuruları kolonlara dağıt
  const byStage = new Map<RecruitmentStage, ApplicationDto[]>();
  for (const col of COLUMNS) {
    byStage.set(col.stage, []);
  }
  for (const a of applications) {
    const bucket = byStage.get(a.stage);
    if (bucket) bucket.push(a);
  }

  const handleDrop = async (newStage: RecruitmentStage): Promise<void> => {
    if (draggedId === null) return;
    setHoverStage(null);
    const id = draggedId;
    setDraggedId(null);
    setMoveError(null);
    try {
      await onMoveStage(id, newStage);
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : String(err));
    }
  };

  if (loading === true && applications.length === 0) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Yükleniyor…
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {moveError !== null ? (
        <div
          style={{
            padding: 8,
            background: 'var(--danger-bg, #fef2f2)',
            color: 'var(--danger, #b91c1c)',
            border: '1px solid var(--danger, #fca5a5)',
            borderRadius: 6,
            marginBottom: 12,
            fontSize: 12,
          }}
        >
          Geçiş hatası: {moveError}
        </div>
      ) : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLUMNS.length}, 1fr)`,
          gap: 8,
        }}
      >
        {COLUMNS.map((col) => {
          const items = byStage.get(col.stage) ?? [];
          const isHover = hoverStage === col.stage;
          return (
            <div
              key={col.stage}
              onDragOver={(ev) => {
                ev.preventDefault();
                ev.dataTransfer.dropEffect = 'move';
                setHoverStage(col.stage);
              }}
              onDragLeave={() => {
                if (hoverStage === col.stage) setHoverStage(null);
              }}
              onDrop={(ev) => {
                ev.preventDefault();
                void handleDrop(col.stage);
              }}
              style={{
                background: isHover ? 'var(--paper-2, #f0f9ff)' : 'var(--paper-2, #f9fafb)',
                border: `2px ${isHover ? 'dashed' : 'solid'} ${
                  isHover ? col.color : 'var(--line, #e5e7eb)'
                }`,
                borderRadius: 8,
                padding: 8,
                minHeight: 200,
                transition: 'background 0.1s, border 0.1s',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                  padding: '0 4px',
                }}
              >
                <strong style={{ fontSize: 13, color: col.color }}>{col.label}</strong>
                <span
                  style={{
                    background: col.color,
                    color: '#fff',
                    fontSize: 11,
                    padding: '1px 8px',
                    borderRadius: 999,
                  }}
                >
                  {items.length}
                </span>
              </div>
              {items.length === 0 ? (
                <div
                  style={{
                    color: 'var(--ink-muted, #9ca3af)',
                    fontSize: 11,
                    fontStyle: 'italic',
                    padding: 8,
                  }}
                >
                  Boş
                </div>
              ) : (
                items.map((a) => (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={(ev) => {
                      setDraggedId(a.id);
                      ev.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setHoverStage(null);
                    }}
                    style={{
                      background: 'var(--paper, #fff)',
                      border: '1px solid var(--line, #e5e7eb)',
                      borderLeft: `3px solid ${col.color}`,
                      borderRadius: 6,
                      padding: '8px 10px',
                      marginBottom: 6,
                      fontSize: 12,
                      cursor: 'grab',
                      opacity: draggedId === a.id ? 0.5 : 1,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>Başvuru #{a.id}</div>
                    <div style={{ color: 'var(--ink-muted, #6b7280)', marginTop: 2 }}>
                      Aday: {a.candidateId} · Poz: {a.positionId}
                    </div>
                    {a.salaryExpectation !== null ? (
                      <div style={{ color: 'var(--ink-muted, #6b7280)', marginTop: 2 }}>
                        Beklenti: {new Intl.NumberFormat('tr-TR').format(a.salaryExpectation)}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
