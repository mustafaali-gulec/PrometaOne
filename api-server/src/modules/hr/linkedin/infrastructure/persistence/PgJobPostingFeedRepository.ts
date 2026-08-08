/**
 * PgJobPostingFeedRepository — hr_job_posting_feed (053).
 *
 * Yayınlanan ilanın sunucu tarafı kopyası. Yeniden yayınlama (aynı postingRef)
 * satırı günceller ve `closed` durumundan `published`'a geri döndürür — ilan
 * tekrar açıldığında beslemede yeniden görünmeli.
 */
import type { Queryable } from '../../../infrastructure/persistence/Queryable.js';
import type {
  JobPostingFeedRepository,
  UpsertSnapshotInput,
} from '../../application/ports/LinkedInRepositories.js';
import { JobPostingSnapshot } from '../../domain/entities/JobPostingSnapshot.js';

interface FeedRow {
  id: string | number;
  company_id: number;
  posting_ref: string;
  slug: string | null;
  title: string;
  description: string;
  location: string | null;
  employment_type: string | null;
  company_name: string | null;
  apply_url: string | null;
  status: string;
  published_at: Date | null;
  closed_at: Date | null;
}

const COLS =
  'id, company_id, posting_ref, slug, title, description, location, employment_type, ' +
  'company_name, apply_url, status, published_at, closed_at';

function rowToSnapshot(row: FeedRow): JobPostingSnapshot {
  return JobPostingSnapshot.create({
    id: Number(row.id),
    companyId: Number(row.company_id),
    postingRef: row.posting_ref,
    slug: row.slug,
    title: row.title,
    description: row.description,
    location: row.location,
    employmentType: row.employment_type,
    companyName: row.company_name,
    applyUrl: row.apply_url,
    status: row.status === 'closed' ? 'closed' : 'published',
    publishedAt: row.published_at,
    closedAt: row.closed_at,
  });
}

export class PgJobPostingFeedRepository implements JobPostingFeedRepository {
  constructor(private readonly db: Queryable) {}

  async upsert(input: UpsertSnapshotInput): Promise<JobPostingSnapshot> {
    const r = await this.db.query<FeedRow>(
      `INSERT INTO hr_job_posting_feed
         (company_id, posting_ref, slug, title, description, location, employment_type,
          company_name, apply_url, status, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'published',$10)
       ON CONFLICT (company_id, posting_ref) DO UPDATE SET
         slug            = EXCLUDED.slug,
         title           = EXCLUDED.title,
         description     = EXCLUDED.description,
         location        = EXCLUDED.location,
         employment_type = EXCLUDED.employment_type,
         company_name    = EXCLUDED.company_name,
         apply_url       = EXCLUDED.apply_url,
         status          = 'published',
         closed_at       = NULL,
         published_at    = COALESCE(hr_job_posting_feed.published_at, EXCLUDED.published_at),
         updated_at      = NOW()
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.postingRef,
        input.slug,
        input.title,
        input.description,
        input.location,
        input.employmentType,
        input.companyName,
        input.applyUrl,
        input.publishedAt,
      ],
    );
    return rowToSnapshot(r.rows[0]!);
  }

  async findByRef(companyId: number, postingRef: string): Promise<JobPostingSnapshot | null> {
    const r = await this.db.query<FeedRow>(
      `SELECT ${COLS} FROM hr_job_posting_feed
        WHERE company_id = $1 AND posting_ref = $2 LIMIT 1`,
      [companyId, postingRef],
    );
    const row = r.rows[0];
    return row ? rowToSnapshot(row) : null;
  }

  async listPublished(companyId: number): Promise<JobPostingSnapshot[]> {
    const r = await this.db.query<FeedRow>(
      `SELECT ${COLS} FROM hr_job_posting_feed
        WHERE company_id = $1 AND status = 'published'
        ORDER BY published_at DESC NULLS LAST, id DESC`,
      [companyId],
    );
    return r.rows.map(rowToSnapshot);
  }

  async close(companyId: number, postingRef: string, now: Date): Promise<void> {
    await this.db.query(
      `UPDATE hr_job_posting_feed
          SET status = 'closed', closed_at = $3, updated_at = NOW()
        WHERE company_id = $1 AND posting_ref = $2`,
      [companyId, postingRef, now],
    );
  }
}
