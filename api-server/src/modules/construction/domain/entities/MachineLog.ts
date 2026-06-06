/**
 * MachineLog — Makine günlük çalışma/yakıt/bakım kaydı. Tablo: cs_machine_logs.
 */
export interface MachineLogProps {
  id: number;
  companyId: number;
  machineId: number;
  projectId: number;
  logDate: string;
  workHours: number;
  fuelLiters: number;
  fuelCost: number;
  maintCost: number;
  boqLineId: number | null;
  note: string | null;
  createdBy: number | null;
  createdAt: Date;
}

export class MachineLog {
  private constructor(private readonly props: Readonly<MachineLogProps>) {}

  static create(props: MachineLogProps): MachineLog {
    if (props.id <= 0) throw new Error('MachineLog.id pozitif olmalı');
    if (props.machineId <= 0) throw new Error('MachineLog.machineId pozitif olmalı');
    if (props.projectId <= 0) throw new Error('MachineLog.projectId pozitif olmalı');
    if (props.workHours < 0 || props.fuelCost < 0 || props.maintCost < 0) {
      throw new Error('MachineLog değerleri negatif olamaz');
    }
    return new MachineLog(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get machineId(): number {
    return this.props.machineId;
  }
  get projectId(): number {
    return this.props.projectId;
  }
  get logDate(): string {
    return this.props.logDate;
  }
  get workHours(): number {
    return this.props.workHours;
  }
  get fuelLiters(): number {
    return this.props.fuelLiters;
  }
  get fuelCost(): number {
    return this.props.fuelCost;
  }
  get maintCost(): number {
    return this.props.maintCost;
  }
  get boqLineId(): number | null {
    return this.props.boqLineId;
  }
  get note(): string | null {
    return this.props.note;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  toJSON(): Readonly<MachineLogProps> {
    return { ...this.props };
  }
}
