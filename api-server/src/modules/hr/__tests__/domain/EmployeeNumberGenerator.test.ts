import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SequentialEmployeeNumberGenerator } from '../../domain/services/EmployeeNumberGenerator.js';

describe('SequentialEmployeeNumberGenerator', () => {
  it('default prefix EMP- + 6 hane', async () => {
    let seq = 0;
    const gen = new SequentialEmployeeNumberGenerator(async () => ++seq);
    const a = await gen.next(1);
    const b = await gen.next(1);
    assert.equal(a.value, 'EMP-000001');
    assert.equal(b.value, 'EMP-000002');
  });

  it('custom prefix ve width', async () => {
    let seq = 99;
    const gen = new SequentialEmployeeNumberGenerator(async () => ++seq, {
      prefix: 'STAFF-',
      width: 4,
    });
    const e = await gen.next(1);
    assert.equal(e.value, 'STAFF-0100');
  });

  it('üretilen numara EmployeeNumber doğrulayıcısından geçer', async () => {
    const gen = new SequentialEmployeeNumberGenerator(async () => 1);
    const e = await gen.next(1);
    assert.match(e.value, /^EMP-\d{6}$/);
  });

  it("farklı companyId'ler için sequence fn'i çağırılır", async () => {
    const calls: number[] = [];
    const gen = new SequentialEmployeeNumberGenerator(async (cid) => {
      calls.push(cid);
      return calls.length;
    });
    await gen.next(7);
    await gen.next(42);
    assert.deepEqual(calls, [7, 42]);
  });
});
