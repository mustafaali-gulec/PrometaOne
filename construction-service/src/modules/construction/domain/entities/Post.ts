/**
 * Post — proje duvarı gönderisi (FAZ 11).
 * Tablo: cs_posts (016_collaboration.sql)
 *
 * SAHİPLİK: gönderiyi yalnız YAZARI ya da admin düzenler/siler. Duvar herkese
 * açık bir pano; başkasının duyurusunu sessizce değiştirmek okuyanların
 * gördüğünü geçersiz kılar.
 *
 * DÜZENLEME İZİ: body/title değişince edited_at damgalanır — okunmuş bir
 * duyurunun sonradan değiştiği gizlenmez (okunma kaydı İLK metne aittir).
 *
 * SİLME SOFT: okunmuş duyuruyu yok etmek "kimse görmedi" iddiasına kapı açar;
 * pasif gönderi listede görünmez ama izi durur.
 */
import {
  ConstructionValidationError,
  NotPostAuthorError,
  PostNotEditableError,
} from '../errors/ConstructionErrors.js';

export interface PostProps {
  id: number;
  companyId: number;
  projectId: number;
  title: string | null;
  body: string;
  pinned: boolean;
  active: boolean;
  createdBy: number | null;
  authorName: string;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostUpdate {
  title?: string | null | undefined;
  body?: string | undefined;
  pinned?: boolean | undefined;
}

function assertCanModify(props: PostProps, actorUserId: number | null, isAdmin: boolean): void {
  if (isAdmin) return;
  if (actorUserId === null || props.createdBy === null || props.createdBy !== actorUserId) {
    throw new NotPostAuthorError();
  }
}

export class Post {
  private constructor(private readonly props: Readonly<PostProps>) {}

  static create(props: PostProps): Post {
    if (props.body.trim() === '') {
      throw new ConstructionValidationError('gönderi metni boş olamaz');
    }
    return new Post(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get projectId(): number {
    return this.props.projectId;
  }
  get active(): boolean {
    return this.props.active;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }

  update(patch: PostUpdate, actorUserId: number | null, isAdmin: boolean, now: Date): Post {
    assertCanModify(this.props, actorUserId, isAdmin);
    if (!this.props.active) throw new PostNotEditableError();
    if (patch.body !== undefined && patch.body.trim() === '') {
      throw new ConstructionValidationError('gönderi metni boş olamaz');
    }
    const contentChanged =
      (patch.body !== undefined && patch.body !== this.props.body) ||
      (patch.title !== undefined && patch.title !== this.props.title);
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    ) as Partial<PostProps>;
    return new Post({
      ...this.props,
      ...clean,
      // İçerik değiştiyse düzenleme izi düşer; yalnız pin/unpin iz bırakmaz
      // (sabitlemek metni değiştirmez).
      editedAt: contentChanged ? now : this.props.editedAt,
      updatedAt: now,
    });
  }

  deactivate(actorUserId: number | null, isAdmin: boolean, now: Date): Post {
    assertCanModify(this.props, actorUserId, isAdmin);
    return new Post({ ...this.props, active: false, pinned: false, updatedAt: now });
  }

  toJSON(): PostProps {
    return { ...this.props };
  }
}
