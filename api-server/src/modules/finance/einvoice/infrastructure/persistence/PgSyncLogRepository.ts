/**
 * PgSyncLogRepository — einvoice_sync_log (016).
 */
import type { Queryable } from '../../../infrastructure/persistence/Queryable.js';
import type {
  SyncLogRecord,
  SyncLogRepository,
} from '../../application/ports/EInvoiceRepositories.js';
import { toProviderType } from '../../domain/valueObjects/ProviderType.js';

interface SyncLogRow {
  company_id: number;
  provider: string;
  trigger: string;
  started_at: Date;
  finished_at: Date | null;
  status: string | null;
  incoming_fetched: number;
  incoming_new: number;
  outgoing_fetched: number;
  outgoing_new: number;
  errors_count: number;
  error_message: string | null;
  triggered_by: number | null;
  date_from: string | null;
  date_to: string | null;
}

export class PgSyncLogRepository implements SyncLogRepository {
  constructor(private readonly db: Queryable) {}

  async record(log: SyncLogRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO einvoice_sync_log
         (company_id, provider, trigger, started_at, finished_at, status,
          incoming_fetched, incoming_new, outgoing_fetched, outgoing_new,
          errors_count, error_message, triggered_by, date_from, date_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        log.companyId,
        log.provider,
        log.trigger,
        log.startedAt,
        log.finishedAt,
        log.status,
        log.incomingFetched,
        log.incomingNew,
        log.outgoingFetched,
        log.outgoingNew,
        log.errorsCount,
        log.errorMessage,
        log.triggeredBy,
        log.dateFrom,
        log.dateTo,
      ],
    );
  }

  async listByCompany(companyId: number): Promise<ReadonlyArray<SyncLogRecord>> {
    const r = await this.db.query<SyncLogRow>(
      `SELECT company_id, provider, trigger, started_at, finished_at, status,
              incoming_fetched, incoming_new, outgoing_fetched, outgoing_new,
              errors_count, error_message, triggered_by,
              to_char(date_from, 'YYYY-MM-DD') AS date_from,
              to_char(date_to, 'YYYY-MM-DD') AS date_to
         FROM einvoice_sync_log WHERE company_id = $1 ORDER BY started_at DESC`,
      [companyId],
    );
    return r.rows.map((row) => ({
      companyId: row.company_id,
      provider: toProviderType(row.provider),
      trigger: row.trigger as SyncLogRecord['trigger'],
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      status: (row.status ?? 'error') as SyncLogRecord['status'],
      incomingFetched: row.incoming_fetched,
      incomingNew: row.incoming_new,
      outgoingFetched: row.outgoing_fetched,
      outgoingNew: row.outgoing_new,
      errorsCount: row.errors_count,
      errorMessage: row.error_message,
      triggeredBy: row.triggered_by,
      dateFrom: row.date_from,
      dateTo: row.date_to,
    }));
  }
}
