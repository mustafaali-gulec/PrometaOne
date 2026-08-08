/**
 * PublishJobPostingUseCase — "Yayınla" denen ilanı LinkedIn'e gönderir.
 *
 * Kanal başına BAĞIMSIZ çalışır: `feed` başarılı olurken `share` hata alabilir.
 * Bu yüzden tek bir kanal hatası use-case'i patlatmaz — her kanalın sonucu
 * kaydedilir ve döndürülür. İlanın kendisi blob'da zaten kaydedilmiştir;
 * LinkedIn gönderimi ilan kaydını GERİ ALMAZ.
 *
 * Sert hatalar (bağlantı yok / yetkilendirilmemiş) yine fırlatılır — çünkü
 * bunlar kanal değil kurulum sorunudur ve kullanıcıya farklı bir yol gösterir.
 */
import type { Clock } from '../../../application/ports/Clock.js';
import type { JobPostingSnapshot } from '../../domain/entities/JobPostingSnapshot.js';
import type { LinkedInConnection } from '../../domain/entities/LinkedInConnection.js';
import { JobPostingNotPublishableError } from '../../domain/errors/LinkedInErrors.js';
import {
  buildShareCommentary,
  isShareLang,
  type ShareLang,
} from '../../domain/services/JobShareTextBuilder.js';
import type { LinkedInChannel } from '../../domain/valueObjects/LinkedInChannel.js';
import type { LinkedInPostStatus } from '../../domain/valueObjects/LinkedInPostStatus.js';
import type { LinkedInProvider } from '../ports/LinkedInProvider.js';
import type {
  JobPostingFeedRepository,
  LinkedInPostRepository,
} from '../ports/LinkedInRepositories.js';
import type { LinkedInAccess } from '../services/LinkedInAccess.js';

export interface PublishJobPostingInput {
  companyId: number;
  /** Blob'daki hrJobPostings[].id. */
  postingRef: string;
  title: string;
  description: string;
  slug?: string | null | undefined;
  location?: string | null | undefined;
  employmentType?: string | null | undefined;
  companyName?: string | null | undefined;
  /** Verilmezse kariyer sitesi tabanı + slug'dan kurulur. */
  applyUrl?: string | null | undefined;
  /** Gönderi metninin dili. */
  lang?: string | undefined;
  /** Verilmezse bağlantının etkin kanalları kullanılır. */
  channels?: LinkedInChannel[] | undefined;
  /**
   * 'auto'  → ilan yayınlanınca otomatik tetiklendi; bağlantıda otomatik
   *           yayın kapalıysa hiçbir şey yapılmaz.
   * 'manual'→ kullanıcı "LinkedIn'e gönder" dedi; otomatik ayarı yok sayılır.
   */
  trigger?: 'auto' | 'manual' | undefined;
  actorId: number | null;
}

export interface ChannelResult {
  channel: LinkedInChannel;
  status: LinkedInPostStatus | 'skipped';
  postUrn: string | null;
  postUrl: string | null;
  error: string | null;
}

export interface PublishJobPostingResult {
  postingRef: string;
  results: ChannelResult[];
  applyUrl: string | null;
  /** Hiçbir kanal denenmediyse nedeni (otomatik yayın kapalı vb.). */
  skippedReason: string | null;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export class PublishJobPostingUseCase {
  constructor(
    private readonly access: LinkedInAccess,
    private readonly provider: LinkedInProvider,
    private readonly feed: JobPostingFeedRepository,
    private readonly posts: LinkedInPostRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: PublishJobPostingInput): Promise<PublishJobPostingResult> {
    if (input.title.trim() === '') {
      throw new JobPostingNotPublishableError('ilan başlığı boş');
    }

    const loaded = await this.access.load(input.companyId);
    const connection = loaded.connection;
    const now = this.clock.now();
    const trigger = input.trigger ?? 'auto';

    if (!connection.isActive) {
      return this.skip(input.postingRef, 'LinkedIn entegrasyonu kapalı', null);
    }
    if (trigger === 'auto' && !connection.autoPublish) {
      return this.skip(input.postingRef, 'Otomatik LinkedIn yayını kapalı', null);
    }

    const channels = input.channels ?? connection.channels;
    // Token tazeliği yalnızca şirket sayfasına yazan kanal için gerekli; sadece
    // `feed` seçiliyse yetkilendirme olmadan da çalışır.
    const config = channels.includes('share')
      ? (await this.access.ensureAuthorized(input.companyId, connection, loaded.config)).config
      : loaded.config;

    const applyUrl = this.resolveApplyUrl(input, connection);
    const snapshot = await this.feed.upsert({
      companyId: input.companyId,
      postingRef: input.postingRef,
      slug: input.slug ?? null,
      title: input.title,
      description: input.description,
      location: input.location ?? null,
      employmentType: input.employmentType ?? null,
      companyName: input.companyName ?? connection.organizationName,
      applyUrl,
      publishedAt: now,
    });

    const results: ChannelResult[] = [];
    for (const channel of channels) {
      results.push(await this.runChannel(channel, input, snapshot, config, connection));
    }

    return { postingRef: input.postingRef, results, applyUrl, skippedReason: null };
  }

  private skip(
    postingRef: string,
    reason: string,
    applyUrl: string | null,
  ): PublishJobPostingResult {
    return { postingRef, results: [], applyUrl, skippedReason: reason };
  }

  private resolveApplyUrl(
    input: PublishJobPostingInput,
    connection: LinkedInConnection,
  ): string | null {
    if (input.applyUrl !== undefined && input.applyUrl !== null && input.applyUrl !== '') {
      return input.applyUrl;
    }
    const base = connection.careerSiteBaseUrl;
    if (base === null || base === '') return null;
    const slug = input.slug ?? input.postingRef;
    return joinUrl(base, slug);
  }

  private async runChannel(
    channel: LinkedInChannel,
    input: PublishJobPostingInput,
    snapshot: JobPostingSnapshot,
    config: Parameters<LinkedInProvider['createShare']>[0]['config'],
    connection: LinkedInConnection,
  ): Promise<ChannelResult> {
    try {
      if (channel === 'feed') {
        // Snapshot zaten yazıldı — besleme onu bir sonraki LinkedIn taramasında
        // yayınlar. Bizim tarafta gönderilecek başka bir şey yok.
        await this.posts.record({
          companyId: input.companyId,
          postingRef: input.postingRef,
          channel,
          status: 'published',
          postUrn: null,
          postUrl: snapshot.applyUrl,
          title: input.title,
          errorMessage: null,
          createdBy: input.actorId,
        });
        return {
          channel,
          status: 'published',
          postUrn: null,
          postUrl: snapshot.applyUrl,
          error: null,
        };
      }

      if (channel === 'job_api') {
        // Partner onayı olmadan çağrılamaz — kullanıcıya net sebep yaz.
        const message =
          'LinkedIn Job Posting API, Talent Solutions partner onayı gerektirir. ' +
          'Onayınız yoksa "Şirket sayfası gönderisi" veya "XML ilan beslemesi" kanalını kullanın.';
        await this.posts.record({
          companyId: input.companyId,
          postingRef: input.postingRef,
          channel,
          status: 'failed',
          postUrn: null,
          postUrl: null,
          title: input.title,
          errorMessage: message,
          createdBy: input.actorId,
        });
        return { channel, status: 'failed', postUrn: null, postUrl: null, error: message };
      }

      // channel === 'share'
      if (connection.organizationUrn === null || connection.organizationUrn === '') {
        throw new JobPostingNotPublishableError('LinkedIn şirket sayfası seçilmemiş');
      }
      const lang: ShareLang = isShareLang(input.lang) ? input.lang : 'tr';
      const share = await this.provider.createShare({
        config,
        organizationUrn: connection.organizationUrn,
        commentary: buildShareCommentary(snapshot, lang),
        ...(snapshot.applyUrl !== null ? { linkUrl: snapshot.applyUrl } : {}),
        linkTitle: snapshot.title,
      });
      await this.posts.record({
        companyId: input.companyId,
        postingRef: input.postingRef,
        channel,
        status: 'published',
        postUrn: share.urn,
        postUrl: share.url,
        title: input.title,
        errorMessage: null,
        createdBy: input.actorId,
      });
      return { channel, status: 'published', postUrn: share.urn, postUrl: share.url, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.posts.record({
        companyId: input.companyId,
        postingRef: input.postingRef,
        channel,
        status: 'failed',
        postUrn: null,
        postUrl: null,
        title: input.title,
        errorMessage: message,
        createdBy: input.actorId,
      });
      return { channel, status: 'failed', postUrn: null, postUrl: null, error: message };
    }
  }
}
