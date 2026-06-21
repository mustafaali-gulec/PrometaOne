/**
 * LoanDoc DTO'ları — kredi belgesinden AI ile alan çıkarma.
 *
 * Belge (PDF / Excel) → Claude → yapılandırılmış kredi alanları.
 * Çıktı, frontend'deki "Yeni Kredi" formunun draft alanlarıyla bire bir eşleşir.
 */

export type LoanDocCurrency = 'TRY' | 'USD' | 'EUR';
export type LoanDocType = 'installment' | 'spot' | 'bch' | 'kmh' | 'rotatif';

/** İstek: base64 dosya + meta. */
export interface ParseLoanDocRequestDto {
  /** Dosya adı (uzantı tip tespiti için kullanılır). */
  fileName: string;
  /** MIME tipi (opsiyonel, uzantıya ek ipucu). */
  mimeType?: string | undefined;
  /** Dosyanın base64 içeriği. */
  contentBase64: string;
}

/**
 * Çıkarılan kredi alanları. Bulunamayan her alan `null`.
 * `bankName` AC kart eşlemesi frontend'de yapılır (backend bankId bilmez).
 */
export interface LoanDocFields {
  type: LoanDocType | null;
  name: string | null;
  contractNo: string | null;
  bankName: string | null;
  principal: number | null;
  currency: LoanDocCurrency | null;
  interestRate: number | null;
  bsmvRate: number | null;
  kkdfRate: number | null;
  disbursementDate: string | null;
  termMonths: number | null;
  paymentDay: number | null;
  note: string | null;
}

export interface ParseLoanDocResultDto {
  fields: LoanDocFields;
  /** AI'ın belgeden gerçekten doldurabildiği alan anahtarları. */
  filledFields: Array<keyof LoanDocFields>;
  /** Belge tipi: 'pdf' | 'excel'. */
  format: 'pdf' | 'excel';
  /** Telemetri. */
  inputTokens: number | null;
  outputTokens: number | null;
}
