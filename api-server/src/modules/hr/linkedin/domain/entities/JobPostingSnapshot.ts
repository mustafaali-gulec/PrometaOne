/**
 * JobPostingSnapshot — yayınlanan ilanın sunucu tarafı kopyası.
 *
 * İlanlar app-state blob'unda (hrJobPostings) yaşar. Public XML beslemesinin
 * auth olmadan okuyabilmesi ve share metninin sunucuda kurulabilmesi için
 * "Yayınla" anında bu snapshot yazılır. Blob hâlâ tek doğruluk kaynağıdır;
 * snapshot yalnızca dışa açılan yüzeyi besler.
 */

export interface JobPostingSnapshotProps {
  id: number | null;
  companyId: number;
  /** Blob'daki hrJobPostings[].id — dış kimlik. */
  postingRef: string;
  slug: string | null;
  title: string;
  description: string;
  location: string | null;
  employmentType: string | null;
  companyName: string | null;
  applyUrl: string | null;
  status: 'published' | 'closed';
  publishedAt: Date | null;
  closedAt: Date | null;
}

export class JobPostingSnapshot {
  private constructor(private readonly props: JobPostingSnapshotProps) {}

  static create(props: JobPostingSnapshotProps): JobPostingSnapshot {
    return new JobPostingSnapshot(props);
  }

  get id(): number | null {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get postingRef(): string {
    return this.props.postingRef;
  }
  get slug(): string | null {
    return this.props.slug;
  }
  get title(): string {
    return this.props.title;
  }
  get description(): string {
    return this.props.description;
  }
  get location(): string | null {
    return this.props.location;
  }
  get employmentType(): string | null {
    return this.props.employmentType;
  }
  get companyName(): string | null {
    return this.props.companyName;
  }
  get applyUrl(): string | null {
    return this.props.applyUrl;
  }
  get status(): 'published' | 'closed' {
    return this.props.status;
  }
  get publishedAt(): Date | null {
    return this.props.publishedAt;
  }

  close(now: Date): JobPostingSnapshot {
    return new JobPostingSnapshot({ ...this.props, status: 'closed', closedAt: now });
  }

  toJSON(): Omit<JobPostingSnapshotProps, 'publishedAt' | 'closedAt'> & {
    publishedAt: string | null;
    closedAt: string | null;
  } {
    return {
      ...this.props,
      publishedAt: this.props.publishedAt ? this.props.publishedAt.toISOString() : null,
      closedAt: this.props.closedAt ? this.props.closedAt.toISOString() : null,
    };
  }
}
