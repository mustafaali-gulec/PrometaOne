/**
 * İşbirliği use-case'leri (FAZ 11).
 *
 * OKUNMA: mark-read açık bir eylemdir (gönderi genişletilince istemci çağırır)
 * ve idempotenttir — İLK okuma anı korunur. Liste çekmek "okudu" SAYILMAZ:
 * listede başlık görünmesi metnin okunduğu anlamına gelmez.
 *
 * ORAN DÜRÜSTLÜĞÜ: readPct hedef kitle (açık liste ya da aktif ekip) üzerinden;
 * payda 0 → null ("kimse okumadı" ile "hedef kitle tanımsız" ayrışır).
 */
import type { Post, PostUpdate } from '../../domain/entities/Post.js';
import {
  ConstructionValidationError,
  DuplicateProjectMemberError,
  LocationNotFoundError,
  PostNotFoundError,
  ProjectMemberNotFoundError,
  ProjectNotFoundError,
  ProjectPhotoNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import type { Clock } from '../ports/Clock.js';
import type {
  CollaborationRepository,
  MemberRole,
  MemberUpdateInput,
  PostCommentRow,
  PostReadRow,
  PostReadStats,
  PostRecipientRow,
  ProjectMemberRow,
  ProjectPhotoRow,
} from '../ports/CollaborationRepository.js';
import type { LocationRepository } from '../ports/LocationRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';

// ===== DTO ==================================================================

export interface ProjectMemberDto {
  id: number;
  projectId: number;
  userId: number;
  memberName: string;
  memberRole: string;
  title: string | null;
  note: string | null;
  active: boolean;
  createdAt: string;
}

function toMemberDto(m: ProjectMemberRow): ProjectMemberDto {
  return {
    id: m.id,
    projectId: m.projectId,
    userId: m.userId,
    memberName: m.memberName,
    memberRole: m.memberRole,
    title: m.title,
    note: m.note,
    active: m.active,
    createdAt: m.createdAt.toISOString(),
  };
}

export interface PostDto {
  id: number;
  projectId: number;
  title: string | null;
  body: string;
  pinned: boolean;
  active: boolean;
  createdBy: number | null;
  authorName: string;
  editedAt: string | null;
  createdAt: string;
  /** Hedef kitle (açık liste ya da aktif ekip). 0 iken readPct null. */
  recipientCount: number;
  targetReadCount: number;
  totalReadCount: number;
  commentCount: number;
  readPct: number | null;
  /** İstek sahibi okudu mu. */
  myRead: boolean;
}

function toPostDto(p: Post, stats: PostReadStats | undefined, myRead: boolean): PostDto {
  const j = p.toJSON();
  const s = stats ?? { recipientCount: 0, targetReadCount: 0, totalReadCount: 0, commentCount: 0 };
  return {
    id: j.id,
    projectId: j.projectId,
    title: j.title,
    body: j.body,
    pinned: j.pinned,
    active: j.active,
    createdBy: j.createdBy,
    authorName: j.authorName,
    editedAt: j.editedAt === null ? null : j.editedAt.toISOString(),
    createdAt: j.createdAt.toISOString(),
    recipientCount: s.recipientCount,
    targetReadCount: s.targetReadCount,
    totalReadCount: s.totalReadCount,
    commentCount: s.commentCount,
    readPct: s.recipientCount > 0 ? (s.targetReadCount * 100) / s.recipientCount : null,
    myRead,
  };
}

export interface PostCommentDto {
  id: number;
  postId: number;
  body: string;
  createdBy: number | null;
  authorName: string;
  createdAt: string;
}

function toCommentDto(c: PostCommentRow): PostCommentDto {
  return {
    id: c.id,
    postId: c.postId,
    body: c.body,
    createdBy: c.createdBy,
    authorName: c.authorName,
    createdAt: c.createdAt.toISOString(),
  };
}

export interface PostReadDto {
  userId: number;
  userName: string;
  readAt: string;
}

function toReadDto(r: PostReadRow): PostReadDto {
  return { userId: r.userId, userName: r.userName, readAt: r.readAt.toISOString() };
}

export interface ProjectPhotoDto {
  id: number;
  projectId: number;
  locationId: number | null;
  locationPath: string | null;
  title: string | null;
  takenAt: string | null;
  fileUrl: string | null;
  hasContent: boolean;
  mimeType: string | null;
  sizeBytes: number | null;
  authorName: string;
  createdAt: string;
}

function toPhotoDto(p: ProjectPhotoRow): ProjectPhotoDto {
  return {
    id: p.id,
    projectId: p.projectId,
    locationId: p.locationId,
    locationPath: p.locationPath,
    title: p.title,
    takenAt: p.takenAt,
    fileUrl: p.fileUrl,
    hasContent: p.hasContent,
    mimeType: p.mimeType,
    sizeBytes: p.sizeBytes,
    authorName: p.authorName,
    createdAt: p.createdAt.toISOString(),
  };
}

// ===== EKİP =================================================================

export class ListProjectMembersUseCase {
  constructor(private readonly repo: CollaborationRepository) {}

  async execute(input: {
    projectId: number;
    companyId: number;
    includeInactive?: boolean | undefined;
  }): Promise<ProjectMemberDto[]> {
    const rows = await this.repo.listMembers(
      input.projectId,
      input.companyId,
      input.includeInactive ?? false,
    );
    return rows.map(toMemberDto);
  }
}

export class AddProjectMemberUseCase {
  constructor(
    private readonly repo: CollaborationRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async execute(input: {
    companyId: number;
    projectId: number;
    userId: number;
    memberName: string;
    memberRole?: MemberRole | undefined;
    title?: string | null | undefined;
    note?: string | null | undefined;
    addedBy?: number | null | undefined;
  }): Promise<ProjectMemberDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    if (input.memberName.trim() === '') {
      throw new ConstructionValidationError('üye adı boş olamaz');
    }
    const existing = await this.repo.findMemberByUser(input.projectId, input.userId);
    if (existing !== null) {
      if (existing.active) throw new DuplicateProjectMemberError(input.userId);
      // Ayrılmış üye geri dönerse kayıt CANLANIR — ikinci satır açmak okuma
      // paydasını şişirir ve UNIQUE'e takılır.
      const revived = await this.repo.updateMember(existing.id, input.companyId, {
        active: true,
        memberName: input.memberName.trim(),
        ...(input.memberRole !== undefined ? { memberRole: input.memberRole } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      });
      return toMemberDto(revived);
    }
    const created = await this.repo.insertMember({
      companyId: input.companyId,
      projectId: input.projectId,
      userId: input.userId,
      memberName: input.memberName.trim(),
      memberRole: input.memberRole ?? 'other',
      title: input.title?.trim() || null,
      note: input.note?.trim() || null,
      addedBy: input.addedBy ?? null,
    });
    return toMemberDto(created);
  }
}

export class UpdateProjectMemberUseCase {
  constructor(private readonly repo: CollaborationRepository) {}

  async execute(
    input: { memberId: number; companyId: number } & MemberUpdateInput,
  ): Promise<ProjectMemberDto> {
    const member = await this.repo.findMemberById(input.memberId, input.companyId);
    if (!member) throw new ProjectMemberNotFoundError(input.memberId);
    if (input.memberName !== undefined && input.memberName.trim() === '') {
      throw new ConstructionValidationError('üye adı boş olamaz');
    }
    const { memberId: _i, companyId: _c, ...patch } = input;
    const updated = await this.repo.updateMember(
      input.memberId,
      input.companyId,
      Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    );
    return toMemberDto(updated);
  }
}

export class RemoveProjectMemberUseCase {
  constructor(private readonly repo: CollaborationRepository) {}

  /** Soft: geçmiş okuma/yorum izi durur; okuma paydasından düşer. */
  async execute(input: { memberId: number; companyId: number }): Promise<{ removed: boolean }> {
    const member = await this.repo.findMemberById(input.memberId, input.companyId);
    if (!member) throw new ProjectMemberNotFoundError(input.memberId);
    await this.repo.updateMember(input.memberId, input.companyId, { active: false });
    return { removed: true };
  }
}

// ===== GÖNDERİLER ===========================================================

export class ListPostsUseCase {
  constructor(private readonly repo: CollaborationRepository) {}

  async execute(input: {
    projectId: number;
    companyId: number;
    actorUserId: number | null;
    includeInactive?: boolean | undefined;
  }): Promise<PostDto[]> {
    const posts = await this.repo.listPosts(
      input.projectId,
      input.companyId,
      input.includeInactive ?? false,
    );
    const ids = posts.map((p) => p.id);
    const [stats, myReads] = await Promise.all([
      this.repo.readStatsFor(ids),
      input.actorUserId === null
        ? Promise.resolve(new Set<number>() as ReadonlySet<number>)
        : this.repo.readPostIdsFor(ids, input.actorUserId),
    ]);
    return posts.map((p) => toPostDto(p, stats.get(p.id), myReads.has(p.id)));
  }
}

export class CreatePostUseCase {
  constructor(
    private readonly repo: CollaborationRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async execute(input: {
    companyId: number;
    projectId: number;
    title?: string | null | undefined;
    body: string;
    pinned?: boolean | undefined;
    recipients?: ReadonlyArray<{ userId: number; userName?: string | undefined }> | undefined;
    createdBy: number | null;
    authorName: string;
  }): Promise<PostDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    if (input.body.trim() === '') {
      throw new ConstructionValidationError('gönderi metni boş olamaz');
    }
    const created = await this.repo.insertPost({
      companyId: input.companyId,
      projectId: input.projectId,
      title: input.title?.trim() || null,
      body: input.body.trim(),
      pinned: input.pinned ?? false,
      createdBy: input.createdBy,
      authorName: input.authorName,
      recipients: (input.recipients ?? []).map((r) => ({
        userId: r.userId,
        userName: r.userName ?? '',
      })),
    });
    const stats = await this.repo.readStatsFor([created.id]);
    return toPostDto(created, stats.get(created.id), false);
  }
}

export class UpdatePostUseCase {
  constructor(
    private readonly repo: CollaborationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: {
      postId: number;
      companyId: number;
      actorUserId: number | null;
      isAdmin: boolean;
    } & PostUpdate,
  ): Promise<PostDto> {
    const post = await this.repo.findPostById(input.postId, input.companyId);
    if (!post) throw new PostNotFoundError(input.postId);
    const { postId: _p, companyId: _c, actorUserId, isAdmin, ...patch } = input;
    const updated = await this.repo.updatePost(
      post.update(
        Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
        actorUserId,
        isAdmin,
        this.clock.now(),
      ),
    );
    const [stats, myRead] = await Promise.all([
      this.repo.readStatsFor([updated.id]),
      actorUserId === null ? Promise.resolve(false) : this.repo.hasRead(updated.id, actorUserId),
    ]);
    return toPostDto(updated, stats.get(updated.id), myRead);
  }
}

export class DeletePostUseCase {
  constructor(
    private readonly repo: CollaborationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    postId: number;
    companyId: number;
    actorUserId: number | null;
    isAdmin: boolean;
  }): Promise<{ deleted: boolean }> {
    const post = await this.repo.findPostById(input.postId, input.companyId);
    if (!post) throw new PostNotFoundError(input.postId);
    await this.repo.updatePost(post.deactivate(input.actorUserId, input.isAdmin, this.clock.now()));
    return { deleted: true };
  }
}

export class MarkPostReadUseCase {
  constructor(private readonly repo: CollaborationRepository) {}

  async execute(input: {
    postId: number;
    companyId: number;
    userId: number;
    userName: string;
  }): Promise<{ read: boolean }> {
    const post = await this.repo.findPostById(input.postId, input.companyId);
    if (!post) throw new PostNotFoundError(input.postId);
    await this.repo.markRead(input.postId, input.userId, input.userName);
    return { read: true };
  }
}

export interface PostDetailDto {
  post: PostDto;
  comments: PostCommentDto[];
  reads: PostReadDto[];
  recipients: PostRecipientRow[];
}

export class GetPostUseCase {
  constructor(private readonly repo: CollaborationRepository) {}

  async execute(input: {
    postId: number;
    companyId: number;
    actorUserId: number | null;
  }): Promise<PostDetailDto> {
    const post = await this.repo.findPostById(input.postId, input.companyId);
    if (!post) throw new PostNotFoundError(input.postId);
    const [stats, comments, reads, recipients, myRead] = await Promise.all([
      this.repo.readStatsFor([post.id]),
      this.repo.listComments(post.id),
      this.repo.listReads(post.id),
      this.repo.listRecipients(post.id),
      input.actorUserId === null
        ? Promise.resolve(false)
        : this.repo.hasRead(post.id, input.actorUserId),
    ]);
    return {
      post: toPostDto(post, stats.get(post.id), myRead),
      comments: comments.map(toCommentDto),
      reads: reads.map(toReadDto),
      recipients: [...recipients],
    };
  }
}

export class AddPostCommentUseCase {
  constructor(private readonly repo: CollaborationRepository) {}

  async execute(input: {
    postId: number;
    companyId: number;
    body: string;
    createdBy: number | null;
    authorName: string;
  }): Promise<PostCommentDto> {
    const post = await this.repo.findPostById(input.postId, input.companyId);
    if (!post) throw new PostNotFoundError(input.postId);
    if (!post.active) {
      throw new ConstructionValidationError('silinmiş gönderiye yorum yapılamaz');
    }
    if (input.body.trim() === '') {
      throw new ConstructionValidationError('yorum boş olamaz');
    }
    const row = await this.repo.insertComment({
      companyId: input.companyId,
      postId: input.postId,
      body: input.body.trim(),
      createdBy: input.createdBy,
      authorName: input.authorName,
    });
    return toCommentDto(row);
  }
}

// ===== GALERİ ===============================================================

export class ListProjectPhotosUseCase {
  constructor(private readonly repo: CollaborationRepository) {}

  async execute(input: { projectId: number; companyId: number }): Promise<ProjectPhotoDto[]> {
    const rows = await this.repo.listPhotos(input.projectId, input.companyId);
    return rows.map(toPhotoDto);
  }
}

export class AddProjectPhotoUseCase {
  constructor(
    private readonly repo: CollaborationRepository,
    private readonly projects: ProjectRepository,
    private readonly locations: LocationRepository,
  ) {}

  async execute(input: {
    companyId: number;
    projectId: number;
    locationId?: number | null | undefined;
    title?: string | null | undefined;
    takenAt?: string | null | undefined;
    fileUrl?: string | null | undefined;
    content?: Buffer | null | undefined;
    mimeType?: string | null | undefined;
    createdBy: number | null;
    authorName: string;
  }): Promise<ProjectPhotoDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    if ((input.fileUrl ?? null) === null && (input.content ?? null) === null) {
      throw new ConstructionValidationError('fotoğraf için URL ya da içerik gerekli');
    }
    if (input.locationId !== undefined && input.locationId !== null) {
      const loc = await this.locations.findById(input.locationId, input.companyId);
      if (loc === null || loc.projectId !== input.projectId) {
        throw new LocationNotFoundError(input.locationId);
      }
    }
    const row = await this.repo.insertPhoto({
      companyId: input.companyId,
      projectId: input.projectId,
      locationId: input.locationId ?? null,
      title: input.title?.trim() || null,
      takenAt: input.takenAt ?? null,
      fileUrl: input.fileUrl ?? null,
      content: input.content ?? null,
      mimeType: input.mimeType ?? null,
      sizeBytes:
        input.content === null || input.content === undefined ? null : input.content.length,
      createdBy: input.createdBy,
      authorName: input.authorName,
    });
    return toPhotoDto(row);
  }
}

export class GetPhotoContentUseCase {
  constructor(private readonly repo: CollaborationRepository) {}

  async execute(input: {
    photoId: number;
    companyId: number;
  }): Promise<{ content: Buffer; mimeType: string | null }> {
    const res = await this.repo.getPhotoContent(input.photoId, input.companyId);
    if (res === null) throw new ProjectPhotoNotFoundError(input.photoId);
    return res;
  }
}

export class DeleteProjectPhotoUseCase {
  constructor(private readonly repo: CollaborationRepository) {}

  async execute(input: { photoId: number; companyId: number }): Promise<{ deleted: boolean }> {
    const ok = await this.repo.deactivatePhoto(input.photoId, input.companyId);
    if (!ok) throw new ProjectPhotoNotFoundError(input.photoId);
    return { deleted: true };
  }
}
