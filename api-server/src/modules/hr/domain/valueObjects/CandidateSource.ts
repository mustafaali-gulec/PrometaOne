/**
 * CandidateSource — aday havuzuna nereden geldiği bilgisi (analytics için).
 *
 *  referral  — çalışan tavsiyesi
 *  linkedin  — LinkedIn ilanı / mesajı
 *  jobboard  — kariyer.net, secretcv, vb.
 *  direct    — doğrudan başvuru (web sitesi formu)
 *  agency    — istihdam danışmanlık şirketi
 *  other     — diğer / belirsiz
 */
export type CandidateSource = 'referral' | 'linkedin' | 'jobboard' | 'direct' | 'agency' | 'other';

export const ALL_CANDIDATE_SOURCES: ReadonlyArray<CandidateSource> = [
  'referral',
  'linkedin',
  'jobboard',
  'direct',
  'agency',
  'other',
];

export function isCandidateSource(value: unknown): value is CandidateSource {
  return (
    typeof value === 'string' && (ALL_CANDIDATE_SOURCES as ReadonlyArray<string>).includes(value)
  );
}
