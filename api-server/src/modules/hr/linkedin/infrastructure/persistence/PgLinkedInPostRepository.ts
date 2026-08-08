/**
 * PgLinkedInPostRepository — hr_linkedin_posts (053).
 *
 * (company_id, posting_ref, channel) üzerinde upsert: aynı ilanı tekrar
 * yayınlamak yeni satır açmaz, sonucu günceller. Başarılı gönderimden sonra
 * hata mesajı temizlenir (eski hata rozeti asılı kalmasın).
 */
import type { Queryable } from '../../../infrastructure/persistence/Queryable.js';
import type {
  LinkedInPostRepository,
  RecordPostInput,
} from '../../application/ports/LinkedInRepositories.js';
import { LinkedInJobPost } from '../../domain/entities/LinkedInJobPost.js';
import {
  toLinkedInChannel,
  type LinkedInChannel,
} from '../../domain/valueObjects/LinkedInChannel.js';
import { toLinkedInPostStatus } from '../../domain/valueObjects/LinkedInPostStatus.js';

interface PostRow {
  id: string | number;
  company_id: number;
  posting_ref: string;
  channel: string;
  status: string;
  post_urn: string | null;
  post_url: string | null;
  title: string | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, posting_ref, channel, status, post_urn, post_url, title, ' +
  'error_message, created_at, updated_at';

function rowToPost(row: PostRow): LinkedInJobPost {
  return LinkedInJobPost.create({
    id: Number(row.id),
    companyId: Number(row.company_id),
    postingRef: row.posting_ref,
    channel: toLinkedInChannel(row.channel),
    status: toLinkedInPostStatus(row.status),
    postUrn: row.post_urn,
    postUrl: row.post_url,
    title: row.title,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class PgLinkedInPostRepository implements LinkedInPostRepository {
  constructor(private readonly db: Queryable) {}

  async record(input: RecordPostInput): Promise<LinkedInJobPost> {
    const r = await this.db.query<PostRow>(
      `INSERT INTO hr_linkedin_posts
         (company_id, posting_ref, channel, status, post_urn, post_url, title,
          error_message, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (company_id, posting_ref, channel) DO UPDATE SET
         status        = EXCLUDED.status,
         post_urn      = EXCLUDED.post_urn,
         post_url      = EXCLUDED.post_url,
         title         = COALESCE(EXCLUDED.title, hr_linkedin_posts.title),
         error_message = EXCLUDED.error_message,
         updated_at    = NOW()
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.postingRef,
        input.channel,
        input.status,
        input.postUrn,
        input.postUrl,
        input.title,
        input.errorMessage,
        input.createdBy,
      ],
    );
    return rowToPost(r.rows[0]!);
  }

  async listByPosting(companyId: number, postingRef: string): Promise<LinkedInJobPost[]> {
    const r = await this.db.query<PostRow>(
      `SELECT ${COLS} FROM hr_linkedin_posts
        WHERE company_id = $1 AND posting_ref = $2
        ORDER BY channel`,
      [companyId, postingRef],
    );
    return r.rows.map(rowToPost);
  }

  async listByCompany(companyId: number, limit: number): Promise<LinkedInJobPost[]> {
    const r = await this.db.query<PostRow>(
      `SELECT ${COLS} FROM hr_linkedin_posts
        WHERE company_id = $1
        ORDER BY updated_at DESC
        LIMIT $2`,
      [companyId, limit],
    );
    return r.rows.map(rowToPost);
  }

  async findOne(
    companyId: number,
    postingRef: string,
    channel: LinkedInChannel,
  ): Promise<LinkedInJobPost | null> {
    const r = await this.db.query<PostRow>(
      `SELECT ${COLS} FROM hr_linkedin_posts
        WHERE company_id = $1 AND posting_ref = $2 AND channel = $3 LIMIT 1`,
      [companyId, postingRef, channel],
    );
    const row = r.rows[0];
    return row ? rowToPost(row) : null;
  }
}
