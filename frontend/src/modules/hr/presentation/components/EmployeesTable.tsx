/**
 * EmployeesTable — basit çalışan listesi tablosu.
 *
 * Filtreleme parent state'inden gelir. Action button'lar opsiyonel.
 */
import type {
  EmployeeDto,
  EmployeeStatus,
} from '../../application/dto/HrDtos';

export interface EmployeesTableProps {
  employees: ReadonlyArray<EmployeeDto>;
  loading?: boolean;
  onSelect?: (id: number) => void;
}

const STATUS_LABELS: Record<EmployeeStatus, string> = {
  probation: 'Deneme',
  active: 'Aktif',
  on_leave: 'İzinli',
  terminated: 'Ayrıldı',
};

const STATUS_COLORS: Record<EmployeeStatus, string> = {
  probation: '#f59e0b',
  active: '#10b981',
  on_leave: '#6366f1',
  terminated: '#9ca3af',
};

export function EmployeesTable({ employees, loading, onSelect }: EmployeesTableProps): JSX.Element {
  if (loading === true) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Yükleniyor…
      </div>
    );
  }
  if (employees.length === 0) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Çalışan bulunamadı.
      </div>
    );
  }
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
          <th style={cellStyle()}>No</th>
          <th style={cellStyle()}>Ad Soyad</th>
          <th style={cellStyle()}>E-posta</th>
          <th style={cellStyle()}>Telefon</th>
          <th style={cellStyle()}>İşe Başlama</th>
          <th style={cellStyle()}>Durum</th>
        </tr>
      </thead>
      <tbody>
        {employees.map((e) => (
          <tr
            key={e.id}
            style={{
              borderBottom: '1px solid var(--line, #e5e5e5)',
              cursor: onSelect ? 'pointer' : 'default',
            }}
            onClick={onSelect ? () => onSelect(e.id) : undefined}
          >
            <td style={cellStyle()}>
              <code style={{ fontSize: 12 }}>{e.employeeNo}</code>
            </td>
            <td style={cellStyle()}>
              <strong>{e.fullName}</strong>
            </td>
            <td style={cellStyle()}>{e.email ?? '—'}</td>
            <td style={cellStyle()}>{e.phone ?? '—'}</td>
            <td style={cellStyle()}>{e.hireDate}</td>
            <td style={cellStyle()}>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: STATUS_COLORS[e.status],
                  color: '#fff',
                }}
              >
                {STATUS_LABELS[e.status]}
              </span>
            </td>
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
