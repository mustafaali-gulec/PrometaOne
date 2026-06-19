/**
 * Variant — varyant (renk/beden/model vb.) tanımı (035_warehouse_aux.sql).
 *
 * options = varyant seçenekleri [{ code, name }] JSONB dizisi (aggregate çocuk).
 */
import type { VariantStatus } from '../valueObjects/AuxStatuses.js';

/** Varyant seçeneği (örn. { code: "KIRMIZI", name: "Kırmızı" }). */
export interface VariantOption {
  code: string;
  name: string;
}

export interface VariantProps {
  id: number;
  companyId: number;
  code: string;
  name: string;
  status: VariantStatus;
  options: ReadonlyArray<VariantOption>;
  createdAt: Date;
  updatedAt: Date;
}

export class Variant {
  private constructor(private readonly props: Readonly<VariantProps>) {}

  static create(props: VariantProps): Variant {
    if (props.id <= 0) {
      throw new Error('Variant.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('Variant.companyId pozitif olmalı');
    }
    if (props.code.trim().length === 0) {
      throw new Error('Variant.code boş olamaz');
    }
    if (props.name.trim().length === 0) {
      throw new Error('Variant.name boş olamaz');
    }
    for (const o of props.options) {
      if (o.code.trim().length === 0) {
        throw new Error('Variant.options.code boş olamaz');
      }
    }
    return new Variant(props);
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
  get status(): VariantStatus {
    return this.props.status;
  }
  get options(): ReadonlyArray<VariantOption> {
    return this.props.options;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  withUpdates(
    patch: Partial<Pick<VariantProps, 'code' | 'name' | 'status' | 'options'>>,
    now: Date,
  ): Variant {
    return new Variant({ ...this.props, ...patch, updatedAt: now });
  }

  toJSON(): {
    id: number;
    companyId: number;
    code: string;
    name: string;
    status: VariantStatus;
    options: ReadonlyArray<VariantOption>;
  } {
    return {
      id: this.props.id,
      companyId: this.props.companyId,
      code: this.props.code,
      name: this.props.name,
      status: this.props.status,
      options: this.props.options,
    };
  }
}
