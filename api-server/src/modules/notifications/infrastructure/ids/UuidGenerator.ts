/**
 * UuidGenerator — IdGenerator port'unun crypto.randomUUID implementasyonu.
 *
 * Node 20+ built-in crypto.randomUUID() RFC 4122 v4 UUID üretir.
 */
import { randomUUID } from 'node:crypto';

import type { IdGenerator } from '../../application/ports/IdGenerator.js';

export class UuidGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}

/** Modül ömrü boyunca paylaşılan default instance. */
export const uuidGenerator = new UuidGenerator();
