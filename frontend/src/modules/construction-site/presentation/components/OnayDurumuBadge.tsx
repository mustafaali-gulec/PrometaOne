/**
 * OnayDurumuBadge — belge satırındaki "Onay Sırası N/M" göstergesi (FAZ 5).
 *
 * Imperium'un belge listelerinde onay durumu satırın içinde okunur; ayrı ekrana
 * gitmeden "kaç kişi onayladı, sıra kimde, geciken var mı" görülür. Burada da
 * aynısı: tek küçük etiket, renk durumdan, ayrıntı title'dan gelir.
 *
 * AKIŞI OLMAYAN BELGEDE HİÇBİR ŞEY BASILMAZ (summary === null). Boş bir "0/0"
 * rozeti "onay bekliyor" gibi okunur; oysa çoğu belge hiç onaya girmez.
 */
import type { CSSProperties } from 'react';

import type { ApprovalFlowSummaryDto } from '../../application/dto/ConstructionDtos';
import { approvalModeLabel, approvalStatusLabel, csT } from '../../i18n';

export interface OnayDurumuBadgeProps {
  summary: ApprovalFlowSummaryDto | null | undefined;
  lang?: string | undefined;
  /** Tıklanabilirse akış ayrıntısını açar. */
  onClick?: (() => void) | undefined;
}

const TONE: Record<string, { fg: string; bg: string; border: string }> = {
  pending: { fg: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
  approved: { fg: '#15803d', bg: '#f0fdf4', border: '#86efac' },
  rejected: { fg: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' },
  cancelled: { fg: '#64748b', bg: '#f8fafc', border: '#cbd5e1' },
};
/** Gecikmiş bekleyen akış kırmızıya kayar — sarı içinde kaybolmasın. */
const OVERDUE = { fg: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' };

export function OnayDurumuBadge({ summary, lang, onClick }: OnayDurumuBadgeProps): JSX.Element {
  if (summary === null || summary === undefined) {
    return (
      <span style={{ color: '#cbd5e1', fontSize: 11 }} title={csT('cs.apr.badge.none', lang)} />
    );
  }

  const overdue = summary.daysOverdue !== null && summary.daysOverdue > 0;
  const tone =
    overdue && summary.status === 'pending' ? OVERDUE : (TONE[summary.status] ?? TONE.pending!);

  const parts = [
    `${approvalStatusLabel(summary.status, lang)} · ${approvalModeLabel(summary.mode, lang)}`,
    `${csT('cs.apr.c.progress', lang)}: ${String(summary.approvedCount)}/${String(summary.requiredCount)}`,
  ];
  if (summary.currentApproverUserId !== null) {
    parts.push(
      `${csT('cs.apr.c.nextApprover', lang)}: ${csT('cs.apr.user', lang, { id: summary.currentApproverUserId })}`,
    );
  }
  if (summary.nextDueDate !== null) {
    parts.push(`${csT('cs.apr.c.dueDate', lang)}: ${summary.nextDueDate}`);
  }
  if (overdue) {
    parts.push(
      `${csT('cs.apr.c.overdue', lang)}: ${csT('cs.apr.days', lang, { n: summary.daysOverdue ?? 0 })}`,
    );
  }

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '1px 6px',
    borderRadius: 999,
    border: `1px solid ${tone.border}`,
    background: tone.bg,
    color: tone.fg,
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    cursor: onClick === undefined ? 'default' : 'pointer',
  };

  const body = (
    <>
      {summary.status === 'approved' ? '✓' : summary.status === 'rejected' ? '✕' : '◍'}
      {String(summary.approvedCount)}/{String(summary.requiredCount)}
      {overdue ? ' ⏱' : ''}
    </>
  );

  return onClick === undefined ? (
    <span style={style} title={parts.join('\n')}>
      {body}
    </span>
  ) : (
    <button type="button" style={style} title={parts.join('\n')} onClick={onClick}>
      {body}
    </button>
  );
}
