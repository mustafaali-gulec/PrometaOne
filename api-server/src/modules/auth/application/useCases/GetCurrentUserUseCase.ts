/**
 * GetCurrentUserUseCase — auth context'ten user info döner.
 *
 * Login sonrası /v1/auth/me için kullanılır.
 */
import { toPublicUserDto, type PublicUserDto } from '../dto/AuthDto.js';
import { UserNotFoundError } from '../errors/AuthErrors.js';
import type { UserRepository } from '../ports/UserRepository.js';

export class GetCurrentUserUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(input: { userId: number }): Promise<PublicUserDto> {
    const user = await this.users.findById(input.userId);
    if (!user) throw new UserNotFoundError();
    return toPublicUserDto(user.toJSON());
  }
}
