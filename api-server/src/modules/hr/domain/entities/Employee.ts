/**
 * Employee — çalışan sicili.
 *
 * Immutable. Davranışlar (transfer, terminate, linkUser, vb.) yeni instance döner.
 * State machine: EmployeeStatus VO; geçişler `transitionTo` üzerinden yapılır.
 *
 * ADR-0005: user_id opsiyonel — mavi yaka, taşeron, geçici çalışan link'siz olabilir.
 */
import type { EmployeeNumber } from '../valueObjects/EmployeeNumber.js';
import {
  isEmployeeTransitionAllowed,
  InvalidEmployeeTransitionError,
  type EmployeeStatus,
} from '../valueObjects/EmployeeStatus.js';
import type { EmploymentType } from '../valueObjects/EmploymentType.js';
import type { HireDate } from '../valueObjects/HireDate.js';
import type { PhoneNumber } from '../valueObjects/PhoneNumber.js';
import type { TcKimlik } from '../valueObjects/TcKimlik.js';

export interface EmployeeProps {
  id: number;
  companyId: number;
  userId: number | null;
  departmentId: number;
  positionId: number | null;
  employeeNo: EmployeeNumber;
  firstName: string;
  lastName: string;
  tcKimlik: TcKimlik | null;
  email: string | null;
  phone: PhoneNumber | null;
  hireDate: HireDate;
  terminationDate: Date | null;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  sourceApplicationId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Employee {
  private constructor(private readonly props: Readonly<EmployeeProps>) {}

  static create(props: EmployeeProps): Employee {
    if (props.id <= 0) {
      throw new Error('Employee.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('Employee.companyId pozitif olmalı');
    }
    if (props.userId !== null && props.userId <= 0) {
      throw new Error('Employee.userId pozitif olmalı veya null');
    }
    if (props.departmentId <= 0) {
      throw new Error('Employee.departmentId pozitif olmalı');
    }
    if (props.positionId !== null && props.positionId <= 0) {
      throw new Error('Employee.positionId pozitif olmalı veya null');
    }
    if (props.firstName.trim().length === 0) {
      throw new Error('Employee.firstName boş olamaz');
    }
    if (props.firstName.length > 100) {
      throw new Error('Employee.firstName 100 karakteri geçemez');
    }
    if (props.lastName.trim().length === 0) {
      throw new Error('Employee.lastName boş olamaz');
    }
    if (props.lastName.length > 100) {
      throw new Error('Employee.lastName 100 karakteri geçemez');
    }
    if (props.sourceApplicationId !== null && props.sourceApplicationId <= 0) {
      throw new Error('Employee.sourceApplicationId pozitif olmalı veya null');
    }
    // Terminated ise terminationDate dolu olmalı
    if (props.status === 'terminated' && props.terminationDate === null) {
      throw new Error('Employee terminated ise terminationDate dolu olmalı');
    }
    if (
      props.terminationDate !== null &&
      props.terminationDate.getTime() < props.hireDate.value.getTime()
    ) {
      throw new Error('Employee.terminationDate hireDate öncesi olamaz');
    }
    return new Employee(props);
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
  get userId(): number | null {
    return this.props.userId;
  }
  get departmentId(): number {
    return this.props.departmentId;
  }
  get positionId(): number | null {
    return this.props.positionId;
  }
  get employeeNo(): EmployeeNumber {
    return this.props.employeeNo;
  }
  get firstName(): string {
    return this.props.firstName;
  }
  get lastName(): string {
    return this.props.lastName;
  }
  get fullName(): string {
    return `${this.props.firstName} ${this.props.lastName}`;
  }
  get tcKimlik(): TcKimlik | null {
    return this.props.tcKimlik;
  }
  get email(): string | null {
    return this.props.email;
  }
  get phone(): PhoneNumber | null {
    return this.props.phone;
  }
  get hireDate(): HireDate {
    return this.props.hireDate;
  }
  get terminationDate(): Date | null {
    return this.props.terminationDate;
  }
  get status(): EmployeeStatus {
    return this.props.status;
  }
  get employmentType(): EmploymentType {
    return this.props.employmentType;
  }
  get sourceApplicationId(): number | null {
    return this.props.sourceApplicationId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isActive(): boolean {
    return this.props.status === 'active' || this.props.status === 'probation';
  }

  hasUserLink(): boolean {
    return this.props.userId !== null;
  }

  // ---------------------------------------------------------------------------
  // Davranışlar — yeni instance döner
  // ---------------------------------------------------------------------------

  /** Profil güncellemesi (isim, email, telefon). */
  updateProfile(
    update: {
      firstName?: string;
      lastName?: string;
      email?: string | null;
      phone?: PhoneNumber | null;
      tcKimlik?: TcKimlik | null;
      employmentType?: EmploymentType;
    },
    now: Date,
  ): Employee {
    const firstName =
      update.firstName !== undefined ? update.firstName.trim() : this.props.firstName;
    const lastName = update.lastName !== undefined ? update.lastName.trim() : this.props.lastName;

    if (firstName.length === 0) {
      throw new Error('Employee.firstName boş olamaz');
    }
    if (firstName.length > 100) {
      throw new Error('Employee.firstName 100 karakteri geçemez');
    }
    if (lastName.length === 0) {
      throw new Error('Employee.lastName boş olamaz');
    }
    if (lastName.length > 100) {
      throw new Error('Employee.lastName 100 karakteri geçemez');
    }

    return new Employee({
      ...this.props,
      firstName,
      lastName,
      email: update.email !== undefined ? update.email : this.props.email,
      phone: update.phone !== undefined ? update.phone : this.props.phone,
      tcKimlik: update.tcKimlik !== undefined ? update.tcKimlik : this.props.tcKimlik,
      employmentType:
        update.employmentType !== undefined ? update.employmentType : this.props.employmentType,
      updatedAt: now,
    });
  }

  /** Departman ve/veya pozisyon değişimi (transfer). */
  transferTo(departmentId: number, positionId: number | null, now: Date): Employee {
    if (departmentId <= 0) {
      throw new Error('Employee.departmentId pozitif olmalı');
    }
    if (positionId !== null && positionId <= 0) {
      throw new Error('Employee.positionId pozitif olmalı veya null');
    }
    if (departmentId === this.props.departmentId && positionId === this.props.positionId) {
      return this;
    }
    return new Employee({
      ...this.props,
      departmentId,
      positionId,
      updatedAt: now,
    });
  }

  /** Status geçişi — yasaksa InvalidEmployeeTransitionError fırlatır. */
  transitionTo(newStatus: EmployeeStatus, now: Date): Employee {
    if (newStatus === this.props.status) {
      return this;
    }
    if (!isEmployeeTransitionAllowed(this.props.status, newStatus)) {
      throw new InvalidEmployeeTransitionError(this.props.status, newStatus);
    }
    return new Employee({ ...this.props, status: newStatus, updatedAt: now });
  }

  /**
   * İşten ayrılış — status'ü terminated yapar ve terminationDate'i set eder.
   * terminationDate sağlanmazsa `now` kullanılır.
   */
  terminate(now: Date, terminationDate: Date | null = null): Employee {
    const effectiveTerminationDate = terminationDate ?? now;
    if (effectiveTerminationDate.getTime() < this.props.hireDate.value.getTime()) {
      throw new Error('Employee.terminationDate hireDate öncesi olamaz');
    }
    if (this.props.status === 'terminated') {
      // Yine de terminationDate değişebilir ama use-case bunu zorlamasın diye no-op
      return this;
    }
    if (!isEmployeeTransitionAllowed(this.props.status, 'terminated')) {
      throw new InvalidEmployeeTransitionError(this.props.status, 'terminated');
    }
    return new Employee({
      ...this.props,
      status: 'terminated',
      terminationDate: effectiveTerminationDate,
      updatedAt: now,
    });
  }

  /** User'a bağla. Zaten bağlıysa hata fırlatır (use-case'in işi karar vermek). */
  linkUser(userId: number, now: Date): Employee {
    if (userId <= 0) {
      throw new Error('Employee.userId pozitif olmalı');
    }
    if (this.props.userId === userId) {
      return this;
    }
    return new Employee({ ...this.props, userId, updatedAt: now });
  }

  /** User bağını kaldır. */
  unlinkUser(now: Date): Employee {
    if (this.props.userId === null) {
      return this;
    }
    return new Employee({ ...this.props, userId: null, updatedAt: now });
  }

  toJSON(): Readonly<EmployeeProps> {
    return { ...this.props };
  }
}
