/**
 * GetJobFeedUseCase — public XML iş ilanı beslemesini üretir.
 *
 * Bu ucun ÖNÜNDE authMiddleware YOKTUR; LinkedIn'in crawler'ı çerezsiz gelir.
 * Yetkilendirme tek şeyle yapılır: tahmin edilemez `feed_token`. Jeton hangi
 * şirkete ait olduğunu da belirler — companyId istemciden ALINMAZ (aksi hâlde
 * jetonu olan biri başka şirketin ilanlarını okurdu).
 */
import type { Clock } from '../../../application/ports/Clock.js';
import { InvalidFeedTokenError } from '../../domain/errors/LinkedInErrors.js';
import { buildJobFeedXml } from '../../domain/services/JobFeedXmlBuilder.js';
import type { JobPostingFeedRepository } from '../ports/LinkedInRepositories.js';
import type { LinkedInConnectionRepository } from '../ports/LinkedInRepositories.js';

export class GetJobFeedUseCase {
  constructor(
    private readonly connections: LinkedInConnectionRepository,
    private readonly feed: JobPostingFeedRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { token: string }): Promise<{ xml: string }> {
    if (input.token.trim() === '') throw new InvalidFeedTokenError();

    const found = await this.connections.findByFeedToken(input.token);
    if (found === null) throw new InvalidFeedTokenError();
    if (!found.connection.isActive) throw new InvalidFeedTokenError();

    const snapshots = await this.feed.listPublished(found.companyId);
    const xml = buildJobFeedXml(snapshots, {
      name: found.connection.organizationName ?? 'Kariyer',
      url: found.connection.careerSiteBaseUrl ?? '',
      generatedAt: this.clock.now(),
    });
    return { xml };
  }
}
