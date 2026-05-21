/**
 * Position — iş tanımı / job title.
 *
 * Immutable. State machine PositionStatus VO'da; geçişler `transitionTo`
 * üzerinden yapılır. headcount + salary aralığı invariant'ları create
 * sırasında kontrol edilir.
 */
import {
  isPositionTransitionAllowed,
  InvalidPositionTransitionError,
  type PositionStatus,
} from '../valueObjects/PositionStatus.js';

export interface PositionProps {
  id: number;
  companyId: number;
  departmentId: number | null;
  title: string;
  description: string | null;
  status: PositionStatus;
  headcountTarget: number;
  minSalary: number | null;
  maxSalary: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Position {
  private constructor(private readonly props: Readonly<PositionProps>) {}

  static create(props: PositionProps): Position {
    if (props.id <= 0) {
      throw new Error('Position.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('Position.companyId pozitif olmalı');
    }
    if (props.departmentId !== null && props.departmentId <= 0) {
      throw new Error('Position.departmentId pozitif olmalı veya null');
    }
    if (props.title.trim().length === 0) {
      throw new Error('Position.title boş olamaz');
    }
    if (props.title.length > 200) {
      throw new Error('Position.title 200 karakteri geçemez');
    }
    if (!Number.isInteger(props.headcountTarget)) {
      throw new Error('Position.headcountTarget tam sayı olmalı');
    }
    if (props.headcountTarget < 0) {
      throw new Error('Position.headcountTarget negatif olamaz');
    }
    if (props.minSalary !== null && props.minSalary < 0) {
      throw new Error('Position.minSalary negatif olamaz');
    }
    if (props.maxSalary !== null && props.maxSalary < 0) {
      throw new Error('Position.maxSalary negatif olamaz');
    }
    if (props.minSalary !== null && props.maxSalary !== null && props.minSalary > props.maxSalary) {
      throw new Error('Position.minSalary maxSalary üzerinde olamaz');
    }
    return new Position(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get departmentId(): number | null {
    return this.props.departmentId;
  }
  get title(): string {
    return this.props.title;
  }
  get description(): string | null {
    return this.props.description;
  }
  get status(): PositionStatus {
    return this.props.status;
  }
  get headcountTarget(): number {
    return this.props.headcountTarget;
  }
  get minSalary(): number | null {
    return this.props.minSalary;
  }
  get maxSalary(): number | null {
    return this.props.maxSalary;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isOpen(): boolean {
    return this.props.status === 'open';
  }

  rename(newTitle: string, now: Date): Position {
    const trimmed = newTitle.trim();
    if (trimmed.length === 0) {
      throw new Error('Position.title boş olamaz');
    }
    if (trimmed.length > 200) {
      throw new Error('Position.title 200 karakteri geçemez');
    }
    if (trimmed === this.props.title) {
      return this;
    }
    return new Position({ ...this.props, title: trimmed, updatedAt: now });
  }

  updateDescription(newDescription: string | null, now: Date): Position {
    if (newDescription === this.props.description) {
      return this;
    }
    return new Position({ ...this.props, description: newDescription, updatedAt: now });
  }

  updateHeadcount(newHeadcount: number, now: Date): Position {
    if (!Number.isInteger(newHeadcount)) {
      throw new Error('Position.headcountTarget tam sayı olmalı');
    }
    if (newHeadcount < 0) {
      throw new Error('Position.headcountTarget negatif olamaz');
    }
    if (newHeadcount === this.props.headcountTarget) {
      return this;
    }
    return new Position({ ...this.props, headcountTarget: newHeadcount, updatedAt: now });
  }

  updateSalaryRange(minSalary: number | null, maxSalary: number | null, now: Date): Position {
    if (minSalary !== null && minSalary < 0) {
      throw new Error('Position.minSalary negatif olamaz');
    }
    if (maxSalary !== null && maxSalary < 0) {
      throw new Error('Position.maxSalary negatif olamaz');
    }
    if (minSalary !== null && maxSalary !== null && minSalary > maxSalary) {
      throw new Error('Position.minSalary maxSalary üzerinde olamaz');
    }
    if (minSalary === this.props.minSalary && maxSalary === this.props.maxSalary) {
      return this;
    }
    return new Position({ ...this.props, minSalary, maxSalary, updatedAt: now });
  }

  /** Status geçişi — yasaksa InvalidPositionTransitionError fırlatır. */
  transitionTo(newStatus: PositionStatus, now: Date): Position {
    if (newStatus === this.props.status) {
      return this;
    }
    if (!isPositionTransitionAllowed(this.props.status, newStatus)) {
      throw new InvalidPositionTransitionError(this.props.status, newStatus);
    }
    return new Position({ ...this.props, status: newStatus, updatedAt: now });
  }

  toJSON(): Readonly<PositionProps> {
    return { ...this.props };
  }
}
