/**
 * BcryptPasswordHasher — PasswordHasher port'unun bcryptjs implementasyonu.
 *
 * bcrypt rounds dışarıdan inject edilir (config). Üretim için 10-12 önerilir.
 */
import bcrypt from 'bcryptjs';

import type { PasswordHasher } from '../../application/ports/PasswordHasher.js';
import type { Password } from '../../domain/valueObjects/Password.js';

export interface BcryptPasswordHasherConfig {
  /** bcrypt salt rounds, 8-15 arası. Default 10. */
  rounds: number;
}

export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly cfg: BcryptPasswordHasherConfig) {
    if (cfg.rounds < 8 || cfg.rounds > 15) {
      throw new Error(`bcrypt rounds 8-15 arasında olmalı, ${cfg.rounds} verildi`);
    }
  }

  async hash(password: Password): Promise<string> {
    return bcrypt.hash(password.value, this.cfg.rounds);
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
