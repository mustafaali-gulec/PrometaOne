/**
 * AuthUserLookupAdapter — UserLookupPort'un auth modülü üzerinden okuma impl.
 *
 * ADR-0005 § "Anti-corruption layer":
 *   - HR auth modülünün domain'ine doğrudan bağlanmaz.
 *   - Auth'un public API'sini (UserRepository) wrap eder.
 *   - HrUserSummary minimal bir view; auth modülünün User entity'sinin
 *     internal alanlarını HR'a sızdırmaz.
 *
 * Concrete: api-server/src/modules/auth/index.ts'in `UserRepository`
 * export'unu inject ediyoruz (composition root'ta).
 */
import type { UserRepository } from '../../../auth/index.js';
import type { HrUserSummary, UserLookupPort } from '../../application/ports/UserLookupPort.js';

export class AuthUserLookupAdapter implements UserLookupPort {
  constructor(private readonly users: UserRepository) {}

  async findById(userId: number): Promise<HrUserSummary | null> {
    const user = await this.users.findById(userId);
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      active: user.active,
    };
  }
}
