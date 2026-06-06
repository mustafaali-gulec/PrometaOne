/**
 * MaterialRequest — Malzeme talebi (header + lines). Tablo: cs_material_requests
 * (+ cs_material_request_lines). Durum makinesi + düzenlenebilirlik invariant'ı.
 */
import {
  InvalidStatusTransitionError,
  MaterialRequestNotEditableError,
} from '../errors/ConstructionErrors.js';
import {
  canTransitionMreq,
  isMreqEditable,
  type MaterialRequestStatus,
} from '../valueObjects/Material.js';

export interface MaterialRequestLineData {
  id: number;
  materialId: number;
  qty: number;
  note: string | null;
}

export interface MaterialRequestProps {
  id: number;
  companyId: number;
  projectId: number;
  reqNo: string;
  status: MaterialRequestStatus;
  neededBy: string | null;
  note: string | null;
  requestedBy: number | null;
  approvedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  lines: ReadonlyArray<MaterialRequestLineData>;
}

export class MaterialRequest {
  private constructor(private readonly props: Readonly<MaterialRequestProps>) {}

  static create(props: MaterialRequestProps): MaterialRequest {
    if (props.id <= 0) throw new Error('MaterialRequest.id pozitif olmalı');
    if (props.projectId <= 0) throw new Error('MaterialRequest.projectId pozitif olmalı');
    if (props.reqNo.trim().length === 0) throw new Error('MaterialRequest.reqNo boş olamaz');
    return new MaterialRequest(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get projectId(): number {
    return this.props.projectId;
  }
  get reqNo(): string {
    return this.props.reqNo;
  }
  get status(): MaterialRequestStatus {
    return this.props.status;
  }
  get lines(): ReadonlyArray<MaterialRequestLineData> {
    return this.props.lines;
  }

  assertEditable(): void {
    if (!isMreqEditable(this.props.status)) {
      throw new MaterialRequestNotEditableError(this.props.status);
    }
  }

  changeStatus(to: MaterialRequestStatus, now: Date, actorUserId: number | null): MaterialRequest {
    if (!canTransitionMreq(this.props.status, to)) {
      throw new InvalidStatusTransitionError(this.props.status, to);
    }
    const next: MaterialRequestProps = { ...this.props, status: to, updatedAt: now };
    if (to === 'approved') next.approvedBy = actorUserId;
    if (to === 'rejected' || to === 'draft') next.approvedBy = null;
    return new MaterialRequest(next);
  }

  toJSON(): Readonly<MaterialRequestProps> {
    return { ...this.props };
  }
}
