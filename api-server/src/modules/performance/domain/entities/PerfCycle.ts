/**
 * PerfCycle — Değerlendirme Dönemi. Tablo: hr_perf_cycles (040_hr_performance.sql).
 *
 * Kaynak-of-truth istemci blob'udur (App.jsx hrPerfCycles); bu entity sync
 * payload'ını doğrular ve normalize eder. id istemci-üretimi (pc_*), zaman
 * damgaları istemcinin gönderdiği ISO string'ler olarak taşınır.
 */
import { PerformanceValidationError } from '../errors/PerformanceErrors.js';

export type PerfCycleStatus = 'draft' | 'active' | 'calibration' | 'closed';

export const PERF_CYCLE_STATUSES: readonly PerfCycleStatus[] = [
  'draft',
  'active',
  'calibration',
  'closed',
];

export interface PerfCompetencyDef {
  key: string;
  label?: string | undefined;
}

export interface PerfCycleProps {
  id: string;
  companyId: number;
  name: string;
  periodStart: string | null; // YYYY-MM-DD
  periodEnd: string | null;
  status: PerfCycleStatus;
  selfAssessment: boolean;
  competenciesEnabled: boolean;
  scaleMax: number;
  weightGoals: number;
  weightCompetencies: number;
  competencyDefs: PerfCompetencyDef[];
  createdBy: string | null;
  activatedAt: string | null; // ISO
  closedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function assertDateish(value: string | null, field: string): void {
  if (value != null && value !== '' && Number.isNaN(Date.parse(value))) {
    throw new PerformanceValidationError(`${field} geçerli bir tarih değil: ${value}`);
  }
}

export class PerfCycle {
  private constructor(private readonly props: Readonly<PerfCycleProps>) {}

  static create(props: PerfCycleProps): PerfCycle {
    const id = props.id.trim();
    if (id.length === 0 || id.length > 60)
      throw new PerformanceValidationError('PerfCycle.id 1-60 karakter olmalı');
    if (props.companyId <= 0)
      throw new PerformanceValidationError('PerfCycle.companyId pozitif olmalı');
    const name = props.name.trim();
    if (name.length === 0 || name.length > 200)
      throw new PerformanceValidationError('PerfCycle.name 1-200 karakter olmalı');
    if (!PERF_CYCLE_STATUSES.includes(props.status))
      throw new PerformanceValidationError(`PerfCycle.status geçersiz: ${props.status}`);
    if (!Number.isInteger(props.scaleMax) || props.scaleMax < 1 || props.scaleMax > 100)
      throw new PerformanceValidationError('PerfCycle.scaleMax 1-100 arası tamsayı olmalı');
    if (props.weightGoals < 0 || props.weightGoals > 100)
      throw new PerformanceValidationError('PerfCycle.weightGoals 0-100 arası olmalı');
    if (props.weightCompetencies < 0 || props.weightCompetencies > 100)
      throw new PerformanceValidationError('PerfCycle.weightCompetencies 0-100 arası olmalı');
    assertDateish(props.periodStart, 'PerfCycle.periodStart');
    assertDateish(props.periodEnd, 'PerfCycle.periodEnd');
    assertDateish(props.activatedAt, 'PerfCycle.activatedAt');
    assertDateish(props.closedAt, 'PerfCycle.closedAt');
    assertDateish(props.createdAt, 'PerfCycle.createdAt');
    assertDateish(props.updatedAt, 'PerfCycle.updatedAt');
    return new PerfCycle({
      ...props,
      id,
      name,
      periodStart: props.periodStart || null,
      periodEnd: props.periodEnd || null,
      activatedAt: props.activatedAt || null,
      closedAt: props.closedAt || null,
      createdAt: props.createdAt || null,
      updatedAt: props.updatedAt || null,
      competencyDefs: (props.competencyDefs ?? []).map((d) => ({
        key: d.key,
        ...(d.label !== undefined ? { label: d.label } : {}),
      })),
    });
  }

  get id(): string {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get name(): string {
    return this.props.name;
  }
  get periodStart(): string | null {
    return this.props.periodStart;
  }
  get periodEnd(): string | null {
    return this.props.periodEnd;
  }
  get status(): PerfCycleStatus {
    return this.props.status;
  }
  get selfAssessment(): boolean {
    return this.props.selfAssessment;
  }
  get competenciesEnabled(): boolean {
    return this.props.competenciesEnabled;
  }
  get scaleMax(): number {
    return this.props.scaleMax;
  }
  get weightGoals(): number {
    return this.props.weightGoals;
  }
  get weightCompetencies(): number {
    return this.props.weightCompetencies;
  }
  get competencyDefs(): PerfCompetencyDef[] {
    return this.props.competencyDefs;
  }
  get createdBy(): string | null {
    return this.props.createdBy;
  }
  get activatedAt(): string | null {
    return this.props.activatedAt;
  }
  get closedAt(): string | null {
    return this.props.closedAt;
  }
  get createdAt(): string | null {
    return this.props.createdAt;
  }
  get updatedAt(): string | null {
    return this.props.updatedAt;
  }

  toJSON(): Readonly<PerfCycleProps> {
    return { ...this.props };
  }
}
