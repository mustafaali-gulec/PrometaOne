import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Context } from 'hono';

import { extractClientIp, normalizeIp, resolveClientIp } from '../clientIp.js';

/** resolveClientIp'nin dokunduğu alanları taklit eden minimal sahte Context. */
function fakeContext(opts: {
  headers?: Record<string, string>;
  remoteAddress?: string;
  env?: unknown;
}): Context {
  const headers = opts.headers ?? {};
  const env =
    opts.env !== undefined
      ? opts.env
      : opts.remoteAddress !== undefined
        ? { incoming: { socket: { remoteAddress: opts.remoteAddress } } }
        : undefined;
  return {
    req: { header: (name: string) => headers[name] },
    env,
  } as unknown as Context;
}

describe('normalizeIp', () => {
  it('geçerli IPv4/IPv6 adreslerini aynen döndürür', () => {
    assert.equal(normalizeIp('203.0.113.5'), '203.0.113.5');
    assert.equal(normalizeIp('2001:db8::1'), '2001:db8::1');
  });

  it('baştaki/sondaki boşlukları kırpar', () => {
    assert.equal(normalizeIp('  203.0.113.5  '), '203.0.113.5');
  });

  it('port ekli biçimlerden portu ayıklar', () => {
    assert.equal(normalizeIp('203.0.113.5:8443'), '203.0.113.5');
    assert.equal(normalizeIp('[2001:db8::1]:8443'), '2001:db8::1');
    assert.equal(normalizeIp('[::1]'), '::1');
  });

  it('IPv4-eşlemeli IPv6 adresini IPv4 biçimine indirger', () => {
    assert.equal(normalizeIp('::ffff:10.0.0.1'), '10.0.0.1');
  });

  it('geçersiz/boş değerler için null döner', () => {
    assert.equal(normalizeIp('unknown'), null);
    assert.equal(normalizeIp(''), null);
    assert.equal(normalizeIp('   '), null);
    assert.equal(normalizeIp(undefined), null);
    assert.equal(normalizeIp(null), null);
    assert.equal(normalizeIp('999.1.1.1'), null);
  });
});

describe('extractClientIp', () => {
  it('X-Forwarded-For tek IPv4 adresini döndürür', () => {
    assert.equal(extractClientIp('203.0.113.5', undefined), '203.0.113.5');
  });

  it('X-Forwarded-For zincirinde ilk geçerli IP alınır (boşluklar kırpılır)', () => {
    assert.equal(extractClientIp(' 203.0.113.5 , 10.0.0.1', undefined), '203.0.113.5');
  });

  it('proxy\'nin zincire yazdığı "unknown" atlanır, sonraki geçerli IP alınır', () => {
    assert.equal(extractClientIp('unknown, 203.0.113.5', undefined), '203.0.113.5');
  });

  it('geçerli aday yoksa null döner (inet kolonuna "unknown" yazılmaz)', () => {
    assert.equal(extractClientIp('unknown', undefined), null);
    assert.equal(extractClientIp(undefined, undefined), null);
    assert.equal(extractClientIp('', ''), null);
    assert.equal(extractClientIp('abc', 'def'), null);
  });

  it('X-Forwarded-For yoksa X-Real-IP kullanılır', () => {
    assert.equal(extractClientIp(undefined, '198.51.100.7'), '198.51.100.7');
  });

  it('X-Forwarded-For geçersizse X-Real-IP devreye girer', () => {
    assert.equal(extractClientIp('unknown', '198.51.100.7'), '198.51.100.7');
  });

  it('IPv6 adresleri kabul edilir', () => {
    assert.equal(extractClientIp('2001:db8::1', undefined), '2001:db8::1');
    assert.equal(extractClientIp(undefined, '::1'), '::1');
  });
});

describe('resolveClientIp', () => {
  it('proxy başlığı varsa onu kullanır (soket adresine bakmaz)', () => {
    const c = fakeContext({
      headers: { 'x-forwarded-for': '203.0.113.5' },
      remoteAddress: '10.0.0.9',
    });
    assert.equal(resolveClientIp(c), '203.0.113.5');
  });

  it("başlık yoksa soket adresine düşer (denetim izi IP'siz kalmaz)", () => {
    const c = fakeContext({ remoteAddress: '::ffff:172.18.0.4' });
    assert.equal(resolveClientIp(c), '172.18.0.4');
  });

  it('başlık geçersizse ("unknown") soket adresine düşer', () => {
    const c = fakeContext({
      headers: { 'x-forwarded-for': 'unknown' },
      remoteAddress: '10.0.0.9',
    });
    assert.equal(resolveClientIp(c), '10.0.0.9');
  });

  it('env.server sarmalayıcısı üzerinden de soket adresini bulur', () => {
    const c = fakeContext({
      env: { server: { incoming: { socket: { remoteAddress: '198.51.100.7' } } } },
    });
    assert.equal(resolveClientIp(c), '198.51.100.7');
  });

  it('ne başlık ne soket varsa null döner (env tanımsız)', () => {
    assert.equal(resolveClientIp(fakeContext({})), null);
  });

  it('env beklenen şekilde değilse çökmez, null döner', () => {
    assert.equal(resolveClientIp(fakeContext({ env: {} })), null);
    assert.equal(resolveClientIp(fakeContext({ env: { incoming: {} } })), null);
    assert.equal(resolveClientIp(fakeContext({ env: 'garip' })), null);
  });
});
