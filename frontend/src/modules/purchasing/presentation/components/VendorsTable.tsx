/**
 * VendorsTable — tedarikçi listesi tablosu (durum rozetli).
 *
 * onSelect verilirse satır tıklanabilir olur.
 */
import type { CariClass, PersonType, VendorDto } from '../../application/dto/PurchasingDtos';

export interface VendorsTableProps {
  vendors: ReadonlyArray<VendorDto>;
  loading?: boolean;
  onSelect?: (id: number) => void;
}

const PERSON_LABELS: Record<PersonType, string> = {
  real: 'Gerçek',
  legal: 'Tüzel',
};

const CARI_LABELS: Record<CariClass, string> = {
  satici: 'Satıcı',
  alici: 'Alıcı',
};

export function VendorsTable({ vendors, loading, onSelect }: VendorsTableProps): JSX.Element {
  if (loading === true) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Yükleniyor…
      </div>
    );
  }
  if (vendors.length === 0) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Tedarikçi bulunamadı.
      </div>
    );
  }

  return (
    <table
      data-testid="vendors-table"
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
          <th style={cell()}>Ad</th>
          <th style={cell()}>Vergi No</th>
          <th style={cell()}>Tip</th>
          <th style={cell()}>Cari</th>
          <th style={cell()}>Durum</th>
        </tr>
      </thead>
      <tbody>
        {vendors.map((v) => (
          <tr
            key={String(v.id)}
            style={{
              borderBottom: '1px solid var(--line, #e5e5e5)',
              cursor: onSelect ? 'pointer' : 'default',
            }}
            onClick={onSelect ? () => onSelect(v.id) : undefined}
          >
            <td style={cell()}>{v.code}</td>
            <td style={cell()}>
              <strong>{v.name}</strong>
            </td>
            <td style={cell()}>{v.taxId ?? '—'}</td>
            <td style={cell()}>{PERSON_LABELS[v.personType]}</td>
            <td style={cell()}>{CARI_LABELS[v.cariClass]}</td>
            <td style={cell()}>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: v.active ? '#10b981' : '#9ca3af',
                  color: '#fff',
                }}
              >
                {v.active ? 'Aktif' : 'Pasif'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function cell(): React.CSSProperties {
  return { padding: '8px 12px', borderBottom: '1px solid var(--line, #e5e5e5)' };
}
