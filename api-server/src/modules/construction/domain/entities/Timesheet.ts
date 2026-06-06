/**
 * Timesheet — Günlük puantaj kaydı. Tablo: cs_timesheets. Create-only.
 */
export interface TimesheetProps {
  id: number;
  companyId: number;
  personnelId: number;
  workDate: string;
  hours: number;
  overtime: number;
  statusCode: string;
  boqLineId: number | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Timesheet {
  private constructor(private readonly props: Readonly<TimesheetProps>) {}

  static create(props: TimesheetProps): Timesheet {
    if (props.id <= 0) throw new Error('Timesheet.id pozitif olmalı');
    if (props.personnelId <= 0) throw new Error('Timesheet.personnelId pozitif olmalı');
    if (props.hours < 0 || props.overtime < 0) throw new Error('Timesheet saatleri negatif olamaz');
    return new Timesheet(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get personnelId(): number {
    return this.props.personnelId;
  }
  get workDate(): string {
    return this.props.workDate;
  }
  get hours(): number {
    return this.props.hours;
  }
  get overtime(): number {
    return this.props.overtime;
  }
  get statusCode(): string {
    return this.props.statusCode;
  }
  get boqLineId(): number | null {
    return this.props.boqLineId;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toJSON(): Readonly<TimesheetProps> {
    return { ...this.props };
  }
}
