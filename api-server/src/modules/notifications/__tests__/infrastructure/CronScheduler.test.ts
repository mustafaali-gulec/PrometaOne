import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CronScheduler,
  type CronJobDefinition,
  type CronLogger,
} from '../../infrastructure/cron/CronScheduler.js';

function makeLogger(): CronLogger & { logs: string[]; errors: string[] } {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    info: (m) => logs.push(m),
    error: (m) => errors.push(m),
    logs,
    errors,
  };
}

describe('CronScheduler', () => {
  it('geçersiz pattern construction sırasında fırlatır', () => {
    const bad: CronJobDefinition = {
      name: 'bad',
      pattern: 'invalid-pattern',
      execute: () => {},
    };
    assert.throws(() => new CronScheduler([bad]), /geçersiz pattern/);
  });

  it('runOnce() ile iş manuel tetiklenir', async () => {
    let calls = 0;
    const scheduler = new CronScheduler([
      {
        name: 'test-job',
        pattern: '0 9 * * *',
        execute: () => {
          calls += 1;
        },
      },
    ]);

    await scheduler.runOnce('test-job');
    assert.equal(calls, 1);
  });

  it('runOnce() bilinmeyen iş ismi için fırlatır', async () => {
    const scheduler = new CronScheduler([
      { name: 'a', pattern: '* * * * *', execute: () => {} },
    ]);
    await assert.rejects(scheduler.runOnce('yok'), /bulunamadı/);
  });

  it('iş hata fırlatırsa scheduler durmaz, error loglar', async () => {
    const logger = makeLogger();
    const scheduler = new CronScheduler(
      [
        {
          name: 'flaky',
          pattern: '* * * * *',
          execute: () => {
            throw new Error('boom');
          },
        },
      ],
      logger,
    );

    await scheduler.runOnce('flaky');
    assert.equal(logger.errors.length, 1);
    assert.match(logger.errors[0]!, /failed.*flaky/);
  });

  it('async execute beklenir', async () => {
    let resolved = false;
    const scheduler = new CronScheduler([
      {
        name: 'async-job',
        pattern: '* * * * *',
        execute: async () => {
          await new Promise((r) => setTimeout(r, 10));
          resolved = true;
        },
      },
    ]);
    await scheduler.runOnce('async-job');
    assert.equal(resolved, true);
  });

  it('start() + stop() — birden çok kez çağırsak da bozulmaz', () => {
    const scheduler = new CronScheduler([
      { name: 'a', pattern: '* * * * *', execute: () => {} },
    ]);
    scheduler.start();
    scheduler.start(); // ikinci çağrı no-op
    scheduler.stop();
    scheduler.stop(); // tekrar no-op
    assert.ok(true);
  });
});
