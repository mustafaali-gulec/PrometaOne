/**
 * EInvoice — entegratörden çekilmiş bir e-faturanın cache kaydı.
 *
 * `einvoice_invoices` (016) tablosuna karşılık gelir. Parse edilmiş belge
 * verisi (ParsedEInvoice) + şirket/provider bağlamı + import durumu.
 * Tutarlar Faz 5 `Money`. Immutable; durum geçişleri yeni instance döner.
 */
import type { Currency } from '../../../domain/valueObjects/Currency.js';
import type { Money } from '../../../domain/valueObjects/Money.js';
import type { ParsedEInvoice } from '../services/UblInvoiceParser.js';
import type { InvoiceDirection } from '../valueObjects/InvoiceDirection.js';
import type { ProviderType } from '../valueObjects/ProviderType.js';

import type { EInvoiceLine } from './EInvoiceLine.js';

export interface EInvoiceProps {
  id: number | null;
  companyId: number;
  provider: ProviderType;
  uuid: string;
  invoiceNo: string;
  direction: InvoiceDirection;
  invoiceType: string | null;
  scenario: string | null;
  partyVknTckn: string | null;
  partyName: string | null;
  partyAlias: string | null;
  issueDate: string;
  dueDate: string | null;
  currency: Currency;
  exchangeRate: number | null;
  subtotal: Money;
  kdvTotal: Money;
  tevkifatTotal: Money;
  konaklamaVergisi: Money;
  ozelTuketimVergisi: Money;
  payableAmount: Money;
  gibStatus: string | null;
  importedInvoiceId: number | null;
  ignored: boolean;
  ignoredReason: string | null;
  /** Belge notları (Genel Açıklamalar / cbc:Note). */
  notes: string | null;
  /** Transient — DB'de satır olarak tutulmaz; parse sonrası bellekte. */
  lines: ReadonlyArray<EInvoiceLine>;
  xmlRaw: string | null;
}

export class EInvoice {
  private constructor(private readonly props: EInvoiceProps) {}

  static create(props: EInvoiceProps): EInvoice {
    return new EInvoice(props);
  }

  /** Parse edilmiş belgeden şirket+provider bağlamıyla yeni cache kaydı (id=null). */
  static fromParsed(
    parsed: ParsedEInvoice,
    ctx: { companyId: number; provider: ProviderType; gibStatus?: string | null },
  ): EInvoice {
    return new EInvoice({
      id: null,
      companyId: ctx.companyId,
      provider: ctx.provider,
      uuid: parsed.uuid,
      invoiceNo: parsed.invoiceNo,
      direction: parsed.direction,
      invoiceType: parsed.invoiceType,
      scenario: parsed.scenario,
      partyVknTckn: parsed.party.vknTckn === '' ? null : parsed.party.vknTckn,
      partyName: parsed.party.name === '' ? null : parsed.party.name,
      partyAlias: parsed.party.alias,
      issueDate: parsed.issueDate,
      dueDate: parsed.dueDate,
      currency: parsed.currency,
      exchangeRate: parsed.exchangeRate,
      subtotal: parsed.subtotal,
      kdvTotal: parsed.kdvTotal,
      tevkifatTotal: parsed.tevkifatTotal,
      konaklamaVergisi: parsed.konaklamaVergisi,
      ozelTuketimVergisi: parsed.ozelTuketimVergisi,
      payableAmount: parsed.payableAmount,
      gibStatus: ctx.gibStatus ?? null,
      importedInvoiceId: null,
      ignored: false,
      ignoredReason: null,
      notes: parsed.notes,
      lines: parsed.lines,
      xmlRaw: parsed.xmlRaw,
    });
  }

  get id(): number | null {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get uuid(): string {
    return this.props.uuid;
  }
  get direction(): InvoiceDirection {
    return this.props.direction;
  }
  get invoiceNo(): string {
    return this.props.invoiceNo;
  }
  get partyName(): string | null {
    return this.props.partyName;
  }
  get partyVknTckn(): string | null {
    return this.props.partyVknTckn;
  }
  get issueDate(): string {
    return this.props.issueDate;
  }
  get dueDate(): string | null {
    return this.props.dueDate;
  }
  get currency(): Currency {
    return this.props.currency;
  }
  get subtotal(): Money {
    return this.props.subtotal;
  }
  get kdvTotal(): Money {
    return this.props.kdvTotal;
  }
  get payableAmount(): Money {
    return this.props.payableAmount;
  }
  get isImported(): boolean {
    return this.props.importedInvoiceId !== null;
  }
  get isIgnored(): boolean {
    return this.props.ignored;
  }
  get lines(): ReadonlyArray<EInvoiceLine> {
    return this.props.lines;
  }
  get notes(): string | null {
    return this.props.notes;
  }

  withId(id: number): EInvoice {
    return new EInvoice({ ...this.props, id });
  }

  /** Faz 5 invoices tablosuna aktarıldı olarak işaretle. */
  markImported(invoiceId: number): EInvoice {
    return new EInvoice({ ...this.props, importedInvoiceId: invoiceId });
  }

  /** Yok say (import etme). */
  markIgnored(reason: string | null): EInvoice {
    return new EInvoice({ ...this.props, ignored: true, ignoredReason: reason });
  }

  /** Pg repository için tam, tipli serileştirme (Money → decimal string). */
  toPersistence(): {
    companyId: number;
    provider: ProviderType;
    uuid: string;
    invoiceNo: string;
    direction: InvoiceDirection;
    invoiceType: string | null;
    scenario: string | null;
    partyVknTckn: string | null;
    partyName: string | null;
    partyAlias: string | null;
    issueDate: string;
    dueDate: string | null;
    currency: Currency;
    exchangeRate: number | null;
    subtotal: string;
    kdvTotal: string;
    tevkifatTotal: string;
    konaklamaVergisi: string;
    ozelTuketimVergisi: string;
    payableAmount: string;
    gibStatus: string | null;
    importedInvoiceId: number | null;
    ignored: boolean;
    ignoredReason: string | null;
    notes: string | null;
    xmlRaw: string | null;
  } {
    return {
      companyId: this.props.companyId,
      provider: this.props.provider,
      uuid: this.props.uuid,
      invoiceNo: this.props.invoiceNo,
      direction: this.props.direction,
      invoiceType: this.props.invoiceType,
      scenario: this.props.scenario,
      partyVknTckn: this.props.partyVknTckn,
      partyName: this.props.partyName,
      partyAlias: this.props.partyAlias,
      issueDate: this.props.issueDate,
      dueDate: this.props.dueDate,
      currency: this.props.currency,
      exchangeRate: this.props.exchangeRate,
      subtotal: this.props.subtotal.toDecimalString(),
      kdvTotal: this.props.kdvTotal.toDecimalString(),
      tevkifatTotal: this.props.tevkifatTotal.toDecimalString(),
      konaklamaVergisi: this.props.konaklamaVergisi.toDecimalString(),
      ozelTuketimVergisi: this.props.ozelTuketimVergisi.toDecimalString(),
      payableAmount: this.props.payableAmount.toDecimalString(),
      gibStatus: this.props.gibStatus,
      importedInvoiceId: this.props.importedInvoiceId,
      ignored: this.props.ignored,
      ignoredReason: this.props.ignoredReason,
      notes: this.props.notes,
      xmlRaw: this.props.xmlRaw,
    };
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      companyId: this.props.companyId,
      provider: this.props.provider,
      uuid: this.props.uuid,
      invoiceNo: this.props.invoiceNo,
      direction: this.props.direction,
      invoiceType: this.props.invoiceType,
      scenario: this.props.scenario,
      partyVknTckn: this.props.partyVknTckn,
      partyName: this.props.partyName,
      partyAlias: this.props.partyAlias,
      issueDate: this.props.issueDate,
      dueDate: this.props.dueDate,
      currency: this.props.currency,
      exchangeRate: this.props.exchangeRate,
      subtotal: this.props.subtotal.toDecimalString(),
      kdvTotal: this.props.kdvTotal.toDecimalString(),
      tevkifatTotal: this.props.tevkifatTotal.toDecimalString(),
      konaklamaVergisi: this.props.konaklamaVergisi.toDecimalString(),
      ozelTuketimVergisi: this.props.ozelTuketimVergisi.toDecimalString(),
      payableAmount: this.props.payableAmount.toDecimalString(),
      gibStatus: this.props.gibStatus,
      importedInvoiceId: this.props.importedInvoiceId,
      ignored: this.props.ignored,
      notes: this.props.notes,
      lines: this.props.lines.map((l) => l.toJSON()),
    };
  }
}
