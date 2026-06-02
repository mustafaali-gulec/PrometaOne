/**
 * Minimal ambient declaration for `strong-soap`.
 *
 * Faz 6 ELogoProvider yalnızca `soap.createClient` ile bir SOAP client kurar ve
 * dinamik method'ları (Login, GetInboxInvoiceList, ...) callback ile çağırır.
 * Paket kendi tipini yayınlamadığı için bu declaration sadece kullandığımız
 * yüzeyi kapsar.
 */
declare module 'strong-soap' {
  export interface SoapClient {
    [method: string]: unknown;
  }

  export const soap: {
    createClient(
      url: string,
      options: Record<string, unknown>,
      callback: (err: unknown, client: SoapClient) => void,
    ): void;
  };
}
