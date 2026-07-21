import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createRateLimiter } from '../rateLimit.js';

describe('createRateLimiter', () => {
  it('limit içinde izin verir, limiti aşınca reddeder', () => {
    const allow = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => 1_000 });

    assert.equal(allow('k'), true);
    assert.equal(allow('k'), true);
    assert.equal(allow('k'), true);
    assert.equal(allow('k'), false); // 4. istek
    assert.equal(allow('k'), false);
  });

  it('pencere süresi dolunca sayaç sıfırlanır', () => {
    let t = 1_000;
    const allow = createRateLimiter({ limit: 1, windowMs: 60_000, now: () => t });

    assert.equal(allow('k'), true);
    assert.equal(allow('k'), false);

    t += 60_001; // pencere geçti
    assert.equal(allow('k'), true);
  });

  it('farklı anahtarlar birbirinden bağımsız sayılır', () => {
    const allow = createRateLimiter({ limit: 1, windowMs: 60_000, now: () => 1_000 });

    assert.equal(allow('ip1:ali'), true);
    assert.equal(allow('ip1:ali'), false);
    assert.equal(allow('ip2:ali'), true);
    assert.equal(allow('ip1:veli'), true);
  });
});
