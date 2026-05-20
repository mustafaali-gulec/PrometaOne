/**
 * PasswordHasher — şifre hash'leme + doğrulama port'u.
 *
 * Concrete impl: infrastructure/bcrypt/BcryptPasswordHasher.ts (yapılacak)
 * Test'te FakePasswordHasher kullanılabilir.
 */
import type { Password } from '../../domain/valueObjects/Password.js';

export interface PasswordHasher {
  hash(password: Password): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}
