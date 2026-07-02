/**
 * PerfReview — Çalışan × Dönem değerlendirmesi. Tablo: hr_perf_reviews
 * (040_hr_performance.sql).
 *
 * Kaynak-of-truth istemci blob'udur (App.jsx hrPerfReviews); bu entity sync
 * payload'ını doğrular. employeeId blob'daki hrEmployees[].id string'idir
 * (emp_*); reviewerUserId/managerUserId kullanıcı adıdır (username). Hedefler
 * ve yetkinlikler JSONB olarak gömülü taşınır (puan hesaplama istemcide).
 */
import { PerformanceValidationError } from '../errors/PerformanceErrors.js';

export type PerfReviewStatus =
  | 'self_pending'
  | 'self_submitted'
  | 'manager_pending'
  | 'completed'
  | 'acknowledged';

export const PERF_REVIEW_STATUSES: readonly PerfReviewStatus[] = [
  'self_pending',
  'self_submitted',
  'manager_pending',
  'completed',
  'acknowledged',
];

export type PerfRatingKey = 'outstanding' | 'exceeds' | 'meets' | 'partially' | 'below';

export const PERF_RATING_KEYS: readonly PerfRatingKey[] = [
  'outstanding',
  'exceeds',
  'meets',
  'partially',
  'below',
];

export interface PerfGoal {
  id: string;
  title: string;
  description?: string | undefined;
  weight?: number | undefined;
  selfScore?: number | undefined;
  selfComment?: string | undefined;
  managerScore?: number | undefined;
  managerComment?: string | undefined;
}

export interface PerfCompetency {
  key: string;
  label?: string | undefined;
  selfScore?: number | undefined;
  selfComment?: string | undefined;
  managerScore?: number | undefined;
  managerComment?: string | undefined;
}

export interface PerfReviewProps {
  id: string;
  companyId: number;
  cycleId: string;
  employeeId: string;
  reviewerUserId: string | null;
  status: PerfReviewStatus;
  goals: PerfGoal[];
  competencies: PerfCompetency[];
  selfOverallComment: string;
  managerOverallComment: string;
  selfSubmittedAt: string | null; // ISO
  managerSubmittedAt: string | null;
  managerUserId: string | null;
  overallScore: number;
  ratingKey: PerfRatingKey | null;
  calibratedRatingKey: PerfRatingKey | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function assertDateish(value: string | null, field: string): void {
  if (value != null && value !== '' && Number.isNaN(Date.parse(value))) {
    throw new PerformanceValidationError(`${field} geçerli bir tarih değil: ${value}`);
  }
}

function assertRating(value: PerfRatingKey | null, field: string): void {
  if (value != null && !PERF_RATING_KEYS.includes(value)) {
    throw new PerformanceValidationError(`${field} geçersiz: ${value}`);
  }
}

export class PerfReview {
  private constructor(private readonly props: Readonly<PerfReviewProps>) {}

  static create(props: PerfReviewProps): PerfReview {
    const id = props.id.trim();
    if (id.length === 0 || id.length > 60)
      throw new PerformanceValidationError('PerfReview.id 1-60 karakter olmalı');
    if (props.companyId <= 0)
      throw new PerformanceValidationError('PerfReview.companyId pozitif olmalı');
    const cycleId = props.cycleId.trim();
    if (cycleId.length === 0 || cycleId.length > 60)
      throw new PerformanceValidationError('PerfReview.cycleId 1-60 karakter olmalı');
    const employeeId = props.employeeId.trim();
    if (employeeId.length === 0 || employeeId.length > 60)
      throw new PerformanceValidationError('PerfReview.employeeId 1-60 karakter olmalı');
    if (!PERF_REVIEW_STATUSES.includes(props.status))
      throw new PerformanceValidationError(`PerfReview.status geçersiz: ${props.status}`);
    if (!Number.isFinite(props.overallScore) || props.overallScore < 0 || props.overallScore > 100)
      throw new PerformanceValidationError('PerfReview.overallScore 0-100 arası olmalı');
    assertRating(props.ratingKey, 'PerfReview.ratingKey');
    assertRating(props.calibratedRatingKey, 'PerfReview.calibratedRatingKey');
    assertDateish(props.selfSubmittedAt, 'PerfReview.selfSubmittedAt');
    assertDateish(props.managerSubmittedAt, 'PerfReview.managerSubmittedAt');
    assertDateish(props.acknowledgedAt, 'PerfReview.acknowledgedAt');
    assertDateish(props.createdAt, 'PerfReview.createdAt');
    assertDateish(props.updatedAt, 'PerfReview.updatedAt');
    return new PerfReview({
      ...props,
      id,
      cycleId,
      employeeId,
      reviewerUserId: props.reviewerUserId || null,
      goals: props.goals ?? [],
      competencies: props.competencies ?? [],
      selfOverallComment: props.selfOverallComment ?? '',
      managerOverallComment: props.managerOverallComment ?? '',
      selfSubmittedAt: props.selfSubmittedAt || null,
      managerSubmittedAt: props.managerSubmittedAt || null,
      managerUserId: props.managerUserId || null,
      ratingKey: props.ratingKey || null,
      calibratedRatingKey: props.calibratedRatingKey || null,
      acknowledgedAt: props.acknowledgedAt || null,
      acknowledgedBy: props.acknowledgedBy || null,
      createdAt: props.createdAt || null,
      updatedAt: props.updatedAt || null,
    });
  }

  get id(): string {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get cycleId(): string {
    return this.props.cycleId;
  }
  get employeeId(): string {
    return this.props.employeeId;
  }
  get reviewerUserId(): string | null {
    return this.props.reviewerUserId;
  }
  get status(): PerfReviewStatus {
    return this.props.status;
  }
  get goals(): PerfGoal[] {
    return this.props.goals;
  }
  get competencies(): PerfCompetency[] {
    return this.props.competencies;
  }
  get selfOverallComment(): string {
    return this.props.selfOverallComment;
  }
  get managerOverallComment(): string {
    return this.props.managerOverallComment;
  }
  get selfSubmittedAt(): string | null {
    return this.props.selfSubmittedAt;
  }
  get managerSubmittedAt(): string | null {
    return this.props.managerSubmittedAt;
  }
  get managerUserId(): string | null {
    return this.props.managerUserId;
  }
  get overallScore(): number {
    return this.props.overallScore;
  }
  get ratingKey(): PerfRatingKey | null {
    return this.props.ratingKey;
  }
  get calibratedRatingKey(): PerfRatingKey | null {
    return this.props.calibratedRatingKey;
  }
  get acknowledgedAt(): string | null {
    return this.props.acknowledgedAt;
  }
  get acknowledgedBy(): string | null {
    return this.props.acknowledgedBy;
  }
  get createdAt(): string | null {
    return this.props.createdAt;
  }
  get updatedAt(): string | null {
    return this.props.updatedAt;
  }

  toJSON(): Readonly<PerfReviewProps> {
    return { ...this.props };
  }
}
