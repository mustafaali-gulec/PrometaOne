/**
 * Bank — sistem geneli banka tanımı (004_banks_kasa_transfers.sql).
 *
 * Şirkete bağlı değil; tüm şirketler aynı banka listesini paylaşır.
 * BankAccount bir Bank'a referans verir.
 */
export interface BankProps {
  id: number;
  name: string;
  code: string;
  color: string | null;
}

export class Bank {
  private constructor(private readonly props: Readonly<BankProps>) {}

  static create(props: BankProps): Bank {
    if (props.id <= 0) {
      throw new Error('Bank.id pozitif olmalı');
    }
    if (props.name.trim().length === 0) {
      throw new Error('Bank.name boş olamaz');
    }
    if (props.code.trim().length === 0) {
      throw new Error('Bank.code boş olamaz');
    }
    return new Bank(props);
  }

  get id(): number {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get code(): string {
    return this.props.code;
  }
  get color(): string | null {
    return this.props.color;
  }

  toJSON(): Readonly<BankProps> {
    return { ...this.props };
  }
}
