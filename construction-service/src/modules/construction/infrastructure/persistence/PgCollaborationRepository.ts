/**
 * PgCollaborationRepository — CollaborationRepository PG implementasyonu (FAZ 11).
 * Tablolar: cs_project_members, cs_posts, cs_post_recipients, cs_post_reads,
 * cs_post_comments, cs_project_photos; görünüm: cs_v_post_read_stats.
 *
 * BIGINT kolonları node-pg'de STRING döner — mapper Number() çevirir.
 * Fotoğraf LİSTESİ content taşımaz (hasContent bayrağı) — galeri ızgarası
 * meta ile kurulur, bayt yalnız /photos/:id/content ucundan iner.
 */
import type { Pool } from 'pg';

import type {
  CollaborationRepository,
  MemberRole,
  MemberUpdateInput,
  NewMemberInput,
  NewPhotoInput,
  NewPostInput,
  PostCommentRow,
  PostReadRow,
  PostReadStats,
  PostRecipientRow,
  ProjectMemberRow,
  ProjectPhotoRow,
} from '../../application/ports/CollaborationRepository.js';
import { Post, type PostProps } from '../../domain/entities/Post.js';

const n = (v: string | number | null): number | null =>
  v === null ? null : typeof v === 'number' ? v : Number(v);
const nn = (v: string | number): number => (typeof v === 'number' ? v : Number(v));

// ===== EKİP =================================================================

interface MemberDbRow {
  id: string;
  company_id: number;
  project_id: string;
  user_id: number;
  member_name: string;
  member_role: MemberRole;
  title: string | null;
  note: string | null;
  active: boolean;
  added_by: number | null;
  created_at: Date;
}

const MEMBER_COLS =
  'id, company_id, project_id, user_id, member_name, member_role, title, note, active, added_by, created_at';

function toMember(r: MemberDbRow): ProjectMemberRow {
  return {
    id: nn(r.id),
    companyId: r.company_id,
    projectId: nn(r.project_id),
    userId: r.user_id,
    memberName: r.member_name,
    memberRole: r.member_role,
    title: r.title,
    note: r.note,
    active: r.active,
    addedBy: r.added_by,
    createdAt: r.created_at,
  };
}

// ===== GÖNDERİ ==============================================================

interface PostDbRow {
  id: string;
  company_id: number;
  project_id: string;
  title: string | null;
  body: string;
  pinned: boolean;
  active: boolean;
  created_by: number | null;
  author_name: string;
  edited_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const POST_COLS =
  'id, company_id, project_id, title, body, pinned, active, created_by, author_name, edited_at, created_at, updated_at';

function toPost(r: PostDbRow): Post {
  const props: PostProps = {
    id: nn(r.id),
    companyId: r.company_id,
    projectId: nn(r.project_id),
    title: r.title,
    body: r.body,
    pinned: r.pinned,
    active: r.active,
    createdBy: r.created_by,
    authorName: r.author_name,
    editedAt: r.edited_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  return Post.create(props);
}

// ===== GALERİ ===============================================================

interface PhotoDbRow {
  id: string;
  company_id: number;
  project_id: string;
  location_id: string | null;
  location_path: string | null;
  title: string | null;
  taken_at: string | null;
  file_url: string | null;
  has_content: boolean;
  mime_type: string | null;
  size_bytes: number | null;
  created_by: number | null;
  author_name: string;
  created_at: Date;
}

const PHOTO_COLS =
  'p.id, p.company_id, p.project_id, p.location_id, l.path AS location_path, p.title, ' +
  'p.taken_at::text AS taken_at, p.file_url, (p.content IS NOT NULL) AS has_content, ' +
  'p.mime_type, p.size_bytes, p.created_by, p.author_name, p.created_at';

function toPhoto(r: PhotoDbRow): ProjectPhotoRow {
  return {
    id: nn(r.id),
    companyId: r.company_id,
    projectId: nn(r.project_id),
    locationId: n(r.location_id),
    locationPath: r.location_path,
    title: r.title,
    takenAt: r.taken_at,
    fileUrl: r.file_url,
    hasContent: r.has_content,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    createdBy: r.created_by,
    authorName: r.author_name,
    createdAt: r.created_at,
  };
}

export class PgCollaborationRepository implements CollaborationRepository {
  constructor(private readonly pool: Pool) {}

  // ===== EKİP ===============================================================

  async listMembers(
    projectId: number,
    companyId: number,
    includeInactive: boolean,
  ): Promise<ReadonlyArray<ProjectMemberRow>> {
    const res = await this.pool.query<MemberDbRow>(
      `SELECT ${MEMBER_COLS} FROM cs_project_members
        WHERE project_id = $1 AND company_id = $2 ${includeInactive ? '' : 'AND active'}
        ORDER BY member_role, member_name`,
      [projectId, companyId],
    );
    return res.rows.map(toMember);
  }

  async findMemberById(id: number, companyId: number): Promise<ProjectMemberRow | null> {
    const res = await this.pool.query<MemberDbRow>(
      `SELECT ${MEMBER_COLS} FROM cs_project_members WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return res.rows[0] === undefined ? null : toMember(res.rows[0]);
  }

  async findMemberByUser(projectId: number, userId: number): Promise<ProjectMemberRow | null> {
    const res = await this.pool.query<MemberDbRow>(
      `SELECT ${MEMBER_COLS} FROM cs_project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId],
    );
    return res.rows[0] === undefined ? null : toMember(res.rows[0]);
  }

  async insertMember(input: NewMemberInput): Promise<ProjectMemberRow> {
    const res = await this.pool.query<MemberDbRow>(
      `INSERT INTO cs_project_members
         (company_id, project_id, user_id, member_name, member_role, title, note, added_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING ${MEMBER_COLS}`,
      [
        input.companyId,
        input.projectId,
        input.userId,
        input.memberName,
        input.memberRole,
        input.title,
        input.note,
        input.addedBy,
      ],
    );
    return toMember(res.rows[0]!);
  }

  async updateMember(
    id: number,
    companyId: number,
    patch: MemberUpdateInput,
  ): Promise<ProjectMemberRow> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const p = (v: unknown): string => {
      params.push(v);
      return `$${String(params.length)}`;
    };
    if (patch.memberName !== undefined) sets.push(`member_name = ${p(patch.memberName)}`);
    if (patch.memberRole !== undefined) sets.push(`member_role = ${p(patch.memberRole)}`);
    if (patch.title !== undefined) sets.push(`title = ${p(patch.title)}`);
    if (patch.note !== undefined) sets.push(`note = ${p(patch.note)}`);
    if (patch.active !== undefined) sets.push(`active = ${p(patch.active)}`);
    sets.push('updated_at = NOW()');
    const res = await this.pool.query<MemberDbRow>(
      `UPDATE cs_project_members SET ${sets.join(', ')}
        WHERE id = ${p(id)} AND company_id = ${p(companyId)}
        RETURNING ${MEMBER_COLS}`,
      params,
    );
    return toMember(res.rows[0]!);
  }

  // ===== GÖNDERİ ============================================================

  async insertPost(input: NewPostInput): Promise<Post> {
    // Alıcı listesi gönderiyle TEK transaction'da yazılır — listesiz kalan
    // hedefli duyuru "tüm ekibe" düşer ve payda sessizce değişir.
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query<PostDbRow>(
        `INSERT INTO cs_posts (company_id, project_id, title, body, pinned, created_by, author_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING ${POST_COLS}`,
        [
          input.companyId,
          input.projectId,
          input.title,
          input.body,
          input.pinned,
          input.createdBy,
          input.authorName,
        ],
      );
      const row = res.rows[0]!;
      for (const r of input.recipients) {
        await client.query(
          `INSERT INTO cs_post_recipients (post_id, user_id, user_name)
           VALUES ($1,$2,$3) ON CONFLICT (post_id, user_id) DO NOTHING`,
          [row.id, r.userId, r.userName],
        );
      }
      await client.query('COMMIT');
      return toPost(row);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findPostById(id: number, companyId: number): Promise<Post | null> {
    const res = await this.pool.query<PostDbRow>(
      `SELECT ${POST_COLS} FROM cs_posts WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return res.rows[0] === undefined ? null : toPost(res.rows[0]);
  }

  async listPosts(
    projectId: number,
    companyId: number,
    includeInactive: boolean,
  ): Promise<ReadonlyArray<Post>> {
    const res = await this.pool.query<PostDbRow>(
      `SELECT ${POST_COLS} FROM cs_posts
        WHERE project_id = $1 AND company_id = $2 ${includeInactive ? '' : 'AND active'}
        ORDER BY pinned DESC, created_at DESC, id DESC`,
      [projectId, companyId],
    );
    return res.rows.map(toPost);
  }

  async updatePost(post: Post): Promise<Post> {
    const j = post.toJSON();
    const res = await this.pool.query<PostDbRow>(
      `UPDATE cs_posts SET title = $1, body = $2, pinned = $3, active = $4,
              edited_at = $5, updated_at = NOW()
        WHERE id = $6 AND company_id = $7
        RETURNING ${POST_COLS}`,
      [j.title, j.body, j.pinned, j.active, j.editedAt, j.id, j.companyId],
    );
    return toPost(res.rows[0]!);
  }

  async readStatsFor(postIds: ReadonlyArray<number>): Promise<Map<number, PostReadStats>> {
    const map = new Map<number, PostReadStats>();
    if (postIds.length === 0) return map;
    const res = await this.pool.query<{
      post_id: string;
      recipient_count: string;
      total_read_count: string;
      target_read_count: string;
      comment_count: string;
    }>(`SELECT * FROM cs_v_post_read_stats WHERE post_id = ANY($1::bigint[])`, [postIds]);
    for (const r of res.rows) {
      map.set(nn(r.post_id), {
        recipientCount: Number(r.recipient_count),
        totalReadCount: Number(r.total_read_count),
        targetReadCount: Number(r.target_read_count),
        commentCount: Number(r.comment_count),
      });
    }
    return map;
  }

  async markRead(postId: number, userId: number, userName: string): Promise<void> {
    // İLK okuma anı korunur: conflict'te read_at GÜNCELLENMEZ.
    await this.pool.query(
      `INSERT INTO cs_post_reads (post_id, user_id, user_name)
       VALUES ($1,$2,$3) ON CONFLICT (post_id, user_id) DO NOTHING`,
      [postId, userId, userName],
    );
  }

  async listReads(postId: number): Promise<ReadonlyArray<PostReadRow>> {
    const res = await this.pool.query<{ user_id: number; user_name: string; read_at: Date }>(
      `SELECT user_id, user_name, read_at FROM cs_post_reads WHERE post_id = $1 ORDER BY read_at`,
      [postId],
    );
    return res.rows.map((r) => ({ userId: r.user_id, userName: r.user_name, readAt: r.read_at }));
  }

  async listRecipients(postId: number): Promise<ReadonlyArray<PostRecipientRow>> {
    const res = await this.pool.query<{ user_id: number; user_name: string }>(
      `SELECT user_id, user_name FROM cs_post_recipients WHERE post_id = $1 ORDER BY id`,
      [postId],
    );
    return res.rows.map((r) => ({ userId: r.user_id, userName: r.user_name }));
  }

  async hasRead(postId: number, userId: number): Promise<boolean> {
    const res = await this.pool.query(
      `SELECT 1 FROM cs_post_reads WHERE post_id = $1 AND user_id = $2`,
      [postId, userId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async readPostIdsFor(
    postIds: ReadonlyArray<number>,
    userId: number,
  ): Promise<ReadonlySet<number>> {
    if (postIds.length === 0) return new Set<number>();
    const res = await this.pool.query<{ post_id: string }>(
      `SELECT post_id FROM cs_post_reads WHERE post_id = ANY($1::bigint[]) AND user_id = $2`,
      [postIds, userId],
    );
    return new Set(res.rows.map((r) => nn(r.post_id)));
  }

  async insertComment(input: {
    companyId: number;
    postId: number;
    body: string;
    createdBy: number | null;
    authorName: string;
  }): Promise<PostCommentRow> {
    const res = await this.pool.query<{
      id: string;
      post_id: string;
      body: string;
      created_by: number | null;
      author_name: string;
      created_at: Date;
    }>(
      `INSERT INTO cs_post_comments (company_id, post_id, body, created_by, author_name)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, post_id, body, created_by, author_name, created_at`,
      [input.companyId, input.postId, input.body, input.createdBy, input.authorName],
    );
    const r = res.rows[0]!;
    return {
      id: nn(r.id),
      postId: nn(r.post_id),
      body: r.body,
      createdBy: r.created_by,
      authorName: r.author_name,
      createdAt: r.created_at,
    };
  }

  async listComments(postId: number): Promise<ReadonlyArray<PostCommentRow>> {
    const res = await this.pool.query<{
      id: string;
      post_id: string;
      body: string;
      created_by: number | null;
      author_name: string;
      created_at: Date;
    }>(
      `SELECT id, post_id, body, created_by, author_name, created_at
         FROM cs_post_comments WHERE post_id = $1 ORDER BY created_at, id`,
      [postId],
    );
    return res.rows.map((r) => ({
      id: nn(r.id),
      postId: nn(r.post_id),
      body: r.body,
      createdBy: r.created_by,
      authorName: r.author_name,
      createdAt: r.created_at,
    }));
  }

  // ===== GALERİ =============================================================

  async insertPhoto(input: NewPhotoInput): Promise<ProjectPhotoRow> {
    const res = await this.pool.query<{ id: string }>(
      `INSERT INTO cs_project_photos
         (company_id, project_id, location_id, title, taken_at, file_url, content,
          mime_type, size_bytes, created_by, author_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        input.companyId,
        input.projectId,
        input.locationId,
        input.title,
        input.takenAt,
        input.fileUrl,
        input.content,
        input.mimeType,
        input.sizeBytes,
        input.createdBy,
        input.authorName,
      ],
    );
    const meta = await this.findPhotoMeta(nn(res.rows[0]!.id), input.companyId);
    return meta!;
  }

  async listPhotos(projectId: number, companyId: number): Promise<ReadonlyArray<ProjectPhotoRow>> {
    const res = await this.pool.query<PhotoDbRow>(
      `SELECT ${PHOTO_COLS}
         FROM cs_project_photos p
         LEFT JOIN cs_locations l ON l.id = p.location_id
        WHERE p.project_id = $1 AND p.company_id = $2 AND p.active
        ORDER BY COALESCE(p.taken_at, p.created_at::date) DESC, p.id DESC`,
      [projectId, companyId],
    );
    return res.rows.map(toPhoto);
  }

  async findPhotoMeta(id: number, companyId: number): Promise<ProjectPhotoRow | null> {
    const res = await this.pool.query<PhotoDbRow>(
      `SELECT ${PHOTO_COLS}
         FROM cs_project_photos p
         LEFT JOIN cs_locations l ON l.id = p.location_id
        WHERE p.id = $1 AND p.company_id = $2`,
      [id, companyId],
    );
    return res.rows[0] === undefined ? null : toPhoto(res.rows[0]);
  }

  async getPhotoContent(
    id: number,
    companyId: number,
  ): Promise<{ content: Buffer; mimeType: string | null } | null> {
    const res = await this.pool.query<{ content: Buffer | null; mime_type: string | null }>(
      `SELECT content, mime_type FROM cs_project_photos
        WHERE id = $1 AND company_id = $2 AND active`,
      [id, companyId],
    );
    const r = res.rows[0];
    if (r === undefined || r.content === null) return null;
    return { content: r.content, mimeType: r.mime_type };
  }

  async deactivatePhoto(id: number, companyId: number): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE cs_project_photos SET active = FALSE WHERE id = $1 AND company_id = $2 AND active`,
      [id, companyId],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
