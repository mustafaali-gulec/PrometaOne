/**
 * PozCatalogTable — birim fiyat (poz) katalog tablosu.
 */
import type { PozDto } from '../../application/dto/ConstructionDtos';

export interface PozCatalogTableProps {
  poz: ReadonlyArray<PozDto>;
  loading?: boolean;
  onDeactivate?: (id: number) => void;
}

export function PozCatalogTable({ poz, loading, onDeactivate }: PozCatalogTableProps): JSX.Element {
  if (loading === true) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Yükleniyor…
      </div>
    );
  }
  if (poz.length === 0) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Poz bulunamadı.
      </div>
    );
  }

  return (
    <table data-testid="cs-poz-table" className="grid actions-last">
      <thead>
        <tr>
          <th style={cell()}>Poz No</th>
          <th style={cell()}>Tanım</th>
          <th style={cell()}>Birim</th>
          <th style={{ ...cell(), textAlign: 'right' }}>Birim Fiyat</th>
          <th style={cell()}>Kaynak</th>
          <th style={cell()}>Yıl</th>
          {onDeactivate !== undefined ? <th style={cell()}>İşlem</th> : null}
        </tr>
      </thead>
      <tbody>
        {poz.map((p) => (
          <tr key={String(p.id)}>
            <td style={cell()}>
              <strong>{p.pozNo}</strong>
            </td>
            <td style={cell()}>{p.name}</td>
            <td style={cell()}>{p.unit}</td>
            <td style={{ ...cell(), textAlign: 'right' }}>{p.unitPrice.toLocaleString('tr-TR')}</td>
            <td style={cell()}>{p.source ?? '—'}</td>
            <td style={cell()}>{p.year ?? '—'}</td>
            {onDeactivate !== undefined ? (
              <td style={cell()}>
                {p.active ? (
                  <button onClick={() => onDeactivate(p.id)} style={actionBtn('#ef4444')}>
                    Pasifleştir
                  </button>
                ) : (
                  <span style={{ color: 'var(--ink-muted, #888)' }}>pasif</span>
                )}
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function cell(): React.CSSProperties {
  return {};
}

function actionBtn(bg: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    border: `1px solid ${bg}`,
    borderRadius: 'var(--radius, 6px)',
    background: bg,
    color: '#fff',
    fontSize: 11.5,
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
  };
}
