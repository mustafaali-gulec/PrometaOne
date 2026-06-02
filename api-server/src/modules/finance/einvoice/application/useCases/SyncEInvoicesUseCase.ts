/**
 * SyncEInvoicesUseCase — entegratörden faturaları çekip cache'e yazar.
 *
 * Akış: kimlik çöz → provider.fetchInvoiceList → her özet için fetchInvoiceXml
 * → UblInvoiceParser → EInvoice.fromParsed → einvoices.upsert (idempotent,
 * UNIQUE(company,uuid)). Yeni sayısı findByUuid ile belirlenir. Sonuç sync log'a
 * yazılır, credential sync meta güncellenir. Tek fatura hata verirse sayılır
 * ama sync devam eder (partial).
 */
import type { Clock } from '../../../application/ports/Clock.js';
import { EInvoice } from '../../domain/entities/EInvoice.js';
import { EInvoiceCredentialNotFoundError } from '../../domain/errors/EInvoiceErrors.js';
import { UblInvoiceParser } from '../../domain/services/UblInvoiceParser.js';
import type { ProviderType } from '../../domain/valueObjects/ProviderType.js';
import type { CredentialCipher } from '../ports/CredentialCipher.js';
import type { EInvoiceProvider } from '../ports/EInvoiceProvider.js';
import type {
  EInvoiceCredentialRepository,
  EInvoiceRepository,
  SyncLogRepository,
} from '../ports/EInvoiceRepositories.js';

export interface SyncEInvoicesInput {
  companyId: number;
  provider: ProviderType;
  dateFrom: string;
  dateTo: string;
  direction?: 'incoming' | 'outgoing' | 'both';
  trigger?: 'manual' | 'cron' | 'api' | 'webhook';
  actorUserId: number | null;
}

export interface SyncEInvoicesResult {
  incomingFetched: number;
  incomingNew: number;
  outgoingFetched: number;
  outgoingNew: number;
  errorsCount: number;
  status: 'success' | 'partial' | 'error';
}

export class SyncEInvoicesUseCase {
  constructor(
    private readonly credentials: EInvoiceCredentialRepository,
    private readonly cipher: CredentialCipher,
    private readonly provider: EInvoiceProvider,
    private readonly einvoices: EInvoiceRepository,
    private readonly syncLog: SyncLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SyncEInvoicesInput): Promise<SyncEInvoicesResult> {
    const startedAt = this.clock.now();
    const direction = input.direction ?? 'both';

    const encrypted = await this.credentials.getEncrypted(input.companyId, input.provider);
    if (encrypted === null) {
      throw new EInvoiceCredentialNotFoundError(input.companyId, input.provider);
    }
    const config = this.cipher.decrypt(encrypted);

    const counters = {
      incomingFetched: 0,
      incomingNew: 0,
      outgoingFetched: 0,
      outgoingNew: 0,
      errorsCount: 0,
    };

    const summaries = await this.provider.fetchInvoiceList(config, {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      direction,
    });

    for (const summary of summaries) {
      if (summary.direction === 'incoming') counters.incomingFetched += 1;
      else counters.outgoingFetched += 1;

      try {
        const isNew = (await this.einvoices.findByUuid(input.companyId, summary.uuid)) === null;
        const xml = await this.provider.fetchInvoiceXml(config, summary.uuid, summary.direction);
        const parsed = UblInvoiceParser.parse(xml, summary.direction);
        await this.einvoices.upsert(
          EInvoice.fromParsed(parsed, {
            companyId: input.companyId,
            provider: input.provider,
            gibStatus: summary.gibStatus,
          }),
        );
        if (isNew) {
          if (summary.direction === 'incoming') counters.incomingNew += 1;
          else counters.outgoingNew += 1;
        }
      } catch {
        counters.errorsCount += 1;
      }
    }

    const status: SyncEInvoicesResult['status'] =
      counters.errorsCount === 0
        ? 'success'
        : counters.errorsCount < summaries.length
          ? 'partial'
          : 'error';

    const finishedAt = this.clock.now();
    await this.syncLog.record({
      companyId: input.companyId,
      provider: input.provider,
      trigger: input.trigger ?? 'manual',
      startedAt,
      finishedAt,
      status,
      incomingFetched: counters.incomingFetched,
      incomingNew: counters.incomingNew,
      outgoingFetched: counters.outgoingFetched,
      outgoingNew: counters.outgoingNew,
      errorsCount: counters.errorsCount,
      errorMessage: null,
      triggeredBy: input.actorUserId,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
    });

    const credential = await this.credentials.findByProvider(input.companyId, input.provider);
    if (credential !== null) {
      await this.credentials.update(
        credential.recordSync(
          {
            status,
            message: null,
            incoming: counters.incomingNew,
            outgoing: counters.outgoingNew,
          },
          finishedAt,
        ),
      );
    }

    return { ...counters, status };
  }
}
