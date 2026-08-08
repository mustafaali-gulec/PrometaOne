/**
 * LinkedIn entegrasyonunun persistence portları.
 *
 * Tüm sorgular companyId ile sınırlıdır (çapraz-tenant sızıntı koruması);
 * public feed ucunda companyId `feed_token` üzerinden çözülür.
 */
import type { JobPostingSnapshot } from '../../domain/entities/JobPostingSnapshot.js';
import type {
  LinkedInConnection,
  LinkedInCredentialConfig,
} from '../../domain/entities/LinkedInConnection.js';
import type { LinkedInJobPost } from '../../domain/entities/LinkedInJobPost.js';
import type { LinkedInChannel } from '../../domain/valueObjects/LinkedInChannel.js';
import type { LinkedInPostStatus } from '../../domain/valueObjects/LinkedInPostStatus.js';

import type { EncryptedCredential } from './CredentialCipher.js';

// --- Bağlantı --------------------------------------------------------------
export interface SaveConnectionInput {
  companyId: number;
  encrypted: EncryptedCredential;
  organizationUrn: string | null;
  organizationName: string | null;
  tokenExpiresAt: Date | null;
  autoPublish: boolean;
  channels: LinkedInChannel[];
  feedToken: string | null;
  careerSiteBaseUrl: string | null;
  isActive: boolean;
  createdBy: number | null;
}

export interface LinkedInConnectionRepository {
  findByCompany(companyId: number): Promise<LinkedInConnection | null>;
  /** Şifreli config'i de birlikte döner (provider çağrıları için). */
  findByCompanyWithSecret(
    companyId: number,
  ): Promise<{ connection: LinkedInConnection; encrypted: EncryptedCredential } | null>;
  /** Public feed ucu için — jetondan şirkete. */
  findByFeedToken(
    feedToken: string,
  ): Promise<{ connection: LinkedInConnection; companyId: number } | null>;
  upsert(input: SaveConnectionInput): Promise<LinkedInConnection>;
  /** Token yenilendiğinde yalnızca sır + son kullanma tarihini günceller. */
  updateSecret(
    companyId: number,
    encrypted: EncryptedCredential,
    tokenExpiresAt: Date | null,
  ): Promise<void>;
  recordError(companyId: number, message: string | null): Promise<void>;
  delete(companyId: number): Promise<void>;
}

// --- İlan anlık görüntüsü (public feed kaynağı) ----------------------------
export interface UpsertSnapshotInput {
  companyId: number;
  postingRef: string;
  slug: string | null;
  title: string;
  description: string;
  location: string | null;
  employmentType: string | null;
  companyName: string | null;
  applyUrl: string | null;
  publishedAt: Date;
}

export interface JobPostingFeedRepository {
  upsert(input: UpsertSnapshotInput): Promise<JobPostingSnapshot>;
  findByRef(companyId: number, postingRef: string): Promise<JobPostingSnapshot | null>;
  listPublished(companyId: number): Promise<JobPostingSnapshot[]>;
  close(companyId: number, postingRef: string, now: Date): Promise<void>;
}

// --- Gönderim kaydı --------------------------------------------------------
export interface RecordPostInput {
  companyId: number;
  postingRef: string;
  channel: LinkedInChannel;
  status: LinkedInPostStatus;
  postUrn: string | null;
  postUrl: string | null;
  title: string | null;
  errorMessage: string | null;
  createdBy: number | null;
}

export interface LinkedInPostRepository {
  /** (companyId, postingRef, channel) üzerinde upsert eder. */
  record(input: RecordPostInput): Promise<LinkedInJobPost>;
  listByPosting(companyId: number, postingRef: string): Promise<LinkedInJobPost[]>;
  listByCompany(companyId: number, limit: number): Promise<LinkedInJobPost[]>;
  findOne(
    companyId: number,
    postingRef: string,
    channel: LinkedInChannel,
  ): Promise<LinkedInJobPost | null>;
}

/** Şifreli config'i çözmek isteyen use-case'ler için kolaylık tipi. */
export interface ConnectionWithConfig {
  connection: LinkedInConnection;
  config: LinkedInCredentialConfig;
}
