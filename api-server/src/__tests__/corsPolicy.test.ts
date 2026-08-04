/**
 * CORS origin politikası testleri (SaaS + on-prem ikili dağıtım).
 *
 * Odak: onprem modda özel-ağ origin'lerinin (IP / bilgisayar adı / .local)
 * otomatik kabulü, saas modda yalnız açık liste + joker alt alan adı, genel
 * internet origin'lerinin her iki modda da liste dışıysa reddi.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { makeCorsOriginResolver } from '../corsPolicy.js';

describe('makeCorsOriginResolver — onprem modu', () => {
  const resolve = makeCorsOriginResolver({
    deployMode: 'onprem',
    allowedOrigins: ['http://localhost:5173'],
  });

  it('açık listedeki origin geçer', () => {
    assert.equal(resolve('http://localhost:5173'), 'http://localhost:5173');
  });

  it('RFC1918 IP origin listede olmasa da geçer (terminal IP ile bağlanır)', () => {
    assert.equal(resolve('http://192.168.1.10'), 'http://192.168.1.10');
    assert.equal(resolve('http://10.0.0.5:8080'), 'http://10.0.0.5:8080');
    assert.equal(resolve('http://172.20.3.7'), 'http://172.20.3.7');
  });

  it('tek etiketli bilgisayar adı geçer (terminal makine adıyla bağlanır)', () => {
    assert.equal(resolve('http://sunucu-pc'), 'http://sunucu-pc');
    assert.equal(resolve('http://SUNUCU01:8080'), 'http://SUNUCU01:8080');
  });

  it('.local (mDNS) adı geçer', () => {
    assert.equal(resolve('http://sunucu-pc.local'), 'http://sunucu-pc.local');
  });

  it('https özel-ağ origin de geçer (yerel TLS kurulumları)', () => {
    assert.equal(resolve('https://192.168.1.10'), 'https://192.168.1.10');
    assert.equal(resolve('https://sunucu-pc.local:8443'), 'https://sunucu-pc.local:8443');
  });

  it('genel internet origin listede yoksa REDDEDİLİR', () => {
    assert.equal(resolve('https://kotu-site.com'), null);
    assert.equal(resolve('http://8.8.8.8'), null);
  });

  it('boş/geçersiz origin reddedilir', () => {
    assert.equal(resolve(''), null);
    assert.equal(resolve('not-a-url'), null);
    assert.equal(resolve('ftp://192.168.1.10'), null);
  });
});

describe('makeCorsOriginResolver — saas modu', () => {
  const resolve = makeCorsOriginResolver({
    deployMode: 'saas',
    allowedOrigins: ['https://app.msuite.app', 'https://*.msuite.app'],
  });

  it('açık listedeki origin geçer', () => {
    assert.equal(resolve('https://app.msuite.app'), 'https://app.msuite.app');
  });

  it('joker alt alan adı geçer', () => {
    assert.equal(resolve('https://firma1.msuite.app'), 'https://firma1.msuite.app');
  });

  it('joker kök alanı kapsamaz, sahte son ek reddedilir', () => {
    // *.x kökün kendisine uymaz (kök ayrıca listelenmeli — burada app.msuite.app listeli)
    assert.equal(resolve('https://msuite.app'), null);
    assert.equal(resolve('https://kotumsuite.app'), null);
  });

  it('özel-ağ origin SaaS modda OTOMATİK GEÇMEZ', () => {
    assert.equal(resolve('http://192.168.1.10'), null);
    assert.equal(resolve('http://sunucu-pc'), null);
  });

  it('şema uyuşmazlığı reddedilir', () => {
    assert.equal(resolve('http://firma1.msuite.app'), null);
  });
});

describe("makeCorsOriginResolver — '*' girdisi", () => {
  it("her origin'i kabul eder (istek origin'i yansıtılır)", () => {
    const resolve = makeCorsOriginResolver({ deployMode: 'saas', allowedOrigins: ['*'] });
    assert.equal(resolve('https://herhangi.com'), 'https://herhangi.com');
  });
});
