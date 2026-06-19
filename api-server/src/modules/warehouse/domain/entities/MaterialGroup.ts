/**
 * MaterialGroup — malzeme grubu (035_warehouse_aux.sql).
 *
 * Basit referans kartı (code/name/status). Malzemeler groupId ile bağlanır.
 */
import type { GroupStatus } from '../valueObjects/AuxStatuses.js';

export interface MaterialGroupProps {
  id: number;
  companyId: number;
  code: string;
  name: string;
  status: GroupStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class MaterialGroup {
  private constructor(private readonly props: Readonly<MaterialGroupProps>) {}

  static create(props: MaterialGroupProps): MaterialGroup {
    if (props.id <= 0) {
      throw new Error('MaterialGroup.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('MaterialGroup.companyId pozitif olmalı');
    }
    if (props.code.trim().length === 0) {
      throw new Error('MaterialGroup.code boş olamaz');
    }
    if (props.name.trim().length === 0) {
      throw new Error('MaterialGroup.name boş olamaz');
    }
    return new MaterialGroup(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get code(): string {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get status(): GroupStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  withUpdates(
    patch: Partial<Pick<MaterialGroupProps, 'code' | 'name' | 'status'>>,
    now: Date,
  ): MaterialGroup {
    return new MaterialGroup({ ...this.props, ...patch, updatedAt: now });
  }

  toJSON(): {
    id: number;
    companyId: number;
    code: string;
    name: string;
    status: GroupStatus;
  } {
    return {
      id: this.props.id,
      companyId: this.props.companyId,
      code: this.props.code,
      name: this.props.name,
      status: this.props.status,
    };
  }
}
