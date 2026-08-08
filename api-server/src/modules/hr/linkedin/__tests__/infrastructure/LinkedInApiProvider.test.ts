import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LinkedInApiError } from '../../domain/errors/LinkedInErrors.js';
import {
  escapeCommentary,
  LinkedInApiProvider,
} from '../../infrastructure/provider/LinkedInApiProvider.js';

const config = { clientId: 'cid', clientSecret: 'secret', accessToken: 'token' };

describe('escapeCommentary', () => {
  it("Posts API'nin ayrılmış karakterlerini kaçırır", () => {
    assert.equal(escapeCommentary('(a) [b] {c}'), '\\(a\\) \\[b\\] \\{c\\}');
    assert.equal(escapeCommentary('a|b@c#d'), 'a\\|b\\@c\\#d');
    assert.equal(
      escapeCommentary('yıldız * alt_çizgi ~ tilde'),
      'yıldız \\* alt\\_çizgi \\~ tilde',
    );
  });

  it('düz metni bozmaz', () => {
    assert.equal(escapeCommentary('Yazılım Mühendisi arıyoruz.'), 'Yazılım Mühendisi arıyoruz.');
  });
});

describe('LinkedInApiProvider', () => {
  it('authorize URL beklenen parametreleri taşır', () => {
    const provider = new LinkedInApiProvider({
      fetchImpl: (() => {
        throw new Error('çağrılmamalı');
      }) as unknown as typeof fetch,
    });

    const url = new URL(
      provider.buildAuthorizeUrl({
        clientId: 'cid',
        redirectUri: 'https://app.example/v1/hr-jobs/linkedin/callback',
        state: 'signed-state',
        scopes: ['r_organization_admin', 'w_organization_social'],
      }),
    );

    assert.equal(url.origin + url.pathname, 'https://www.linkedin.com/oauth/v2/authorization');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('client_id'), 'cid');
    assert.equal(url.searchParams.get('state'), 'signed-state');
    assert.equal(url.searchParams.get('scope'), 'r_organization_admin w_organization_social');
  });

  it("createShare gönderi URN'ini x-restli-id başlığından okur", async () => {
    let sentBody: unknown = null;
    const provider = new LinkedInApiProvider({
      apiVersion: '202506',
      fetchImpl: ((_url: string, init: RequestInit) => {
        sentBody = JSON.parse(init.body as string);
        return Promise.resolve(
          new Response('', { status: 201, headers: { 'x-restli-id': 'urn:li:share:777' } }),
        );
      }) as unknown as typeof fetch,
    });

    const res = await provider.createShare({
      config,
      organizationUrn: 'urn:li:organization:123',
      commentary: 'Merhaba (dünya)',
      linkUrl: 'https://kariyer.promet.com/ilan/x',
      linkTitle: 'Yazılım Mühendisi',
    });

    assert.equal(res.urn, 'urn:li:share:777');
    assert.equal(res.url, 'https://www.linkedin.com/feed/update/urn:li:share:777/');

    const body = sentBody as Record<string, unknown>;
    assert.equal(body.author, 'urn:li:organization:123');
    assert.equal(body.commentary, 'Merhaba \\(dünya\\)');
    assert.deepEqual(body.content, {
      article: { source: 'https://kariyer.promet.com/ilan/x', title: 'Yazılım Mühendisi' },
    });
  });

  it('hata yanıtı LinkedInApiError olur (HTTP kodu korunur)', async () => {
    const provider = new LinkedInApiProvider({
      fetchImpl: (() =>
        Promise.resolve(
          new Response(JSON.stringify({ message: 'Not enough permissions' }), { status: 403 }),
        )) as unknown as typeof fetch,
    });

    await assert.rejects(
      () =>
        provider.createShare({
          config,
          organizationUrn: 'urn:li:organization:123',
          commentary: 'x',
        }),
      (err: unknown) => {
        assert.ok(err instanceof LinkedInApiError);
        assert.equal(err.httpStatus, 403);
        assert.match(err.message, /Not enough permissions/);
        return true;
      },
    );
  });

  it('zaten silinmiş gönderi (404) hata DEĞİLDİR — kapatma idempotent', async () => {
    const provider = new LinkedInApiProvider({
      fetchImpl: (() =>
        Promise.resolve(new Response('', { status: 404 }))) as unknown as typeof fetch,
    });
    await provider.deleteShare({ config, urn: 'urn:li:share:777' });
  });
});
