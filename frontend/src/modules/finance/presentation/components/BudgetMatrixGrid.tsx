/**
 * BudgetMatrixGrid — 12 aylık bütçe matrisi (section × kategori × ay).
 *
 * Para değerleri backend'den decimal string olarak gelir; burada salt
 * görüntüleme yapılır. Her section için satırlar + aylık toplamlar + section
 * toplamı; en altta P&L net (gelir − gider) satırı.
 */
import type { BudgetMatrixDto, CategorySection } from '../../application/dto/FinanceDtos';

export interface BudgetMatrixGridProps {
  matrix: BudgetMatrixDto | null;
  loading?: boolean;
}

const MONTHS_TR = [
  'Oca',
  'Şub',
  'Mar',
  'Nis',
  'May',
  'Haz',
  'Tem',
  'Ağu',
  'Eyl',
  'Eki',
  'Kas',
  'Ara',
];

const SECTION_LABELS: Record<CategorySection, string> = {
  inflows: 'Nakit Girişleri',
  outflows: 'Nakit Çıkışları',
  nonPnlOutflows: 'Çıkışlar (K/Z Harici)',
  kasaCategories: 'Kasa Kategorileri',
};

export function BudgetMatrixGrid({ matrix, loading }: BudgetMatrixGridProps): JSX.Element {
  if (loading === true) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Yükleniyor…
      </div>
    );
  }
  if (matrix === null) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Bütçe verisi yok.
      </div>
    );
  }

  return (
    <table
      data-testid="budget-matrix"
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 12,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <thead>
        <tr style={{ background: 'var(--paper-2, #f5f5f5)', textAlign: 'right' }}>
          <th style={{ ...cell(), textAlign: 'left' }}>
            Kategori ({matrix.currency} · {matrix.fiscalYear})
          </th>
          {MONTHS_TR.map((m) => (
            <th key={m} style={cell()}>
              {m}
            </th>
          ))}
          <th style={cell()}>Toplam</th>
        </tr>
      </thead>
      <tbody>
        {matrix.sections.map((s) => (
          <SectionRows
            key={s.section}
            section={s.section}
            rows={s.rows}
            monthlyTotals={s.monthlyTotals}
            sectionTotal={s.sectionTotal}
          />
        ))}
        <tr style={{ background: 'var(--paper-2, #eef)', fontWeight: 700 }}>
          <td style={{ ...cell(), textAlign: 'left' }}>P&amp;L Net</td>
          {matrix.pnlNetMonthly.map((v, i) => (
            <td key={i} style={cell()}>
              {v}
            </td>
          ))}
          <td style={cell()} data-testid="pnl-net-total">
            {matrix.pnlNetTotal}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function SectionRows({
  section,
  rows,
  monthlyTotals,
  sectionTotal,
}: {
  section: CategorySection;
  rows: BudgetMatrixDto['sections'][number]['rows'];
  monthlyTotals: string[];
  sectionTotal: string;
}): JSX.Element {
  return (
    <>
      <tr style={{ background: 'var(--paper-3, #fafafa)' }}>
        <td colSpan={14} style={{ ...cell(), textAlign: 'left', fontWeight: 600 }}>
          {SECTION_LABELS[section]}
        </td>
      </tr>
      {rows.length === 0 ? (
        <tr>
          <td
            colSpan={14}
            style={{
              ...cell(),
              textAlign: 'left',
              fontStyle: 'italic',
              color: 'var(--ink-muted, #999)',
            }}
          >
            (kategori yok)
          </td>
        </tr>
      ) : (
        rows.map((r) => (
          <tr
            key={r.categoryId}
            style={{ borderBottom: '1px solid var(--line, #eee)', textAlign: 'right' }}
          >
            <td style={{ ...cell(), textAlign: 'left' }}>{r.name}</td>
            {r.months.map((m, i) => (
              <td key={i} style={cell()}>
                {m}
              </td>
            ))}
            <td style={{ ...cell(), fontWeight: 600 }}>{r.rowTotal}</td>
          </tr>
        ))
      )}
      <tr
        style={{
          borderBottom: '2px solid var(--line, #ddd)',
          textAlign: 'right',
          fontStyle: 'italic',
        }}
      >
        <td style={{ ...cell(), textAlign: 'left' }}>Ara Toplam</td>
        {monthlyTotals.map((m, i) => (
          <td key={i} style={cell()}>
            {m}
          </td>
        ))}
        <td style={{ ...cell(), fontWeight: 700 }}>{sectionTotal}</td>
      </tr>
    </>
  );
}

function cell(): React.CSSProperties {
  return { padding: '4px 8px', borderBottom: '1px solid var(--line, #eee)' };
}
