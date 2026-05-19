import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { UuidGenerator } from '../../infrastructure/ids/UuidGenerator.js';

describe('UuidGenerator', () => {
  it('next() RFC 4122 v4 UUID formatında string döner', () => {
    const gen = new UuidGenerator();
    const uuid = gen.next();
    assert.match(
      uuid,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('next() ardışık çağrılarda farklı id\'ler döner', () => {
    const gen = new UuidGenerator();
    const a = gen.next();
    const b = gen.next();
    assert.notEqual(a, b);
  });
});
