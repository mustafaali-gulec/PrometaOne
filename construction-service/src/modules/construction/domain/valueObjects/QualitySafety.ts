/**
 * Kalite & Güvenlik değer nesneleri (FAZ 6).
 *
 * Dört ekranın (hasar-eksiklik, denetleme, RFI, görevlendirme) sabit listeleri,
 * geçiş kuralları ve puanlama matematiği burada; entity'ler bunları uygular.
 * Sabit listeler DB CHECK kısıtlarıyla birebir — ayrışırsa 400 yerine 500 alırız.
 */

// ===== HASAR-EKSİKLİK =======================================================

export const DEFECT_KINDS = [
  'workmanship',
  'missing_work',
  'material_damage',
  'dimensional',
  'plumbing',
  'electrical',
  'paint',
  'insulation',
  'cleaning',
  'safety',
  'other',
] as const;
export type DefectKind = (typeof DEFECT_KINDS)[number];

/** Beş kademe aciliyet (Imperium ile aynı kademe sayısı). */
export const DEFECT_SEVERITIES = ['very_low', 'low', 'medium', 'high', 'critical'] as const;
export type DefectSeverity = (typeof DEFECT_SEVERITIES)[number];

export const DEFECT_STATUSES = [
  'open',
  'in_progress',
  'fixed',
  'verified',
  'closed',
  'rejected',
] as const;
export type DefectStatus = (typeof DEFECT_STATUSES)[number];

export const DEFECT_SOURCES = ['internal', 'inspection', 'daily_log', 'client', 'rfi'] as const;
export type DefectSource = (typeof DEFECT_SOURCES)[number];

/**
 * Hasar-eksiklik durum geçişleri.
 *
 * `fixed → open` KASITLI olarak var: doğrulamada iş beğenilmezse kayıt yeniden
 * açılır ve `reopenCount` artar. Bu döngü taşeron karnesinin en anlamlı
 * sinyalidir — "giderdim" deyip geçen iş sayaçta görünür.
 *
 * `closed` TERMİNAL: kapanmış hasar-eksiklik yeniden açılmaz, yeni kayıt açılır.
 * Aksi halde bir kaydın ömrü boyunca kaç ayrı kusur olduğu sayılamaz.
 */
const DEFECT_TRANSITIONS: Record<DefectStatus, ReadonlyArray<DefectStatus>> = {
  open: ['in_progress', 'fixed', 'rejected'],
  in_progress: ['fixed', 'open', 'rejected'],
  fixed: ['verified', 'open'],
  verified: ['closed', 'open'],
  closed: [],
  rejected: ['open'],
};

export function canTransitionDefect(from: DefectStatus, to: DefectStatus): boolean {
  return DEFECT_TRANSITIONS[from].includes(to);
}

export function allowedDefectTransitions(from: DefectStatus): ReadonlyArray<DefectStatus> {
  return DEFECT_TRANSITIONS[from];
}

/** Kaydın işi bitmiş mi (gecikme ve açık sayımı bunun dışında kalır). */
export function isDefectClosed(status: DefectStatus): boolean {
  return status === 'verified' || status === 'closed' || status === 'rejected';
}

/**
 * Aciliyete göre önerilen giderme süresi (gün).
 *
 * Kritik kusur için 1 gün: iskele/elektrik gibi güvenlik kusurları ertesi güne
 * bırakılamaz. Bu bir ÖNERİ — kullanıcının girdiği bitiş tarihi ezilmez.
 */
const SEVERITY_DAYS: Record<DefectSeverity, number> = {
  critical: 1,
  high: 3,
  medium: 7,
  low: 14,
  very_low: 30,
};

export function suggestedDueDate(severity: DefectSeverity, from: Date): string {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + SEVERITY_DAYS[severity]);
  return d.toISOString().slice(0, 10);
}

/** Aciliyet sıralaması (liste sıralaması ve "en kötüsü" hesabı için). */
export function severityRank(severity: DefectSeverity): number {
  return DEFECT_SEVERITIES.indexOf(severity);
}

// ===== DENETLEME ============================================================

export const INSPECTION_TEMPLATE_KINDS = [
  'quality',
  'subcontractor_scorecard',
  'hse',
  'handover',
  'other',
] as const;
export type InspectionTemplateKind = (typeof INSPECTION_TEMPLATE_KINDS)[number];

export const INSPECTION_SCORINGS = ['weighted', 'pass_fail'] as const;
export type InspectionScoring = (typeof INSPECTION_SCORINGS)[number];

export const INSPECTION_STATUSES = ['draft', 'completed', 'approved', 'cancelled'] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

const INSPECTION_TRANSITIONS: Record<InspectionStatus, ReadonlyArray<InspectionStatus>> = {
  draft: ['completed', 'cancelled'],
  // Tamamlanmış denetim taslağa DÖNEBİLİR: puanı yanlış giren denetçi
  // düzeltebilsin. Onaylanmış denetim dönemez — karne o puanla yayınlandı.
  completed: ['approved', 'draft', 'cancelled'],
  approved: [],
  cancelled: [],
};

export function canTransitionInspection(from: InspectionStatus, to: InspectionStatus): boolean {
  return INSPECTION_TRANSITIONS[from].includes(to);
}

export interface AnswerLike {
  weight: number;
  maxScore: number;
  score: number | null;
  isNa: boolean;
  isCritical?: boolean;
}

export interface ScoreResult {
  /** Ağırlıklı alınan puan. */
  totalScore: number;
  /** Ağırlıklı alınabilecek en yüksek puan (uygulanamaz maddeler DÜŞÜLMÜŞ). */
  maxScore: number;
  /** Yüzde; puanlanacak madde yoksa null (0 değil — "ölçülmedi" ile "sıfır aldı" ayrı). */
  scorePct: number | null;
  grade: string | null;
  /** Eşiği geçti mi; ölçülemediyse null. */
  passed: boolean | null;
  /** Sıfır alan kritik madde sayısı — geçme eşiğini ezer. */
  criticalFailures: number;
  answeredCount: number;
  naCount: number;
  unansweredCount: number;
}

/**
 * Denetim puanı.
 *
 * ÜÇ KURAL:
 * 1. Uygulanamaz (`isNa`) madde paydan DA paydadan DA düşülür. 0 vermek taşeronu
 *    yapmadığı bir iş için cezalandırır.
 * 2. Cevaplanmamış madde de paydadan düşülür — yarısı doldurulmuş denetim
 *    "yüzde 50 aldı" gibi görünmemeli. Kaç madde cevapsız kaldığı ayrı döner.
 * 3. Sıfır alan KRİTİK madde varsa `passed=false`, toplam puan ne olursa olsun.
 *    Baret takmamak diğer maddelerle telafi edilemez.
 */
export function computeInspectionScore(
  answers: ReadonlyArray<AnswerLike>,
  passPct: number,
): ScoreResult {
  let totalScore = 0;
  let maxScore = 0;
  let answeredCount = 0;
  let naCount = 0;
  let unansweredCount = 0;
  let criticalFailures = 0;

  for (const a of answers) {
    if (a.isNa) {
      naCount += 1;
      continue;
    }
    if (a.score === null) {
      unansweredCount += 1;
      continue;
    }
    answeredCount += 1;
    totalScore += a.score * a.weight;
    maxScore += a.maxScore * a.weight;
    if (a.isCritical === true && a.score <= 0) criticalFailures += 1;
  }

  if (maxScore <= 0) {
    return {
      totalScore: 0,
      maxScore: 0,
      scorePct: null,
      grade: null,
      passed: null,
      criticalFailures,
      answeredCount,
      naCount,
      unansweredCount,
    };
  }

  const scorePct = round2((totalScore / maxScore) * 100);
  return {
    totalScore: round4(totalScore),
    maxScore: round4(maxScore),
    scorePct,
    grade: gradeOf(scorePct),
    passed: criticalFailures === 0 && scorePct >= passPct,
    criticalFailures,
    answeredCount,
    naCount,
    unansweredCount,
  };
}

/** Harf notu — karne formunda taşerona verilen sınıf. */
export function gradeOf(scorePct: number): string {
  if (scorePct >= 90) return 'A';
  if (scorePct >= 80) return 'B';
  if (scorePct >= 70) return 'C';
  if (scorePct >= 60) return 'D';
  return 'E';
}

// ===== RFI ==================================================================

export const RFI_DISCIPLINES = [
  'architectural',
  'structural',
  'mechanical',
  'electrical',
  'infrastructure',
  'landscape',
  'geotechnical',
  'other',
] as const;
export type RfiDiscipline = (typeof RFI_DISCIPLINES)[number];

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const RFI_STATUSES = ['open', 'answered', 'closed', 'cancelled'] as const;
export type RfiStatus = (typeof RFI_STATUSES)[number];

const RFI_TRANSITIONS: Record<RfiStatus, ReadonlyArray<RfiStatus>> = {
  // Açık RFI cevapsız da KAPATILABİLİR: soru geçersizleşir (imalat değişti).
  open: ['answered', 'closed', 'cancelled'],
  // Cevaplanmış RFI yeniden AÇILABİLİR: cevap yetersizse soru sürüyor demektir.
  answered: ['closed', 'open'],
  closed: [],
  cancelled: [],
};

export function canTransitionRfi(from: RfiStatus, to: RfiStatus): boolean {
  return RFI_TRANSITIONS[from].includes(to);
}

// ===== GÖREVLENDİRME ========================================================

export const ASSIGNMENT_STATUSES = ['open', 'in_progress', 'done', 'cancelled'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const ASSIGNMENT_SOURCES = ['defect', 'rfi', 'inspection', 'daily_log', 'tracking'] as const;
export type AssignmentSource = (typeof ASSIGNMENT_SOURCES)[number];

const ASSIGNMENT_TRANSITIONS: Record<AssignmentStatus, ReadonlyArray<AssignmentStatus>> = {
  open: ['in_progress', 'done', 'cancelled'],
  in_progress: ['done', 'open', 'cancelled'],
  // Bitmiş görev yeniden AÇILABİLİR: iş beğenilmediyse aynı görev sürer.
  done: ['in_progress'],
  cancelled: ['open'],
};

export function canTransitionAssignment(from: AssignmentStatus, to: AssignmentStatus): boolean {
  return ASSIGNMENT_TRANSITIONS[from].includes(to);
}

/**
 * Duruma göre ilerleme yüzdesi düzeltmesi.
 *
 * `done` daima %100'e çekilir: "tamamlandı ama %60" satırı raporda toplamları
 * bozar ve DB kısıtı da bunu reddeder. `open`a dönen görev yüzdesini KORUR —
 * yapılan iş silinmez.
 */
export function normalizeProgress(status: AssignmentStatus, pct: number): number {
  if (status === 'done') return 100;
  const clamped = Math.min(100, Math.max(0, pct));
  return round2(clamped);
}

// ===== ORTAK ================================================================

export const QUALITY_DOC_KINDS = ['defect', 'inspection', 'rfi', 'assignment'] as const;
export type QualityDocKind = (typeof QUALITY_DOC_KINDS)[number];

export const FILE_STAGES = ['before', 'after', 'other'] as const;
export type FileStage = (typeof FILE_STAGES)[number];

/** Gecikme günü: kapanmış kayıtta HESAPLANMAZ (tamamlanmış işi geç göstermek yanıltır). */
export function overdueDays(dueDate: string | null, open: boolean, today: string): number | null {
  if (dueDate === null || !open) return null;
  if (today <= dueDate) return 0;
  const diff = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`);
  return Math.max(0, Math.round(diff / 86_400_000));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
