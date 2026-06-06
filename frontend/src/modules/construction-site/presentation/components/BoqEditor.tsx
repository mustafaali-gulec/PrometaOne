/**
 * BoqEditor — keşif (BoQ) düzenleme ızgarası. Satır ekleme/silme, poz katalogdan
 * doldurma, satır tutarı ve pursantaj (% ağırlık) canlı önizleme. Kaydetme
 * backend'e PUT eder; backend pursantajı yeniden hesaplar (otorite sunucuda).
 */
import type { PozDto } from '../../application/dto/ConstructionDtos';

export interface BoqEditRow {
  pozId: number | null;
  pozNo: string | null;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
}

export interface BoqEditorProps {
  rows: BoqEditRow[];
  pozOptions: ReadonlyArray<PozDto>;
  onChange: (rows: BoqEditRow[]) => void;
  onSave: () => void;
  saving?: boolean;
}

export function emptyRow(): BoqEditRow {
  return { pozId: null, pozNo: null, description: '', unit: 'ad', quantity: '1', unitPrice: '0' };
}

function lineAmount(r: BoqEditRow): number {
  const q = Number(r.quantity);
  const p = Number(r.unitPrice);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0;
  return Math.round((q * p + Number.EPSILON) * 100) / 100;
}

export function BoqEditor({
  rows,
  pozOptions,
  onChange,
  onSave,
  saving,
}: BoqEditorProps): JSX.Element {
  const amounts = rows.map(lineAmount);
  const total = amounts.reduce((s, a) => s + a, 0);

  const setRow = (idx: number, patch: Partial<BoqEditRow>): void => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const addRow = (): void => onChange([...rows, emptyRow()]);
  const removeRow = (idx: number): void => onChange(rows.filter((_, i) => i !== idx));
  const pickPoz = (idx: number, pozId: number): void => {
    const p = pozOptions.find((x) => x.id === pozId);
    if (p === undefined) {
      setRow(idx, { pozId: null, pozNo: null });
      return;
    }
    setRow(idx, {
      pozId: p.id,
      pozNo: p.pozNo,
      description: rows[idx]!.description.trim() === '' ? p.name : rows[idx]!.description,
      unit: p.unit,
      unitPrice: String(p.unitPrice),
    });
  };

  return (
    <div>
      <table
        data-testid="cs-boq-editor"
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}
      >
        <thead>
          <tr style={{ background: 'var(--paper-2, #f5f5f5)', textAlign: 'left' }}>
            <th style={cell()}>#</th>
            <th style={cell()}>Poz</th>
            <th style={cell()}>Açıklama</th>
            <th style={cell()}>Birim</th>
            <th style={{ ...cell(), textAlign: 'right' }}>Miktar</th>
            <th style={{ ...cell(), textAlign: 'right' }}>Birim Fiyat</th>
            <th style={{ ...cell(), textAlign: 'right' }}>Tutar</th>
            <th style={{ ...cell(), textAlign: 'right' }}>Pursantaj %</th>
            <th style={cell()} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const amt = amounts[idx]!;
            const pct = total > 0 ? (amt / total) * 100 : 0;
            return (
              <tr key={idx} style={{ borderBottom: '1px solid var(--line, #eee)' }}>
                <td style={cell()}>{idx + 1}</td>
                <td style={cell()}>
                  <select
                    value={r.pozId ?? 0}
                    onChange={(ev) => pickPoz(idx, Number(ev.target.value))}
                    style={{ ...inp(), width: 130 }}
                  >
                    <option value={0}>— (serbest) —</option>
                    {pozOptions.map((p) => (
                      <option key={String(p.id)} value={p.id}>
                        {p.pozNo}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={cell()}>
                  <input
                    value={r.description}
                    onChange={(ev) => setRow(idx, { description: ev.target.value })}
                    placeholder="İş kalemi açıklaması"
                    style={{ ...inp(), width: '100%', minWidth: 160 }}
                  />
                </td>
                <td style={cell()}>
                  <input
                    value={r.unit}
                    onChange={(ev) => setRow(idx, { unit: ev.target.value })}
                    style={{ ...inp(), width: 60 }}
                  />
                </td>
                <td style={{ ...cell(), textAlign: 'right' }}>
                  <input
                    type="number"
                    value={r.quantity}
                    onChange={(ev) => setRow(idx, { quantity: ev.target.value })}
                    style={{ ...inp(), width: 90, textAlign: 'right' }}
                  />
                </td>
                <td style={{ ...cell(), textAlign: 'right' }}>
                  <input
                    type="number"
                    value={r.unitPrice}
                    onChange={(ev) => setRow(idx, { unitPrice: ev.target.value })}
                    style={{ ...inp(), width: 110, textAlign: 'right' }}
                  />
                </td>
                <td style={{ ...cell(), textAlign: 'right' }}>{amt.toLocaleString('tr-TR')}</td>
                <td style={{ ...cell(), textAlign: 'right' }}>{pct.toFixed(2)}</td>
                <td style={cell()}>
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    disabled={rows.length <= 1}
                    style={miniBtn()}
                  >
                    −
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 600, borderTop: '2px solid var(--line, #ccc)' }}>
            <td style={cell()} colSpan={6}>
              Toplam Keşif Bedeli
            </td>
            <td style={{ ...cell(), textAlign: 'right' }}>{total.toLocaleString('tr-TR')}</td>
            <td style={{ ...cell(), textAlign: 'right' }}>{total > 0 ? '100.00' : '0.00'}</td>
            <td style={cell()} />
          </tr>
        </tfoot>
      </table>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="button" onClick={addRow} style={btn()}>
          + Satır
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving === true}
          style={{ ...btn(), background: 'var(--accent, #0066cc)', color: '#fff', border: 'none' }}
        >
          {saving === true ? 'Kaydediliyor…' : 'Keşfi Kaydet'}
        </button>
      </div>
    </div>
  );
}

function cell(): React.CSSProperties {
  return { padding: '6px 8px', borderBottom: '1px solid var(--line, #eee)' };
}
function inp(): React.CSSProperties {
  return {
    padding: '4px 6px',
    border: '1px solid var(--line, #d1d5db)',
    borderRadius: 4,
    fontSize: 12,
  };
}
function btn(): React.CSSProperties {
  return {
    padding: '6px 14px',
    border: '1px solid var(--line, #d1d5db)',
    borderRadius: 4,
    background: 'var(--paper, #fff)',
    cursor: 'pointer',
    fontSize: 12,
  };
}
function miniBtn(): React.CSSProperties {
  return {
    padding: '2px 8px',
    border: '1px solid var(--line, #d1d5db)',
    borderRadius: 4,
    background: 'var(--paper, #fff)',
    cursor: 'pointer',
    fontSize: 13,
  };
}
