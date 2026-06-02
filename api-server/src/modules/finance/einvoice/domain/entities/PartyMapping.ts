/**
 * PartyMapping — bir VKN/TCKN'yi mevcut müşteri/tedarikçi + varsayılan nakit
 * akış kategorisine eşler. einvoice_party_mapping (016) tablosu.
 *
 * autoImport=true ise o taraftan gelen faturalar otomatik import edilebilir
 * (use-case kararı). cashflowCatId import'ta Faz 5 invoice'a aktarılır.
 */
export interface PartyMappingProps {
  id: number | null;
  companyId: number;
  vknTckn: string;
  displayName: string | null;
  cashflowCatId: number | null;
  autoImport: boolean;
  notes: string | null;
}

export class PartyMapping {
  private constructor(private readonly props: PartyMappingProps) {}

  static create(props: PartyMappingProps): PartyMapping {
    if (props.companyId <= 0) {
      throw new Error('PartyMapping.companyId pozitif olmalı');
    }
    if (props.vknTckn.trim().length === 0) {
      throw new Error('PartyMapping.vknTckn boş olamaz');
    }
    return new PartyMapping({ ...props });
  }

  get id(): number | null {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get vknTckn(): string {
    return this.props.vknTckn;
  }
  get cashflowCatId(): number | null {
    return this.props.cashflowCatId;
  }
  get autoImport(): boolean {
    return this.props.autoImport;
  }

  withId(id: number): PartyMapping {
    return new PartyMapping({ ...this.props, id });
  }

  toJSON(): PartyMappingProps {
    return { ...this.props };
  }
}
