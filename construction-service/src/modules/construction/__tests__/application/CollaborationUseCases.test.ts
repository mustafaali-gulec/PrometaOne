/**
 * FAZ 11 — İşbirliği testleri.
 *
 * Ağırlık: Post sahipliği (yalnız yazar/admin), düzenleme izi (edited_at
 * yalnız İÇERİK değişince), soft delete, okuma idempotensi (ilk an korunur),
 * ayrılan üyenin geri dönüşte CANLANMASI (ikinci satır açılmaz — payda
 * şişmez). Okuma oranı matematiği (payda kuralı) SQL görünümünde — smoke'ta
 * canlı sınanır.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type {
  CollaborationRepository,
  MemberUpdateInput,
  NewMemberInput,
  ProjectMemberRow,
} from '../../application/ports/CollaborationRepository.js';
import type { ProjectRepository } from '../../application/ports/ProjectRepository.js';
import {
  AddPostCommentUseCase,
  AddProjectMemberUseCase,
  MarkPostReadUseCase,
} from '../../application/useCases/CollaborationUseCases.js';
import { Post, type PostProps } from '../../domain/entities/Post.js';
import {
  ConstructionValidationError,
  DuplicateProjectMemberError,
  NotPostAuthorError,
  PostNotEditableError,
} from '../../domain/errors/ConstructionErrors.js';

const NOW = new Date('2026-07-30T10:00:00.000Z');
const LATER = new Date('2026-07-30T12:00:00.000Z');

function post(over: Partial<PostProps> = {}): Post {
  return Post.create({
    id: 1,
    companyId: 1,
    projectId: 5,
    title: 'Beton dökümü',
    body: 'Yarın 08:00 A blok temel dökümü. Vibratör ekibi hazır olsun.',
    pinned: false,
    active: true,
    createdBy: 7,
    authorName: 'saha.sefi',
    editedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  });
}

describe('Post — sahiplik ve düzenleme izi', () => {
  it('yazar düzenler; İÇERİK değişince edited_at damgalanır', () => {
    const p = post().update({ body: 'Döküm 09:00’a alındı.' }, 7, false, LATER);
    assert.equal(p.toJSON().editedAt, LATER);
  });

  it('yalnız pin/unpin İZ BIRAKMAZ — sabitlemek metni değiştirmez', () => {
    const p = post().update({ pinned: true }, 7, false, LATER);
    assert.equal(p.toJSON().pinned, true);
    assert.equal(p.toJSON().editedAt, null);
  });

  it('yazar olmayan düzenleyemez/silemez; admin her ikisini de yapar', () => {
    assert.throws(() => post().update({ body: 'x' }, 99, false, LATER), NotPostAuthorError);
    assert.throws(() => post().deactivate(99, false, LATER), NotPostAuthorError);
    assert.equal(post().update({ body: 'x' }, 99, true, LATER).toJSON().body, 'x');
    assert.equal(post().deactivate(99, true, LATER).active, false);
  });

  it('silme SOFT ve sabitlemeyi düşürür; silinmiş gönderi düzenlenemez', () => {
    const dead = post({ pinned: true }).deactivate(7, false, LATER);
    assert.equal(dead.active, false);
    assert.equal(dead.toJSON().pinned, false);
    assert.throws(() => dead.update({ body: 'y' }, 7, false, LATER), PostNotEditableError);
  });

  it('boş gövde reddedilir', () => {
    assert.throws(() => post({ body: '   ' }), ConstructionValidationError);
    assert.throws(() => post().update({ body: ' ' }, 7, false, LATER), ConstructionValidationError);
  });
});

// ===== FAKES ================================================================

class FakeCollabRepo {
  members = new Map<number, ProjectMemberRow>();
  posts = new Map<number, Post>();
  reads = new Map<string, Date>();
  comments: { postId: number; body: string }[] = [];
  private seq = 100;

  listMembers(): Promise<ProjectMemberRow[]> {
    return Promise.resolve([...this.members.values()]);
  }
  findMemberById(id: number): Promise<ProjectMemberRow | null> {
    return Promise.resolve(this.members.get(id) ?? null);
  }
  findMemberByUser(projectId: number, userId: number): Promise<ProjectMemberRow | null> {
    for (const m of this.members.values()) {
      if (m.projectId === projectId && m.userId === userId) return Promise.resolve(m);
    }
    return Promise.resolve(null);
  }
  insertMember(input: NewMemberInput): Promise<ProjectMemberRow> {
    const row: ProjectMemberRow = {
      id: this.seq++,
      companyId: input.companyId,
      projectId: input.projectId,
      userId: input.userId,
      memberName: input.memberName,
      memberRole: input.memberRole,
      title: input.title,
      note: input.note,
      active: true,
      addedBy: input.addedBy,
      createdAt: NOW,
    };
    this.members.set(row.id, row);
    return Promise.resolve(row);
  }
  updateMember(id: number, _c: number, patch: MemberUpdateInput): Promise<ProjectMemberRow> {
    const cur = this.members.get(id)!;
    const next = {
      ...cur,
      ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    };
    this.members.set(id, next);
    return Promise.resolve(next);
  }
  findPostById(id: number): Promise<Post | null> {
    return Promise.resolve(this.posts.get(id) ?? null);
  }
  markRead(postId: number, userId: number): Promise<void> {
    const key = `${String(postId)}:${String(userId)}`;
    // İLK okuma anı korunur — conflict'te üzerine yazılmaz.
    if (!this.reads.has(key)) this.reads.set(key, new Date());
    return Promise.resolve();
  }
  insertComment(input: { postId: number; body: string }): Promise<{
    id: number;
    postId: number;
    body: string;
    createdBy: number | null;
    authorName: string;
    createdAt: Date;
  }> {
    this.comments.push({ postId: input.postId, body: input.body });
    return Promise.resolve({
      id: this.seq++,
      postId: input.postId,
      body: input.body,
      createdBy: 7,
      authorName: 'x',
      createdAt: NOW,
    });
  }
}

const fakeProjects = {
  findById: (id: number) => Promise.resolve(id === 5 ? ({ id: 5 } as never) : null),
} as unknown as ProjectRepository;

describe('AddProjectMemberUseCase — geri dönen üye canlanır', () => {
  let repo: FakeCollabRepo;
  let add: AddProjectMemberUseCase;

  beforeEach(() => {
    repo = new FakeCollabRepo();
    add = new AddProjectMemberUseCase(repo as unknown as CollaborationRepository, fakeProjects);
  });

  it('aktif üye ikinci kez eklenemez (409 sınıfı)', async () => {
    await add.execute({ companyId: 1, projectId: 5, userId: 9, memberName: 'Ali Usta' });
    await assert.rejects(
      add.execute({ companyId: 1, projectId: 5, userId: 9, memberName: 'Ali Usta' }),
      DuplicateProjectMemberError,
    );
  });

  it('ayrılan üye geri eklenince AYNI kayıt canlanır — payda şişmez', async () => {
    const m = await add.execute({ companyId: 1, projectId: 5, userId: 9, memberName: 'Ali Usta' });
    await repo.updateMember(m.id, 1, { active: false });
    const back = await add.execute({
      companyId: 1,
      projectId: 5,
      userId: 9,
      memberName: 'Ali Usta (döndü)',
      memberRole: 'foreman',
    });
    assert.equal(back.id, m.id);
    assert.equal(back.active, true);
    assert.equal(back.memberName, 'Ali Usta (döndü)');
    assert.equal(repo.members.size, 1);
  });
});

describe('MarkPostReadUseCase — ilk okuma anı korunur', () => {
  it('iki kez okundu işareti tek kayıt bırakır; ilk zaman değişmez', async () => {
    const repo = new FakeCollabRepo();
    repo.posts.set(1, post());
    const mark = new MarkPostReadUseCase(repo as unknown as CollaborationRepository);
    await mark.execute({ postId: 1, companyId: 1, userId: 9, userName: 'ali' });
    const first = repo.reads.get('1:9');
    await mark.execute({ postId: 1, companyId: 1, userId: 9, userName: 'ali' });
    assert.equal(repo.reads.size, 1);
    assert.equal(repo.reads.get('1:9'), first);
  });
});

describe('AddPostCommentUseCase', () => {
  it('silinmiş gönderiye yorum yapılamaz', async () => {
    const repo = new FakeCollabRepo();
    repo.posts.set(1, post().deactivate(7, false, LATER));
    const uc = new AddPostCommentUseCase(repo as unknown as CollaborationRepository);
    await assert.rejects(
      uc.execute({ postId: 1, companyId: 1, body: 'geç oldu', createdBy: 9, authorName: 'a' }),
      ConstructionValidationError,
    );
  });
});
