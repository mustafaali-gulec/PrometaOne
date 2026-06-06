/**
 * ContractsTable — sözleşmeler tablosu (taraf rozetli, ihaleli işaretli).
 */
import type { ContractDto, ContractParty } from '../../application/dto/ConstructionDtos';

export interface ContractsTableProps {
  contracts: ReadonlyArray<ContractDto>;
  loading?: boolean;
}

const PARTY_LABELS: Record<ContractParty, string> = {
  employer: 'İşveren (gelir)',
  subcontractor: 'Taşeron (gider)',
};

const PARTY_COLORS: Record<ContractParty, string> = {
  employer: '#0ea5e9',
  subcontractor: '#7c3aed',
};

export function ContractsTable({ contracts, loading }: ContractsTableProps): JSX.Element {
  if (loading === true) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Yükleniyor…
      </div>
    );
  }
  if (contracts.length === 0) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Sözleşme bulunamadı.
      </div>
    );
  }

  return (
    <table
      data-testid="cs-contracts-table"
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <thead>
        <tr style={{ background: 'var(--paper-2, #f5f5f5)', textAlign: 'left' }}>
          <th style={cell()}>Sözleşme No</th>
          <th style={cell()}>Başlık</th>
          <th style={cell()}>Taraf</th>
          <th style={{ ...cell(), textAlign: 'right' }}>Bedel</th>
          <th style={{ ...cell(), textAlign: 'right' }}>Teminat %</th>
          <th style={cell()}>İhale (İKN)</th>
        </tr>
      </thead>
      <tbody>
        {contracts.map((c) => (
          <tr key={String(c.id)} style={{ borderBottom: '1px solid var(--line, #e5e5e5)' }}>
            <td style={cell()}>
              <strong>{c.contractNo}</strong>
            </td>
            <td style={cell()}>{c.title}</td>
            <td style={cell()}>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: PARTY_COLORS[c.partyKind],
                  color: '#fff',
                }}
              >
                {PARTY_LABELS[c.partyKind]}
              </span>
            </td>
            <td style={{ ...cell(), textAlign: 'right' }}>
              {c.amount.toLocaleString('tr-TR')} {c.currency}
            </td>
            <td style={{ ...cell(), textAlign: 'right' }}>{c.retentionPct}</td>
            <td style={cell()}>
              {c.tender !== null ? (
                <span title={c.tender.procedure ?? ''}>🏛️ {c.tender.ikn ?? 'İhaleli'}</span>
              ) : (
                <span style={{ color: 'var(--ink-muted, #888)' }}>—</span>
              )}
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
