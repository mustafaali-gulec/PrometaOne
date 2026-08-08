/**
 * ListLinkedInPostsUseCase — gönderim kayıtlarını listeler.
 *
 * İlan kartlarındaki "LinkedIn'de yayında / hata" rozetleri tek çağrıda
 * beslenebilsin diye postingRef'e göre gruplanmış hâlde döner.
 */
import type { LinkedInJobPost } from '../../domain/entities/LinkedInJobPost.js';
import type { LinkedInPostRepository } from '../ports/LinkedInRepositories.js';

const DEFAULT_LIMIT = 500;

export class ListLinkedInPostsUseCase {
  constructor(private readonly posts: LinkedInPostRepository) {}

  async execute(input: {
    companyId: number;
    postingRef?: string | undefined;
    limit?: number | undefined;
  }): Promise<{ posts: ReturnType<LinkedInJobPost['toJSON']>[] }> {
    const rows =
      input.postingRef !== undefined && input.postingRef !== ''
        ? await this.posts.listByPosting(input.companyId, input.postingRef)
        : await this.posts.listByCompany(input.companyId, input.limit ?? DEFAULT_LIMIT);
    return { posts: rows.map((r) => r.toJSON()) };
  }
}
