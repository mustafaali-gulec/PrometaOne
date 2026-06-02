/**
 * EInvoiceLine — bir e-fatura kalemi (UBL InvoiceLine karşılığı).
 *
 * Tutarlar Faz 5 `Money` ile kuruş-kesin. KDV/tevkifat oranı yüzde (ör. 20)
 * olarak XML'den geldiği gibi tutulur; tutarlar Money.
 */
import type { Money } from '../../../domain/valueObjects/Money.js';

export interface EInvoiceLineProps {
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  unitPrice: Money;
  lineTotal: Money;
  /** KDV oranı yüzde (ör. 20 = %20). */
  kdvRatePercent: number;
  kdvAmount: Money;
  /** Tevkifat oranı yüzde (varsa). */
  tevkifatRatePercent: number | null;
  tevkifatAmount: Money | null;
}

export class EInvoiceLine {
  private constructor(private readonly props: EInvoiceLineProps) {}

  static create(props: EInvoiceLineProps): EInvoiceLine {
    return new EInvoiceLine(props);
  }

  get name(): string {
    return this.props.name;
  }
  get quantity(): number {
    return this.props.quantity;
  }
  get unit(): string {
    return this.props.unit;
  }
  get unitPrice(): Money {
    return this.props.unitPrice;
  }
  get lineTotal(): Money {
    return this.props.lineTotal;
  }
  get kdvRatePercent(): number {
    return this.props.kdvRatePercent;
  }
  get kdvAmount(): Money {
    return this.props.kdvAmount;
  }
  get tevkifatAmount(): Money | null {
    return this.props.tevkifatAmount;
  }

  toJSON(): {
    name: string;
    description: string | null;
    quantity: number;
    unit: string;
    unitPrice: string;
    lineTotal: string;
    kdvRatePercent: number;
    kdvAmount: string;
    tevkifatRatePercent: number | null;
    tevkifatAmount: string | null;
  } {
    return {
      name: this.props.name,
      description: this.props.description,
      quantity: this.props.quantity,
      unit: this.props.unit,
      unitPrice: this.props.unitPrice.toDecimalString(),
      lineTotal: this.props.lineTotal.toDecimalString(),
      kdvRatePercent: this.props.kdvRatePercent,
      kdvAmount: this.props.kdvAmount.toDecimalString(),
      tevkifatRatePercent: this.props.tevkifatRatePercent,
      tevkifatAmount: this.props.tevkifatAmount
        ? this.props.tevkifatAmount.toDecimalString()
        : null,
    };
  }
}
