/**
 * GetEInvoicePdfUseCase — cache'teki bir e-faturanın görselini (PDF)
 * entegratörden çeker. Salt-okunur: cache'e/faturalara yazmaz; kimlik
 * (companyId, provider) üzerinden çözülür, PDF her istekte taze alınır.
 */
import {
  EInvoiceCredentialNotFoundError,
  EInvoiceNotFoundError,
  ProviderFetchError,
} from '../../domain/errors/EInvoiceErrors.js';
import type { CredentialCipher } from '../ports/CredentialCipher.js';
import type { EInvoiceProvider, ProviderInvoicePdf } from '../ports/EInvoiceProvider.js';
import type {
  EInvoiceCredentialRepository,
  EInvoiceRepository,
} from '../ports/EInvoiceRepositories.js';

export class GetEInvoicePdfUseCase {
  constructor(
    private readonly einvoices: EInvoiceRepository,
    private readonly credentials: EInvoiceCredentialRepository,
    private readonly cipher: CredentialCipher,
    private readonly provider: EInvoiceProvider,
  ) {}

  async execute(input: { companyId: number; einvoiceId: number }): Promise<ProviderInvoicePdf> {
    const einvoice = await this.einvoices.findById(input.einvoiceId, input.companyId);
    if (!einvoice) {
      throw new EInvoiceNotFoundError(input.einvoiceId);
    }
    if (einvoice.provider === 'manual') {
      throw new ProviderFetchError(
        'Elle yüklenen faturanın entegratör PDF görüntüsü yok — yüklenen dosyanın kendisine bakın',
      );
    }
    const encrypted = await this.credentials.getEncrypted(input.companyId, einvoice.provider);
    if (encrypted === null) {
      throw new EInvoiceCredentialNotFoundError(input.companyId, einvoice.provider);
    }
    const config = this.cipher.decrypt(encrypted);
    return this.provider.fetchInvoicePdf(config, einvoice.uuid, einvoice.direction);
  }
}
