/**
 * LinkedIn use-case testleri için bellek-içi sahte adaptörler.
 * Pg repo'larının sözleşmesini (upsert semantiği dâhil) taklit ederler.
 */
import type { EncryptedCredential } from '../../application/ports/CredentialCipher.js';
import type { CredentialCipher } from '../../application/ports/CredentialCipher.js';
import type {
  JobPostingFeedRepository,
  LinkedInConnectionRepository,
  LinkedInPostRepository,
  RecordPostInput,
  SaveConnectionInput,
  UpsertSnapshotInput,
} from '../../application/ports/LinkedInRepositories.js';
import { JobPostingSnapshot } from '../../domain/entities/JobPostingSnapshot.js';
import {
  LinkedInConnection,
  type LinkedInConnectionProps,
  type LinkedInCredentialConfig,
} from '../../domain/entities/LinkedInConnection.js';
import { LinkedInJobPost } from '../../domain/entities/LinkedInJobPost.js';
import type { LinkedInChannel } from '../../domain/valueObjects/LinkedInChannel.js';

/** Şifrelemeyi JSON'a indirger — testte anahtar yönetimi ilgisiz. */
export class FakeCipher implements CredentialCipher {
  encrypt(config: LinkedInCredentialConfig): EncryptedCredential {
    return {
      ciphertext: Buffer.from(JSON.stringify(config), 'utf-8'),
      iv: Buffer.alloc(12),
      tag: Buffer.alloc(16),
    };
  }
  decrypt(blob: EncryptedCredential): LinkedInCredentialConfig {
    return JSON.parse(blob.ciphertext.toString('utf-8')) as LinkedInCredentialConfig;
  }
}

export function connectionProps(
  over: Partial<LinkedInConnectionProps> = {},
): LinkedInConnectionProps {
  return {
    id: 1,
    companyId: 7,
    organizationUrn: 'urn:li:organization:123',
    organizationName: 'Promet',
    tokenExpiresAt: new Date('2099-01-01T00:00:00.000Z'),
    autoPublish: true,
    channels: ['share'],
    feedToken: 'feed-token',
    careerSiteBaseUrl: 'https://kariyer.promet.com/ilan',
    isActive: true,
    lastError: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  };
}

export class FakeConnectionRepository implements LinkedInConnectionRepository {
  readonly cipher = new FakeCipher();
  private connection: LinkedInConnection | null;
  private config: LinkedInCredentialConfig;
  readonly errors: (string | null)[] = [];

  constructor(
    props: LinkedInConnectionProps | null = connectionProps(),
    config: LinkedInCredentialConfig = {
      clientId: 'cid',
      clientSecret: 'secret',
      accessToken: 'token',
      refreshToken: 'refresh',
    },
  ) {
    this.connection = props === null ? null : LinkedInConnection.create(props);
    this.config = config;
  }

  findByCompany(companyId: number): Promise<LinkedInConnection | null> {
    return Promise.resolve(
      this.connection !== null && this.connection.companyId === companyId ? this.connection : null,
    );
  }

  findByCompanyWithSecret(
    companyId: number,
  ): Promise<{ connection: LinkedInConnection; encrypted: EncryptedCredential } | null> {
    if (this.connection === null || this.connection.companyId !== companyId) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      connection: this.connection,
      encrypted: this.cipher.encrypt(this.config),
    });
  }

  findByFeedToken(
    feedToken: string,
  ): Promise<{ connection: LinkedInConnection; companyId: number } | null> {
    if (this.connection === null || this.connection.feedToken !== feedToken) {
      return Promise.resolve(null);
    }
    return Promise.resolve({ connection: this.connection, companyId: this.connection.companyId });
  }

  upsert(input: SaveConnectionInput): Promise<LinkedInConnection> {
    this.config = this.cipher.decrypt(input.encrypted);
    this.connection = LinkedInConnection.create(
      connectionProps({
        companyId: input.companyId,
        organizationUrn: input.organizationUrn,
        organizationName: input.organizationName,
        tokenExpiresAt: input.tokenExpiresAt,
        autoPublish: input.autoPublish,
        channels: input.channels,
        feedToken: input.feedToken,
        careerSiteBaseUrl: input.careerSiteBaseUrl,
        isActive: input.isActive,
      }),
    );
    return Promise.resolve(this.connection);
  }

  updateSecret(
    _companyId: number,
    encrypted: EncryptedCredential,
    _tokenExpiresAt: Date | null,
  ): Promise<void> {
    this.config = this.cipher.decrypt(encrypted);
    return Promise.resolve();
  }

  recordError(_companyId: number, message: string | null): Promise<void> {
    this.errors.push(message);
    return Promise.resolve();
  }

  delete(_companyId: number): Promise<void> {
    this.connection = null;
    return Promise.resolve();
  }

  currentConfig(): LinkedInCredentialConfig {
    return this.config;
  }
}

export class FakeFeedRepository implements JobPostingFeedRepository {
  readonly rows = new Map<string, JobPostingSnapshot>();

  private key(companyId: number, ref: string): string {
    return `${String(companyId)}::${ref}`;
  }

  upsert(input: UpsertSnapshotInput): Promise<JobPostingSnapshot> {
    const prev = this.rows.get(this.key(input.companyId, input.postingRef));
    const snap = JobPostingSnapshot.create({
      id: prev?.id ?? this.rows.size + 1,
      companyId: input.companyId,
      postingRef: input.postingRef,
      slug: input.slug,
      title: input.title,
      description: input.description,
      location: input.location,
      employmentType: input.employmentType,
      companyName: input.companyName,
      applyUrl: input.applyUrl,
      status: 'published',
      publishedAt: prev?.publishedAt ?? input.publishedAt,
      closedAt: null,
    });
    this.rows.set(this.key(input.companyId, input.postingRef), snap);
    return Promise.resolve(snap);
  }

  findByRef(companyId: number, postingRef: string): Promise<JobPostingSnapshot | null> {
    return Promise.resolve(this.rows.get(this.key(companyId, postingRef)) ?? null);
  }

  listPublished(companyId: number): Promise<JobPostingSnapshot[]> {
    return Promise.resolve(
      [...this.rows.values()].filter((s) => s.companyId === companyId && s.status === 'published'),
    );
  }

  close(companyId: number, postingRef: string, now: Date): Promise<void> {
    const key = this.key(companyId, postingRef);
    const prev = this.rows.get(key);
    if (prev !== undefined) this.rows.set(key, prev.close(now));
    return Promise.resolve();
  }
}

export class FakePostRepository implements LinkedInPostRepository {
  readonly rows = new Map<string, LinkedInJobPost>();

  private key(companyId: number, ref: string, channel: LinkedInChannel): string {
    return `${String(companyId)}::${ref}::${channel}`;
  }

  record(input: RecordPostInput): Promise<LinkedInJobPost> {
    const post = LinkedInJobPost.create({
      id: this.rows.size + 1,
      companyId: input.companyId,
      postingRef: input.postingRef,
      channel: input.channel,
      status: input.status,
      postUrn: input.postUrn,
      postUrl: input.postUrl,
      title: input.title,
      errorMessage: input.errorMessage,
      createdAt: new Date('2026-08-08T00:00:00.000Z'),
      updatedAt: new Date('2026-08-08T00:00:00.000Z'),
    });
    this.rows.set(this.key(input.companyId, input.postingRef, input.channel), post);
    return Promise.resolve(post);
  }

  listByPosting(companyId: number, postingRef: string): Promise<LinkedInJobPost[]> {
    return Promise.resolve(
      [...this.rows.values()].filter(
        (p) => p.companyId === companyId && p.postingRef === postingRef,
      ),
    );
  }

  listByCompany(companyId: number, limit: number): Promise<LinkedInJobPost[]> {
    return Promise.resolve(
      [...this.rows.values()].filter((p) => p.companyId === companyId).slice(0, limit),
    );
  }

  findOne(
    companyId: number,
    postingRef: string,
    channel: LinkedInChannel,
  ): Promise<LinkedInJobPost | null> {
    return Promise.resolve(this.rows.get(this.key(companyId, postingRef, channel)) ?? null);
  }
}

export const fixedClock = (iso = '2026-08-08T10:00:00.000Z') => ({ now: () => new Date(iso) });
