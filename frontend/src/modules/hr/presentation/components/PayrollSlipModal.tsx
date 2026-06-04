/**
 * PayrollSlipModal — bir bordro koşusunun satırlarını (çalışan bazında
 * brüt/kesinti/net kırılımı) gösteren basit modal.
 */
import type { PayrollItemDto, PayrollRunDto } from '../../application/dto/HrDtos';

export interface PayrollSlipModalProps {
  run: PayrollRunDto | null;
  items: ReadonlyArray<PayrollItemDto>;
  loading?: boolean;
  onClose: () => void;
}

function fmt(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PayrollSlipModal({
  run,
  items,
  loading,
  onClose,
}: PayrollSlipModalProps): JSX.Element | null {
  if (run === null) return null;

  const totals = items.reduce(
    (acc, it) => ({
      gross: acc.gross + it.grossSalary,
      net: acc.net + it.netSalary,
    }),
    { gross: 0, net: 0 },
  );

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- overlay tiklamasiyla kapatma; klavye icin Esc ayri ele alinir
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- icerik tiklamasi overlay'e yayilmasin */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--paper, #fff)',
          borderRadius: 8,
          padding: 20,
          width: 'min(880px, 92vw)',
          maxHeight: '85vh',
          overflow: 'auto',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16 }}>
            Bordro Fişi — {run.periodMonth}/{run.periodYear}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 20,
              cursor: 'pointer',
              lineHeight: 1,
            }}
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        {loading === true ? (
          <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
            Yükleniyor…
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
            Bu koşuda satır yok. Önce &quot;Hesapla&quot; ile bordro üretin.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--paper-2, #f5f5f5)', textAlign: 'right' }}>
                <th style={{ ...cell(), textAlign: 'left' }}>Personel</th>
                <th style={cell()}>Brüt</th>
                <th style={cell()}>SGK</th>
                <th style={cell()}>İşsizlik</th>
                <th style={cell()}>Gelir V.</th>
                <th style={cell()}>Damga V.</th>
                <th style={cell()}>Diğer</th>
                <th style={cell()}>Net</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} style={{ borderBottom: '1px solid var(--line, #e5e5e5)' }}>
                  <td style={{ ...cell(), textAlign: 'left' }}>#{it.employeeId}</td>
                  <td style={cell()}>{fmt(it.grossSalary)}</td>
                  <td style={cell()}>{fmt(it.sgkEmployee)}</td>
                  <td style={cell()}>{fmt(it.unemployment)}</td>
                  <td style={cell()}>{fmt(it.incomeTax)}</td>
                  <td style={cell()}>{fmt(it.stampTax)}</td>
                  <td style={cell()}>{fmt(it.otherDeductions)}</td>
                  <td style={{ ...cell(), fontWeight: 600 }}>{fmt(it.netSalary)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, background: 'var(--paper-2, #f5f5f5)' }}>
                <td style={{ ...cell(), textAlign: 'left' }}>Toplam ({items.length})</td>
                <td style={cell()}>{fmt(totals.gross)}</td>
                <td style={cell()} colSpan={5} />
                <td style={cell()}>{fmt(totals.net)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

function cell(): React.CSSProperties {
  return {
    padding: '6px 10px',
    borderBottom: '1px solid var(--line, #e5e5e5)',
    textAlign: 'right',
  };
}
