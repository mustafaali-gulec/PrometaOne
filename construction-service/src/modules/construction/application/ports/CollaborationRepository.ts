/**
 * CollaborationRepository — işbirliği kalıcılık portu (FAZ 11).
 * Concrete: infrastructure/persistence/PgCollaborationRepository.ts
 */
import type { Post } from '../../domain/entities/Post.js';

export const MEMBER_ROLES = [
  'manager',
  'engineer',
  'site_chief',
  'foreman',
  'accountant',
  'viewer',
  'other',
] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export interface ProjectMemberRow {
  id: number;
  companyId: number;
  projectId: number;
  userId: number;
  memberName: string;
  memberRole: MemberRole;
  title: string | null;
  note: string | null;
  active: boolean;
  addedBy: number | null;
  createdAt: Date;
}

export interface NewMemberInput {
  companyId: number;
  projectId: number;
  userId: number;
  memberName: string;
  memberRole: MemberRole;
  title: string | null;
  note: string | null;
  addedBy: number | null;
}

export interface MemberUpdateInput {
  memberName?: string | undefined;
  memberRole?: MemberRole | undefined;
  title?: string | null | undefined;
  note?: string | null | undefined;
  active?: boolean | undefined;
}

export interface NewPostInput {
  companyId: number;
  projectId: number;
  title: string | null;
  body: string;
  pinned: boolean;
  createdBy: number | null;
  authorName: string;
  /** Bilgilendirme listesi; boş = tüm aktif ekip. */
  recipients: ReadonlyArray<{ userId: number; userName: string }>;
}

export interface PostReadStats {
  /** Açık alıcı listesi ya da aktif ekip sayısı. */
  recipientCount: number;
  /** Hedef kitledeki okumalar. */
  targetReadCount: number;
  /** Herkesin okumaları (hedef dışındakiler dahil). */
  totalReadCount: number;
  commentCount: number;
}

export interface PostReadRow {
  userId: number;
  userName: string;
  readAt: Date;
}

export interface PostRecipientRow {
  userId: number;
  userName: string;
}

export interface PostCommentRow {
  id: number;
  postId: number;
  body: string;
  createdBy: number | null;
  authorName: string;
  createdAt: Date;
}

export interface ProjectPhotoRow {
  id: number;
  companyId: number;
  projectId: number;
  locationId: number | null;
  locationPath: string | null;
  title: string | null;
  takenAt: string | null;
  fileUrl: string | null;
  hasContent: boolean;
  mimeType: string | null;
  sizeBytes: number | null;
  createdBy: number | null;
  authorName: string;
  createdAt: Date;
}

export interface NewPhotoInput {
  companyId: number;
  projectId: number;
  locationId: number | null;
  title: string | null;
  takenAt: string | null;
  fileUrl: string | null;
  content: Buffer | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdBy: number | null;
  authorName: string;
}

export interface CollaborationRepository {
  // Ekip
  listMembers(
    projectId: number,
    companyId: number,
    includeInactive: boolean,
  ): Promise<ReadonlyArray<ProjectMemberRow>>;
  findMemberById(id: number, companyId: number): Promise<ProjectMemberRow | null>;
  findMemberByUser(projectId: number, userId: number): Promise<ProjectMemberRow | null>;
  insertMember(input: NewMemberInput): Promise<ProjectMemberRow>;
  updateMember(id: number, companyId: number, patch: MemberUpdateInput): Promise<ProjectMemberRow>;

  // Gönderiler
  insertPost(input: NewPostInput): Promise<Post>;
  findPostById(id: number, companyId: number): Promise<Post | null>;
  listPosts(
    projectId: number,
    companyId: number,
    includeInactive: boolean,
  ): Promise<ReadonlyArray<Post>>;
  updatePost(post: Post): Promise<Post>;
  readStatsFor(postIds: ReadonlyArray<number>): Promise<Map<number, PostReadStats>>;
  /** İdempotent: ilk okuma anı korunur (ON CONFLICT DO NOTHING). */
  markRead(postId: number, userId: number, userName: string): Promise<void>;
  listReads(postId: number): Promise<ReadonlyArray<PostReadRow>>;
  listRecipients(postId: number): Promise<ReadonlyArray<PostRecipientRow>>;
  hasRead(postId: number, userId: number): Promise<boolean>;
  readPostIdsFor(postIds: ReadonlyArray<number>, userId: number): Promise<ReadonlySet<number>>;
  insertComment(input: {
    companyId: number;
    postId: number;
    body: string;
    createdBy: number | null;
    authorName: string;
  }): Promise<PostCommentRow>;
  listComments(postId: number): Promise<ReadonlyArray<PostCommentRow>>;

  // Galeri
  insertPhoto(input: NewPhotoInput): Promise<ProjectPhotoRow>;
  listPhotos(projectId: number, companyId: number): Promise<ReadonlyArray<ProjectPhotoRow>>;
  findPhotoMeta(id: number, companyId: number): Promise<ProjectPhotoRow | null>;
  getPhotoContent(
    id: number,
    companyId: number,
  ): Promise<{ content: Buffer; mimeType: string | null } | null>;
  deactivatePhoto(id: number, companyId: number): Promise<boolean>;
}
