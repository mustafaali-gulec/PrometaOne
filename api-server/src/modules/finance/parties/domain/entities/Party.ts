/**
 * Party — cari kartı (müşteri / tedarikçi / personel / ortak ...).
 *
 * Sorgulanabilir alanlar tipli; frontend'in tam (zengin) cari objesi `data`
 * içinde taşınır. Bulk-import bu entity üzerinden upsert eder.
 */
export interface PartyProps {
  id: string;
  companyId: number;
  code: string;
  name: string;
  type: string;
  personType: string | null;
  taxId: string | null;
  status: string;
  data: Record<string, unknown>;
}

export class Party {
  private constructor(private readonly props: PartyProps) {}

  static create(props: PartyProps): Party {
    return new Party(props);
  }

  get id(): string {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get code(): string {
    return this.props.code;
  }
  get taxId(): string | null {
    return this.props.taxId;
  }

  toJSON(): PartyProps {
    return { ...this.props };
  }
}
