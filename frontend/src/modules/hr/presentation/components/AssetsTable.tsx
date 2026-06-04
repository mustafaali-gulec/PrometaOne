/**
 * AssetsTable — varlık (zimmet) havuzu listesi tablosu.
 *
 * Zimmetle (assign) ve İade al (return) yetkisi backend'de hr_manager
 * rolünde; UI'da action butonları varlığın durumuna göre gösterilir:
 *   - in_stock  → Zimmetle
 *   - assigned  → İade al
 * Detay (atama geçmişi) tüm varlıklar için açık.
 */
import type { AssetDto, AssetStatus, AssetType } from '../../application/dto/HrDtos';

export interface AssetsTableProps {
  assets: ReadonlyArray<AssetDto>;
  loading?: boolean;
  onAssign?: (id: number) => void;
  onReturn?: (id: number) => void;
  onView?: (id: number) => void;
}

const TYPE_LABELS: Record<AssetType, string> = {
  laptop: 'Dizüstü',
  desktop: 'Masaüstü',
  phone: 'Telefon',
  vehicle: 'Araç',
  card: 'Kart',
  monitor: 'Monitör',
  headset: 'Kulaklık',
  tablet: 'Tablet',
  printer: 'Yazıcı',
  furniture: 'Mobilya',
  key_lock: 'Anahtar/Kilit',
  uniform: 'Üniforma',
  ppe: 'KKD',
  other: 'Diğer',
};

const STATUS_LABELS: Record<AssetStatus, string> = {
  in_stock: 'Stokta',
  assigned: 'Zimmetli',
  maintenance: 'Bakımda',
  retired: 'Hurda',
  lost: 'Kayıp',
};

const STATUS_COLORS: Record<AssetStatus, string> = {
  in_stock: '#10b981',
  assigned: '#3b82f6',
  maintenance: '#f59e0b',
  retired: '#6b7280',
  lost: '#ef4444',
};

export function AssetsTable({
  assets,
  loading,
  onAssign,
  onReturn,
  onView,
}: AssetsTableProps): JSX.Element {
  if (loading === true) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Yükleniyor…
      </div>
    );
  }
  if (assets.length === 0) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Varlık bulunamadı.
      </div>
    );
  }
  const showActions = onAssign !== undefined || onReturn !== undefined || onView !== undefined;
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
          <th style={cellStyle()}>Ad</th>
          <th style={cellStyle()}>Tür</th>
          <th style={cellStyle()}>Marka / Model</th>
          <th style={cellStyle()}>Seri No</th>
          <th style={cellStyle()}>Durum</th>
          <th style={cellStyle()}>Zimmetli</th>
          {showActions ? <th style={cellStyle()}>İşlem</th> : null}
        </tr>
      </thead>
      <tbody>
        {assets.map((asset) => (
          <tr key={asset.id} style={{ borderBottom: '1px solid var(--line, #e5e5e5)' }}>
            <td style={cellStyle()}>{asset.name}</td>
            <td style={cellStyle()}>{TYPE_LABELS[asset.assetType] ?? asset.assetType}</td>
            <td style={cellStyle()}>
              {[asset.brand, asset.model].filter((x) => x !== null && x !== '').join(' / ') || '—'}
            </td>
            <td style={cellStyle()}>{asset.serialNo ?? '—'}</td>
            <td style={cellStyle()}>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: STATUS_COLORS[asset.status],
                  color: '#fff',
                }}
              >
                {STATUS_LABELS[asset.status]}
              </span>
            </td>
            <td style={cellStyle()}>
              {asset.assignedEmployeeId !== null ? `#${asset.assignedEmployeeId}` : '—'}
            </td>
            {showActions ? (
              <td style={cellStyle()}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {onView !== undefined ? (
                    <button
                      type="button"
                      onClick={() => onView(asset.id)}
                      style={actionStyle('#3b82f6')}
                    >
                      Detay
                    </button>
                  ) : null}
                  {asset.status === 'in_stock' && onAssign !== undefined ? (
                    <button
                      type="button"
                      onClick={() => onAssign(asset.id)}
                      style={actionStyle('#6366f1')}
                    >
                      Zimmetle
                    </button>
                  ) : null}
                  {asset.status === 'assigned' && onReturn !== undefined ? (
                    <button
                      type="button"
                      onClick={() => onReturn(asset.id)}
                      style={actionStyle('#10b981')}
                    >
                      İade al
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
