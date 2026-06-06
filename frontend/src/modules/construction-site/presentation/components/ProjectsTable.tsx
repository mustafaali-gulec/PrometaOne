/**
 * ProjectsTable — projeler tablosu (tip + durum rozetli).
 *
 * onSetStatus verilirse mevcut duruma göre geçiş butonları, onDeactivate
 * verilirse pasifleştir butonu gösterilir.
 */
import type { ProjectDto, ProjectStatus } from '../../application/dto/ConstructionDtos';

export interface ProjectsTableProps {
  projects: ReadonlyArray<ProjectDto>;
  loading?: boolean;
  onSetStatus?: (id: number, status: ProjectStatus) => void;
  onDeactivate?: (id: number) => void;
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planlama',
  active: 'Aktif',
  suspended: 'Askıda',
  completed: 'Tamamlandı',
  closed: 'Kapandı',
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  planning: '#9ca3af',
  active: '#10b981',
  suspended: '#f59e0b',
  completed: '#0ea5e9',
  closed: '#6b7280',
};

const TYPE_LABELS: Record<ProjectDto['projectType'], string> = {
  private: 'Özel',
  public_tender: 'İhaleli (KİK)',
};

function nextActions(
  status: ProjectStatus,
): Array<{ label: string; to: ProjectStatus; bg: string }> {
  switch (status) {
    case 'planning':
      return [{ label: 'Başlat', to: 'active', bg: '#10b981' }];
    case 'active':
      return [
        { label: 'Tamamla', to: 'completed', bg: '#0ea5e9' },
        { label: 'Askıya Al', to: 'suspended', bg: '#f59e0b' },
      ];
    case 'suspended':
      return [{ label: 'Devam Et', to: 'active', bg: '#10b981' }];
    case 'completed':
      return [{ label: 'Kapat', to: 'closed', bg: '#6b7280' }];
    default:
      return [];
  }
}

export function ProjectsTable({
  projects,
  loading,
  onSetStatus,
  onDeactivate,
}: ProjectsTableProps): JSX.Element {
  if (loading === true) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Yükleniyor…
      </div>
    );
  }
  if (projects.length === 0) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Proje bulunamadı.
      </div>
    );
  }

  const showActions = onSetStatus !== undefined || onDeactivate !== undefined;

  return (
    <table
      data-testid="cs-projects-table"
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <thead>
        <tr style={{ background: 'var(--paper-2, #f5f5f5)', textAlign: 'left' }}>
          <th style={cell()}>Kod</th>
          <th style={cell()}>Proje Adı</th>
          <th style={cell()}>Tip</th>
          <th style={{ ...cell(), textAlign: 'right' }}>Bütçe</th>
          <th style={cell()}>Başlangıç</th>
          <th style={cell()}>Durum</th>
          {showActions ? <th style={cell()}>İşlem</th> : null}
        </tr>
      </thead>
      <tbody>
        {projects.map((p) => (
          <tr key={String(p.id)} style={{ borderBottom: '1px solid var(--line, #e5e5e5)' }}>
            <td style={cell()}>
              <strong>{p.code}</strong>
            </td>
            <td style={cell()}>{p.name}</td>
            <td style={cell()}>{TYPE_LABELS[p.projectType]}</td>
            <td style={{ ...cell(), textAlign: 'right' }}>
              {p.budgetAmount.toLocaleString('tr-TR')} {p.currency}
            </td>
            <td style={cell()}>{p.startDate ?? '—'}</td>
            <td style={cell()}>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: STATUS_COLORS[p.status],
                  color: '#fff',
                }}
              >
                {STATUS_LABELS[p.status]}
              </span>
            </td>
            {showActions ? (
              <td style={cell()}>
                <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                  {onSetStatus !== undefined
                    ? nextActions(p.status).map((a) => (
                        <button
                          key={a.to}
                          onClick={() => onSetStatus(p.id, a.to)}
                          style={actionBtn(a.bg)}
                        >
                          {a.label}
                        </button>
                      ))
                    : null}
                  {onDeactivate !== undefined && p.active ? (
                    <button onClick={() => onDeactivate(p.id)} style={actionBtn('#ef4444')}>
                      Pasifleştir
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
