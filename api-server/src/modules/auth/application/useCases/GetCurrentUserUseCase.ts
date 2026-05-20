/**
 * GetCurrentUserUseCase — auth context'ten user info döner.
 *
 * Login sonrası /v1/auth/me için kullanılır.
 */
import type { UserRepository } from '../ports/UserRepository.js';
import { UserNotFoundError } from '../errors/AuthErrors.js';
import { toPublicUserDto, type PublicUserDto } from '../dto/AuthDto.js';

export class GetCurrentUserUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(input: { userId: number }): Promise<PublicUserDto> {
    const user = await this.users.findById(input.userId);
    if (!user) throw new UserNotFoundError();
    return toPublicUserDto(user.toJSON());
  }
}
