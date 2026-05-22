/**
 * RecruitmentFunnel — stage başına başvuru sayımı kartları.
 *
 * Sıralama: new → screening → interview → offer → hired (görsel huni).
 * rejected/withdrawn ayrı bir satırda küçük kartlar.
 */
import type { RecruitmentFunnelDto, RecruitmentStage } from '../../application/dto/HrDtos';

export interface RecruitmentFunnelProps {
  funnel: RecruitmentFunnelDto | null;
  loading?: boolean;
}

const ACTIVE_STAGES: RecruitmentStage[] = ['new', 'screening', 'interview', 'offer', 'hired'];
const TERMINAL_STAGES: RecruitmentStage[] = ['rejected', 'withdrawn'];

const LABELS: Record<RecruitmentStage, string> = {
  new: 'Yeni',
  screening: 'Tarama',
  interview: 'Mülakat',
  offer: 'Teklif',
  hired: 'İşe Alındı',
  rejected: 'Red',
  withdrawn: 'Çekildi',
};

const COLORS: Record<RecruitmentStage, string> = {
  new: '#6366f1',
  screening: '#0ea5e9',
  interview: '#f59e0b',
  offer: '#8b5cf6',
  hired: '#10b981',
  rejected: '#ef4444',
  withdrawn: '#9ca3af',
};

export function RecruitmentFunnel({ funnel, loading }: RecruitmentFunnelProps): JSX.Element {
  if (loading === true && funnel === null) {
    return (
      <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
        Yükleniyor…
      </div>
    );
  }
  const counts = funnel?.counts ?? {};
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${ACTIVE_STAGES.length}, 1fr)`,
          gap: 8,
          marginBottom: 8,
        }}
      >
        {ACTIVE_STAGES.map((s) => (
          <FunnelCard key={s} stage={s} count={counts[s] ?? 0} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {TERMINAL_STAGES.map((s) => (
          <FunnelCard key={s} stage={s} count={counts[s] ?? 0} small />
        ))}
      </div>
    </div>
  );
}

function FunnelCard({
  stage,
  count,
  small,
}: {
  stage: RecruitmentStage;
  count: number;
  small?: boolean;
}): JSX.Element {
  return (
    <div
      style={{
        background: COLORS[stage],
        color: '#fff',
        padding: small === true ? '8px 12px' : '14px 12px',
        borderRadius: 8,
        textAlign: 'center',
        minWidth: small === true ? 100 : 'auto',
      }}
    >
      <div style={{ fontSize: small === true ? 11 : 12, opacity: 0.9 }}>{LABELS[stage]}</div>
      <div style={{ fontSize: small === true ? 18 : 26, fontWeight: 700, marginTop: 2 }}>
        {count}
      </div>
    </div>
  );
}
