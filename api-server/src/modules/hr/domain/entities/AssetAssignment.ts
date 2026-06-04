/**
 * AssetAssignment — bir varlığın bir çalışana atanma/iade kaydı (ledger).
 *
 * Immutable. `close` (iade) yeni instance döner.
 * Açık atama = returnedAt === null.
 */
export interface AssetAssignmentProps {
  id: number;
  companyId: number;
  assetId: number;
  employeeId: number;
  assignedAt: Date;
  assignedByUserId: number | null;
  returnedAt: Date | null;
  returnedByUserId: number | null;
  returnNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AssetAssignment {
  private constructor(private readonly props: Readonly<AssetAssignmentProps>) {}

  static create(props: AssetAssignmentProps): AssetAssignment {
    if (props.id <= 0) {
      throw new Error('AssetAssignment.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('AssetAssignment.companyId pozitif olmalı');
    }
    if (props.assetId <= 0) {
      throw new Error('AssetAssignment.assetId pozitif olmalı');
    }
    if (props.employeeId <= 0) {
      throw new Error('AssetAssignment.employeeId pozitif olmalı');
    }
    if (props.assignedByUserId !== null && props.assignedByUserId <= 0) {
      throw new Error('AssetAssignment.assignedByUserId pozitif olmalı veya null');
    }
    if (props.returnedByUserId !== null && props.returnedByUserId <= 0) {
      throw new Error('AssetAssignment.returnedByUserId pozitif olmalı veya null');
    }
    if (props.returnedAt !== null && props.returnedAt.getTime() < props.assignedAt.getTime()) {
      throw new Error('AssetAssignment.returnedAt assignedAt öncesi olamaz');
    }
    return new AssetAssignment(props);
  }

  // ---------------------------------------------------------------------------
  // Getter'lar
  // ---------------------------------------------------------------------------
  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get assetId(): number {
    return this.props.assetId;
  }
  get employeeId(): number {
    return this.props.employeeId;
  }
  get assignedAt(): Date {
    return this.props.assignedAt;
  }
  get assignedByUserId(): number | null {
    return this.props.assignedByUserId;
  }
  get returnedAt(): Date | null {
    return this.props.returnedAt;
  }
  get returnedByUserId(): number | null {
    return this.props.returnedByUserId;
  }
  get returnNote(): string | null {
    return this.props.returnNote;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isOpen(): boolean {
    return this.props.returnedAt === null;
  }

  // ---------------------------------------------------------------------------
  // Davranışlar — yeni instance döner
  // ---------------------------------------------------------------------------

  /** Atamayı kapat (iade). Zaten kapalıysa hata fırlatır. */
  close(
    returnedAt: Date,
    returnedByUserId: number | null,
    returnNote: string | null,
  ): AssetAssignment {
    if (!this.isOpen()) {
      throw new Error('AssetAssignment zaten kapalı (returnedAt dolu)');
    }
    return new AssetAssignment({
      ...this.props,
      returnedAt,
      returnedByUserId,
      returnNote,
      updatedAt: returnedAt,
    });
  }

  toJSON(): Readonly<AssetAssignmentProps> {
    return { ...this.props };
  }
}
