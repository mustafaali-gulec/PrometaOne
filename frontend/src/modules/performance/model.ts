// =====================================================================
// Performans Yönetimi — saf model (React/DOM bağımsız)
// ---------------------------------------------------------------------
// Döngü/değerlendirme durumları, varsayılan yetkinlik seti, derece bantları
// ve puan hesaplama yardımcıları. App.jsx (inline PerformanceManager /
// SelfServicePerformance) buradan import eder; i18n etiketleri ./i18n.ts'te.
// =====================================================================

export type PerfCycleStatus = 'draft' | 'active' | 'calibration' | 'closed';
export type PerfReviewStatus =
  | 'self_pending'
  | 'self_submitted'
  | 'manager_pending'
  | 'completed'
  | 'acknowledged';
export type PerfRatingKey = 'outstanding' | 'exceeds' | 'meets' | 'partially' | 'below';

export interface PerfGoal {
  id: string;
  title: string;
  description?: string;
  weight?: number; // hedefler içindeki ağırlık (%) — 0 ise eşit ağırlık
  selfScore?: number;
  selfComment?: string;
  managerScore?: number;
  managerComment?: string;
}

export interface PerfCompetency {
  key: string;
  label?: string;
  selfScore?: number;
  selfComment?: string;
  managerScore?: number;
  managerComment?: string;
}

export interface PerfCycle {
  id: string;
  name: string;
  periodStart?: string;
  periodEnd?: string;
  status: PerfCycleStatus;
  selfAssessment?: boolean;
  competenciesEnabled?: boolean;
  scaleMax?: number;
  weightGoals?: number;
  weightCompetencies?: number;
  competencyDefs?: { key: string; label?: string }[];
  createdAt?: string;
  createdBy?: string;
  activatedAt?: string;
  closedAt?: string;
}

export interface PerfReview {
  id: string;
  cycleId: string;
  employeeId: string;
  reviewerUserId?: string | null;
  status: PerfReviewStatus;
  goals: PerfGoal[];
  competencies: PerfCompetency[];
  selfOverallComment?: string;
  selfSubmittedAt?: string;
  managerOverallComment?: string;
  managerSubmittedAt?: string;
  managerUserId?: string;
  overallScore?: number;
  ratingKey?: PerfRatingKey | null;
  calibratedRatingKey?: PerfRatingKey | null;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Döngü durumu görsel meta (etiket ./i18n.ts → pl('cstatus.<key>'))
export const PERF_CYCLE_STATUS: Record<PerfCycleStatus, { color: string; icon: string }> = {
  draft: { color: '#737373', icon: '📝' },
  active: { color: '#15803d', icon: '🟢' },
  calibration: { color: '#ca8a04', icon: '⚖️' },
  closed: { color: '#475569', icon: '🔒' },
};

// Değerlendirme (review) durumu görsel meta (etiket → pl('rstatus.<key>'))
export const PERF_REVIEW_STATUS: Record<PerfReviewStatus, { color: string; icon: string }> = {
  self_pending: { color: '#0ea5e9', icon: '✍️' },
  self_submitted: { color: '#7c3aed', icon: '📤' },
  manager_pending: { color: '#ca8a04', icon: '⏳' },
  completed: { color: '#15803d', icon: '✓' },
  acknowledged: { color: '#0891b2', icon: '🤝' },
};

// Varsayılan yetkinlik seti (etiketler → pl('comp.<key>'))
export const PERF_DEFAULT_COMPETENCIES: { key: string }[] = [
  { key: 'job_knowledge' },
  { key: 'quality' },
  { key: 'productivity' },
  { key: 'communication' },
  { key: 'teamwork' },
  { key: 'initiative' },
];

// Puandan dereceye — 1..scaleMax skalasını orana çevirip bantlar (etiket → pl('rating.<key>'))
export const PERF_RATING_BANDS: { key: PerfRatingKey; minPct: number; color: string }[] = [
  { key: 'outstanding', minPct: 0.9, color: '#15803d' },
  { key: 'exceeds', minPct: 0.7, color: '#0891b2' },
  { key: 'meets', minPct: 0.5, color: '#ca8a04' },
  { key: 'partially', minPct: 0.3, color: '#ea580c' },
  { key: 'below', minPct: 0.0, color: '#b91c1c' },
];

export function perfNewId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function ratingKeyFromScore(score: number, scaleMax = 5): PerfRatingKey | null {
  const s = Number(score);
  const max = Number(scaleMax) || 5;
  if (!s || s <= 0) return null;
  const pct = s / max;
  for (const band of PERF_RATING_BANDS) {
    if (pct >= band.minPct) return band.key;
  }
  return 'below';
}

export function ratingColor(key: PerfRatingKey | null | undefined): string {
  const band = PERF_RATING_BANDS.find((b) => b.key === key);
  return band ? band.color : '#737373';
}

// Hedeflerin ağırlıklı ortalaması (weight 0 ise eşit ağırlık). useManager=false → öz puan.
export function goalsAvg(goals: PerfGoal[] | undefined, useManager = true): number {
  const field: keyof PerfGoal = useManager ? 'managerScore' : 'selfScore';
  const scored = (goals || []).filter((g) => Number(g[field]) > 0);
  if (scored.length === 0) return 0;
  const w = (g: PerfGoal) => (Number(g.weight) > 0 ? Number(g.weight) : 1);
  const totalW = scored.reduce((s, g) => s + w(g), 0);
  if (totalW <= 0) return 0;
  const sum = scored.reduce((s, g) => s + Number(g[field]) * w(g), 0);
  return sum / totalW;
}

// Yetkinliklerin düz ortalaması. useManager=false → öz puan.
export function competenciesAvg(comps: PerfCompetency[] | undefined, useManager = true): number {
  const field: keyof PerfCompetency = useManager ? 'managerScore' : 'selfScore';
  const scored = (comps || []).filter((c) => Number(c[field]) > 0);
  if (scored.length === 0) return 0;
  return scored.reduce((s, c) => s + Number(c[field]), 0) / scored.length;
}

// Genel puan — sadece puanlanan bileşenleri ağırlıklandırır (2 ondalık).
export function computeOverall(
  review: PerfReview,
  cycle: PerfCycle | undefined,
  useManager = true,
): number {
  const gAvg = goalsAvg(review.goals, useManager);
  const compsOn = !!cycle?.competenciesEnabled;
  const cAvg = compsOn ? competenciesAvg(review.competencies, useManager) : 0;
  const wG = Number(cycle?.weightGoals) > 0 ? Number(cycle?.weightGoals) : 60;
  const wC = compsOn
    ? Number(cycle?.weightCompetencies) > 0
      ? Number(cycle?.weightCompetencies)
      : 40
    : 0;
  const parts: { v: number; w: number }[] = [];
  if (gAvg > 0) parts.push({ v: gAvg, w: wG });
  if (compsOn && cAvg > 0) parts.push({ v: cAvg, w: wC });
  const totalW = parts.reduce((s, p) => s + p.w, 0);
  if (totalW <= 0) return 0;
  const val = parts.reduce((s, p) => s + p.v * p.w, 0) / totalW;
  return Math.round(val * 100) / 100;
}

// Etkin derece: kalibre edilmişse o, değilse ham puandan türetilen.
export function effectiveRating(
  review: PerfReview,
  cycle: PerfCycle | undefined,
): PerfRatingKey | null {
  if (review.calibratedRatingKey) return review.calibratedRatingKey;
  if (review.ratingKey) return review.ratingKey;
  const overall = Number(review.overallScore) || computeOverall(review, cycle, true);
  return ratingKeyFromScore(overall, cycle?.scaleMax || 5);
}

// Bir çalışan için boş değerlendirme kaydı oluştur (döngü başlatılırken).
export function buildReview(
  cycle: PerfCycle,
  employee: { id: string },
  reviewerUserId?: string | null,
): PerfReview {
  const now = new Date().toISOString();
  const compDefs = cycle.competenciesEnabled
    ? cycle.competencyDefs && cycle.competencyDefs.length
      ? cycle.competencyDefs
      : PERF_DEFAULT_COMPETENCIES
    : [];
  return {
    id: perfNewId('pf'),
    cycleId: cycle.id,
    employeeId: employee.id,
    reviewerUserId: reviewerUserId || null,
    status: cycle.selfAssessment ? 'self_pending' : 'manager_pending',
    goals: [],
    competencies: compDefs.map((c) => {
      const comp: PerfCompetency = {
        key: c.key,
        selfScore: 0,
        selfComment: '',
        managerScore: 0,
        managerComment: '',
      };
      const lbl = (c as { label?: string }).label;
      if (lbl) comp.label = lbl;
      return comp;
    }),
    selfOverallComment: '',
    managerOverallComment: '',
    overallScore: 0,
    ratingKey: null,
    calibratedRatingKey: null,
    createdAt: now,
    updatedAt: now,
  };
}
