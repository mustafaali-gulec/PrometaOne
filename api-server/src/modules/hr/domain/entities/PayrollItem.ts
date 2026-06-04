/**
 * PayrollItem — bir bordro koşusundaki tek bir çalışanın bordro fişi satırı.
 *
 * Immutable değer nesnesi. Brüt → kesintiler → net kırılımını taşır.
 * Hesap PayrollCalculator domain servisinde yapılır; bu entity sonucu saklar.
 */
export interface PayrollItemProps {
  id: number;
  companyId: number;
  runId: number;
  employeeId: number;
  grossSalary: number;
  sgkEmployee: number;
  unemployment: number;
  incomeTax: number;
  stampTax: number;
  otherDeductions: number;
  netSalary: number;
  createdAt: Date;
  updatedAt: Date;
}

export class PayrollItem {
  private constructor(private readonly props: Readonly<PayrollItemProps>) {}

  static create(props: PayrollItemProps): PayrollItem {
    if (props.id <= 0) {
      throw new Error('PayrollItem.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('PayrollItem.companyId pozitif olmalı');
    }
    if (props.runId <= 0) {
      throw new Error('PayrollItem.runId pozitif olmalı');
    }
    if (props.employeeId <= 0) {
      throw new Error('PayrollItem.employeeId pozitif olmalı');
    }
    if (props.grossSalary < 0) {
      throw new Error('PayrollItem.grossSalary negatif olamaz');
    }
    return new PayrollItem(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get runId(): number {
    return this.props.runId;
  }
  get employeeId(): number {
    return this.props.employeeId;
  }
  get grossSalary(): number {
    return this.props.grossSalary;
  }
  get sgkEmployee(): number {
    return this.props.sgkEmployee;
  }
  get unemployment(): number {
    return this.props.unemployment;
  }
  get incomeTax(): number {
    return this.props.incomeTax;
  }
  get stampTax(): number {
    return this.props.stampTax;
  }
  get otherDeductions(): number {
    return this.props.otherDeductions;
  }
  get netSalary(): number {
    return this.props.netSalary;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toJSON(): Readonly<PayrollItemProps> {
    return { ...this.props };
  }
}
