/**
 * RaporManager — Şantiye raporları (SF-7). Proje gösterge paneli (sözleşme/keşif/
 * hakediş/maliyet/kâr-zarar) + pursantaj ilerleme eğrisi (S-eğrisi) tablosu +
 * Excel (xlsx) çıktısı.
 */
import { useEffect, useState } from 'react';

import * as XLSX from 'xlsx';

import type {
  ContractDto,
  ProgressCurveDto,
  ProjectDashboardDto,
  ProjectDto,
} from '../../application/dto/ConstructionDtos';
import type { ConstructionApi } from '../../application/ports/ConstructionApi';
import { useContracts } from '../hooks/useContracts';
import { useProjects } from '../hooks/useProjects';

export interface RaporManagerProps {
  api: ConstructionApi;
  companyId: number;
}

export function RaporManager({ api, companyId }: RaporManagerProps): JSX.Element {
  const { projects } = useProjects(api, companyId);
  const [projectId, setProjectId] = useState<number>(0);
  const { contracts } = useContracts(
    api,
    companyId,
    projectId > 0 ? { projectId } : { autoFetch: false },
  );
  const [dash, setDash] = useState<ProjectDashboardDto | null>(null);
  const [contractId, setContractId] = useState<number>(0);
  const [curve, setCurve] = useState<ProgressCurveDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDash(null);
    setContractId(0);
    setCurve(null);
    if (!(projectId > 0)) return;
    let off = false;
    api
      .getProjectDashboard(projectId, companyId)
      .then((d) => {
        if (!off) setDash(d);
      })
      .catch((e: unknown) => {
        if (!off) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      off = true;
    };
  }, [api, companyId, projectId]);

  useEffect(() => {
    if (!(contractId > 0)) {
      setCurve(null);
      return;
    }
    let off = false;
    api
      .getProgressCurve(contractId, companyId)
      .then((c) => {
        if (!off) setCurve(c);
      })
      .catch((e: unknown) => {
        if (!off) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      off = true;
    };
  }, [api, companyId, contractId]);

  const employerContracts = contracts.filter((c: ContractDto) => c.partyKind === 'employer');

  const exportExcel = (): void => {
    if (dash === null) return;
    const wb = XLSX.utils.book_new();
    const dashRows = [
      ['Proje', dash.projectName],
      ['Para Birimi', dash.currency],
      ['İşveren Sözleşme Bedeli', dash.employerContractTotal],
      ['Taşeron Sözleşme Bedeli', dash.subcontractorContractTotal],
      ['Keşif Toplamı', dash.boqTotal],
      ['Kümülatif Yapılan İş (Hakediş)', dash.progressGrossCumul],
      ['Ödenen Net Hakediş', dash.progressNetPaid],
      ['Şantiye Giderleri', dash.expenseTotal],
      ['İşçilik + Makine', dash.laborTotal],
      ['Toplam Maliyet', dash.costTotal],
      ['Fiziki Gerçekleşme %', dash.physicalPct],
      ['Tahmini Kâr/Zarar', dash.estimatedProfit],
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([['Gösterge', 'Değer'], ...dashRows]),
      'Gösterge Paneli',
    );
    if (curve !== null) {
      const curveRows = curve.points.map((p) => [
        p.seqNo,
        p.periodEnd ?? '',
        p.status,
        p.grossCumul,
        p.cumulPct,
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ['Hakediş No', 'Dönem Sonu', 'Durum', 'Kümülatif Tutar', 'Kümülatif %'],
          ...curveRows,
        ]),
        'Pursantaj Eğrisi',
      );
    }
    XLSX.writeFile(wb, `santiye-rapor-${dash.projectName.replace(/\s+/g, '_')}.xlsx`);
  };

  return (
    <section>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--ink-muted, #666)' }}>Proje:</span>
        <select
          value={projectId}
          onChange={(e) => setProjectId(Number(e.target.value))}
          style={fld({ minWidth: 260 })}
        >
          <option value={0}>— Proje seç —</option>
          {projects.map((p: ProjectDto) => (
            <option key={String(p.id)} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
        {dash !== null ? (
          <button
            onClick={exportExcel}
            style={{
              ...btn(),
              background: 'var(--accent, #0066cc)',
              color: '#fff',
              border: 'none',
            }}
          >
            ⬇ Excel İndir
          </button>
        ) : null}
      </div>

      {error !== null ? <div style={errBox()}>Hata: {error}</div> : null}

      {projectId === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-muted, #888)' }}>Rapor için bir proje seçin.</p>
      ) : null}

      {dash !== null ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <Kpi
            label="İşveren Sözleşme Bedeli"
            value={fmt(dash.employerContractTotal, dash.currency)}
          />
          <Kpi label="Keşif Toplamı" value={fmt(dash.boqTotal, dash.currency)} />
          <Kpi label="Kümülatif Yapılan İş" value={fmt(dash.progressGrossCumul, dash.currency)} />
          <Kpi label="Ödenen Net Hakediş" value={fmt(dash.progressNetPaid, dash.currency)} />
          <Kpi label="Toplam Maliyet" value={fmt(dash.costTotal, dash.currency)} />
          <Kpi
            label="Fiziki Gerçekleşme"
            value={`%${dash.physicalPct.toLocaleString('tr-TR')}`}
            accent="#0ea5e9"
          />
          <Kpi
            label="Tahmini Kâr/Zarar"
            value={fmt(dash.estimatedProfit, dash.currency)}
            accent={dash.estimatedProfit < 0 ? '#b91c1c' : '#15803d'}
          />
          <Kpi
            label="Taşeron Sözleşme Bedeli"
            value={fmt(dash.subcontractorContractTotal, dash.currency)}
          />
        </div>
      ) : null}

      {projectId > 0 ? (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-muted, #666)' }}>
              Pursantaj eğrisi — sözleşme:
            </span>
            <select
              value={contractId}
              onChange={(e) => setContractId(Number(e.target.value))}
              style={fld({ minWidth: 240 })}
            >
              <option value={0}>— İşveren sözleşmesi seç —</option>
              {employerContracts.map((c) => (
                <option key={String(c.id)} value={c.id}>
                  {c.contractNo} — {c.title}
                </option>
              ))}
            </select>
          </div>
          {curve !== null ? (
            curve.points.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--ink-muted, #888)' }}>
                Bu sözleşmede hakediş yok.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: 'var(--paper-2, #f5f5f5)', textAlign: 'left' }}>
                    <th style={cell()}>Hakediş No</th>
                    <th style={cell()}>Dönem Sonu</th>
                    <th style={cell()}>Durum</th>
                    <th style={{ ...cell(), textAlign: 'right' }}>Kümülatif Tutar</th>
                    <th style={{ ...cell(), textAlign: 'right' }}>Kümülatif %</th>
                    <th style={cell()}>İlerleme</th>
                  </tr>
                </thead>
                <tbody>
                  {curve.points.map((p) => (
                    <tr key={p.seqNo} style={{ borderBottom: '1px solid var(--line, #eee)' }}>
                      <td style={cell()}>#{p.seqNo}</td>
                      <td style={cell()}>{p.periodEnd ?? '—'}</td>
                      <td style={cell()}>{p.status}</td>
                      <td style={{ ...cell(), textAlign: 'right' }}>
                        {p.grossCumul.toLocaleString('tr-TR')}
                      </td>
                      <td style={{ ...cell(), textAlign: 'right' }}>
                        %{p.cumulPct.toLocaleString('tr-TR')}
                      </td>
                      <td style={cell()}>
                        <div
                          style={{
                            background: 'var(--line, #e5e5e5)',
                            borderRadius: 4,
                            height: 8,
                            width: 120,
                          }}
                        >
                          <div
                            style={{
                              background: 'var(--accent, #0ea5e9)',
                              height: 8,
                              borderRadius: 4,
                              width: `${Math.min(100, p.cumulPct)}%`,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}): JSX.Element {
  return (
    <div
      style={{
        padding: 12,
        border: '1px solid var(--line, #e5e7eb)',
        borderRadius: 6,
        background: 'var(--paper, #fff)',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--ink-muted, #888)' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: accent ?? 'inherit' }}>
        {value}
      </div>
    </div>
  );
}

function fmt(n: number, cur: string): string {
  return `${n.toLocaleString('tr-TR')} ${cur}`;
}
function cell(): React.CSSProperties {
  return { padding: '7px 9px', borderBottom: '1px solid var(--line, #eee)' };
}
function fld(extra: React.CSSProperties): React.CSSProperties {
  return {
    padding: '6px 8px',
    border: '1px solid var(--line, #d1d5db)',
    borderRadius: 4,
    fontSize: 12,
    ...extra,
  };
}
function btn(): React.CSSProperties {
  return {
    padding: '6px 12px',
    border: '1px solid var(--line, #d1d5db)',
    borderRadius: 4,
    background: 'var(--paper, #fff)',
    cursor: 'pointer',
    fontSize: 12,
  };
}
function errBox(): React.CSSProperties {
  return {
    padding: 10,
    background: 'var(--danger-bg, #fee2e2)',
    color: 'var(--danger, #b91c1c)',
    border: '1px solid var(--danger, #fca5a5)',
    borderRadius: 6,
    marginBottom: 12,
    fontSize: 13,
  };
}
