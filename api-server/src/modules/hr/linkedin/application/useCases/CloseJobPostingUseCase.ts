/**
 * CloseJobPostingUseCase — ilan kapatılınca LinkedIn ayak izini temizler.
 *
 *   feed  → snapshot 'closed' olur, XML beslemesinden düşer; LinkedIn bir
 *           sonraki taramada native ilanı kapatır.
 *   share → şirket sayfasındaki gönderi silinir (varsa).
 *
 * Kapatma İLANI ETKİLEMEZ: LinkedIn tarafı hata verse bile ilan uygulamada
 * kapanmış sayılır — bu yüzden hatalar kayda geçer, fırlatılmaz.
 */
import type { Clock } from '../../../application/ports/Clock.js';
import type { LinkedInChannel } from '../../domain/valueObjects/LinkedInChannel.js';
import type { LinkedInProvider } from '../ports/LinkedInProvider.js';
import type {
  JobPostingFeedRepository,
  LinkedInPostRepository,
} from '../ports/LinkedInRepositories.js';
import type { LinkedInAccess } from '../services/LinkedInAccess.js';

export interface CloseJobPostingInput {
  companyId: number;
  postingRef: string;
  actorId: number | null;
}

export interface CloseChannelResult {
  channel: LinkedInChannel;
  status: 'removed' | 'failed';
  error: string | null;
}

export class CloseJobPostingUseCase {
  constructor(
    private readonly access: LinkedInAccess,
    private readonly provider: LinkedInProvider,
    private readonly feed: JobPostingFeedRepository,
    private readonly posts: LinkedInPostRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CloseJobPostingInput): Promise<{ results: CloseChannelResult[] }> {
    const loaded = await this.access.loadOrNull(input.companyId);
    const now = this.clock.now();
    const results: CloseChannelResult[] = [];

    // Snapshot'ı her hâlükârda kapat — bağlantı silinmiş olsa bile ilan public
    // beslemede asılı kalmamalı.
    await this.feed.close(input.companyId, input.postingRef, now);

    const existing = await this.posts.listByPosting(input.companyId, input.postingRef);
    for (const post of existing) {
      if (post.status !== 'published') continue;

      if (post.channel === 'feed' || post.channel === 'job_api') {
        await this.posts.record({
          companyId: input.companyId,
          postingRef: input.postingRef,
          channel: post.channel,
          status: 'removed',
          postUrn: null,
          postUrl: null,
          title: null,
          errorMessage: null,
          createdBy: input.actorId,
        });
        results.push({ channel: post.channel, status: 'removed', error: null });
        continue;
      }

      // share — gönderiyi sil
      try {
        const urn = post.toJSON().postUrn;
        if (loaded !== null && urn !== null) {
          const { connection, config } = loaded;
          const fresh = await this.access.ensureAuthorized(input.companyId, connection, config);
          await this.provider.deleteShare({ config: fresh.config, urn });
        }
        await this.posts.record({
          companyId: input.companyId,
          postingRef: input.postingRef,
          channel: 'share',
          status: 'removed',
          postUrn: null,
          postUrl: null,
          title: null,
          errorMessage: null,
          createdBy: input.actorId,
        });
        results.push({ channel: 'share', status: 'removed', error: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await this.posts.record({
          companyId: input.companyId,
          postingRef: input.postingRef,
          channel: 'share',
          status: 'failed',
          postUrn: post.toJSON().postUrn,
          postUrl: post.postUrl,
          title: null,
          errorMessage: message,
          createdBy: input.actorId,
        });
        results.push({ channel: 'share', status: 'failed', error: message });
      }
    }

    return { results };
  }
}
