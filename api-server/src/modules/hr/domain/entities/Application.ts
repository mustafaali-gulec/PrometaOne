/**
 * Application — bir Candidate'in bir Position'a başvurusu.
 *
 * Immutable. State machine RecruitmentStage VO'da. stage geçişleri
 * `transitionTo` ile yapılır; aynı zamanda `stage_changed_at` ve
 * `stage_changed_by` güncellenir.
 *
 * "hired" stage'i terminaldir; bu duruma geçişin yan etkisi olarak
 * Employee oluşturulması HireFromApplicationUseCase'in işidir
 * (domain'de değil — application katmanı transactional bağlamı tutar).
 */
import {
  isStageTransitionAllowed,
  InvalidStageTransitionError,
  isTerminalStage,
  type RecruitmentStage,
} from '../valueObjects/RecruitmentStage.js';

export interface ApplicationProps {
  id: number;
  companyId: number;
  candidateId: number;
  positionId: number;
  stage: RecruitmentStage;
  stageChangedAt: Date;
  stageChangedBy: number | null;
  rejectionReason: string | null;
  salaryExpectation: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Application {
  private constructor(private readonly props: Readonly<ApplicationProps>) {}

  static create(props: ApplicationProps): Application {
    if (props.id <= 0) {
      throw new Error('Application.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('Application.companyId pozitif olmalı');
    }
    if (props.candidateId <= 0) {
      throw new Error('Application.candidateId pozitif olmalı');
    }
    if (props.positionId <= 0) {
      throw new Error('Application.positionId pozitif olmalı');
    }
    if (props.stageChangedBy !== null && props.stageChangedBy <= 0) {
      throw new Error('Application.stageChangedBy pozitif olmalı veya null');
    }
    if (props.salaryExpectation !== null && props.salaryExpectation < 0) {
      throw new Error('Application.salaryExpectation negatif olamaz');
    }
    return new Application(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get candidateId(): number {
    return this.props.candidateId;
  }
  get positionId(): number {
    return this.props.positionId;
  }
  get stage(): RecruitmentStage {
    return this.props.stage;
  }
  get stageChangedAt(): Date {
    return this.props.stageChangedAt;
  }
  get stageChangedBy(): number | null {
    return this.props.stageChangedBy;
  }
  get rejectionReason(): string | null {
    return this.props.rejectionReason;
  }
  get salaryExpectation(): number | null {
    return this.props.salaryExpectation;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Terminal stage'lerden birinde mi? */
  isTerminal(): boolean {
    return isTerminalStage(this.props.stage);
  }

  isHired(): boolean {
    return this.props.stage === 'hired';
  }

  /**
   * Stage geçişi. Yasaksa InvalidStageTransitionError fırlatır.
   * `stageChangedBy` actor user id, `now` mevcut zaman (clock.now()).
   */
  transitionTo(
    newStage: RecruitmentStage,
    now: Date,
    actorUserId: number | null,
    options: { rejectionReason?: string | null } = {},
  ): Application {
    if (newStage === this.props.stage) {
      return this;
    }
    if (!isStageTransitionAllowed(this.props.stage, newStage)) {
      throw new InvalidStageTransitionError(this.props.stage, newStage);
    }

    const rejectionReason =
      newStage === 'rejected'
        ? (options.rejectionReason ?? this.props.rejectionReason)
        : this.props.rejectionReason;

    return new Application({
      ...this.props,
      stage: newStage,
      stageChangedAt: now,
      stageChangedBy: actorUserId,
      rejectionReason,
      updatedAt: now,
    });
  }

  /** Notlar / beklenti gibi non-stage alanları günceller. */
  updateMetadata(
    update: {
      salaryExpectation?: number | null;
      notes?: string | null;
    },
    now: Date,
  ): Application {
    if (
      update.salaryExpectation !== undefined &&
      update.salaryExpectation !== null &&
      update.salaryExpectation < 0
    ) {
      throw new Error('Application.salaryExpectation negatif olamaz');
    }
    return new Application({
      ...this.props,
      salaryExpectation:
        update.salaryExpectation !== undefined
          ? update.salaryExpectation
          : this.props.salaryExpectation,
      notes: update.notes !== undefined ? update.notes : this.props.notes,
      updatedAt: now,
    });
  }

  toJSON(): Readonly<ApplicationProps> {
    return { ...this.props };
  }
}
