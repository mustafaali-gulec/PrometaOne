import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { LinkedInProvider } from '../../application/ports/LinkedInProvider.js';
import { LinkedInAccess } from '../../application/services/LinkedInAccess.js';
import { CloseJobPostingUseCase } from '../../application/useCases/CloseJobPostingUseCase.js';
import { PublishJobPostingUseCase } from '../../application/useCases/PublishJobPostingUseCase.js';
import { LinkedInConnectionNotFoundError } from '../../domain/errors/LinkedInErrors.js';
import { MockLinkedInProvider } from '../../infrastructure/provider/MockLinkedInProvider.js';

import {
  connectionProps,
  FakeCipher,
  FakeConnectionRepository,
  FakeFeedRepository,
  FakePostRepository,
  fixedClock,
} from './fakes.js';

const BASE_INPUT = {
  companyId: 7,
  postingRef: 'post_1',
  title: 'Yazılım Mühendisi',
  description: 'Backend ekibi.',
  slug: 'yazilim-muhendisi',
  location: 'İstanbul',
  employmentType: 'full_time',
  actorId: 42,
};

function setup(
  opts: {
    connection?: ReturnType<typeof connectionProps> | null;
    provider?: LinkedInProvider;
  } = {},
) {
  const clock = fixedClock();
  const connections = new FakeConnectionRepository(
    opts.connection === undefined ? connectionProps() : opts.connection,
  );
  const feed = new FakeFeedRepository();
  const posts = new FakePostRepository();
  const provider = opts.provider ?? new MockLinkedInProvider();
  const access = new LinkedInAccess(connections, new FakeCipher(), provider, clock);
  return {
    connections,
    feed,
    posts,
    provider,
    publish: new PublishJobPostingUseCase(access, provider, feed, posts, clock),
    close: new CloseJobPostingUseCase(access, provider, feed, posts, clock),
  };
}

describe('PublishJobPostingUseCase', () => {
  it('share kanalı gönderiyi oluşturur ve published olarak kaydeder', async () => {
    const { publish, posts, feed } = setup();
    const res = await publish.execute(BASE_INPUT);

    assert.equal(res.results.length, 1);
    assert.equal(res.results[0]?.channel, 'share');
    assert.equal(res.results[0]?.status, 'published');
    assert.match(res.results[0]?.postUrl ?? '', /linkedin\.com\/feed\/update\//);

    const saved = await posts.listByPosting(7, 'post_1');
    assert.equal(saved.length, 1);
    assert.equal(saved[0]?.status, 'published');

    // Snapshot her kanalda yazılır — share metni ondan kurulur.
    const snap = await feed.findByRef(7, 'post_1');
    assert.equal(snap?.title, 'Yazılım Mühendisi');
  });

  it('başvuru linki kariyer sitesi tabanı + slug ile kurulur', async () => {
    const { publish } = setup();
    const res = await publish.execute(BASE_INPUT);
    assert.equal(res.applyUrl, 'https://kariyer.promet.com/ilan/yazilim-muhendisi');
  });

  it('feed kanalı ağ çağrısı yapmadan snapshot yayınlar', async () => {
    const { publish, feed } = setup({ connection: connectionProps({ channels: ['feed'] }) });
    const res = await publish.execute(BASE_INPUT);

    assert.equal(res.results[0]?.channel, 'feed');
    assert.equal(res.results[0]?.status, 'published');
    assert.equal((await feed.listPublished(7)).length, 1);
  });

  it('otomatik tetiklemede autoPublish kapalıysa hiçbir kanal denenmez', async () => {
    const { publish, posts } = setup({ connection: connectionProps({ autoPublish: false }) });
    const res = await publish.execute({ ...BASE_INPUT, trigger: 'auto' });

    assert.equal(res.results.length, 0);
    assert.equal(res.skippedReason, 'Otomatik LinkedIn yayını kapalı');
    assert.equal((await posts.listByCompany(7, 10)).length, 0);
  });

  it('elle tetiklemede autoPublish kapalı olsa bile gönderilir', async () => {
    const { publish } = setup({ connection: connectionProps({ autoPublish: false }) });
    const res = await publish.execute({ ...BASE_INPUT, trigger: 'manual' });

    assert.equal(res.skippedReason, null);
    assert.equal(res.results[0]?.status, 'published');
  });

  it('entegrasyon kapalıysa atlanır', async () => {
    const { publish } = setup({ connection: connectionProps({ isActive: false }) });
    const res = await publish.execute(BASE_INPUT);
    assert.equal(res.skippedReason, 'LinkedIn entegrasyonu kapalı');
  });

  it('bir kanalın hatası diğerini DÜŞÜRMEZ', async () => {
    const failing = new MockLinkedInProvider();
    failing.createShare = () => Promise.reject(new Error('LinkedIn 403'));
    const { publish } = setup({
      connection: connectionProps({ channels: ['share', 'feed'] }),
      provider: failing,
    });

    const res = await publish.execute(BASE_INPUT);
    const share = res.results.find((r) => r.channel === 'share');
    const feedRes = res.results.find((r) => r.channel === 'feed');

    assert.equal(share?.status, 'failed');
    assert.match(share?.error ?? '', /403/);
    assert.equal(feedRes?.status, 'published');
  });

  it('job_api kanalı partner onayı gerekçesiyle failed döner', async () => {
    const { publish } = setup({ connection: connectionProps({ channels: ['job_api'] }) });
    const res = await publish.execute(BASE_INPUT);

    assert.equal(res.results[0]?.status, 'failed');
    assert.match(res.results[0]?.error ?? '', /partner/i);
  });

  it('şirket sayfası seçilmemişse share kanalı hata kaydeder', async () => {
    const { publish } = setup({ connection: connectionProps({ organizationUrn: null }) });
    const res = await publish.execute(BASE_INPUT);

    assert.equal(res.results[0]?.status, 'failed');
    assert.match(res.results[0]?.error ?? '', /şirket sayfası seçilmemiş/i);
  });

  it('bağlantı hiç yoksa hata fırlatır (kurulum sorunu, kanal sorunu değil)', async () => {
    const { publish } = setup({ connection: null });
    await assert.rejects(() => publish.execute(BASE_INPUT), LinkedInConnectionNotFoundError);
  });

  it('boş başlık reddedilir', async () => {
    const { publish } = setup();
    await assert.rejects(() => publish.execute({ ...BASE_INPUT, title: '   ' }), /başlığı boş/);
  });

  it('aynı ilanı tekrar yayınlamak yeni kayıt AÇMAZ, mevcudu günceller', async () => {
    const { publish, posts } = setup();
    await publish.execute(BASE_INPUT);
    await publish.execute(BASE_INPUT);
    assert.equal((await posts.listByPosting(7, 'post_1')).length, 1);
  });
});

describe('CloseJobPostingUseCase', () => {
  it('ilan kapanınca snapshot beslemeden düşer ve gönderi silinir', async () => {
    const { publish, close, feed, posts, provider } = setup({
      connection: connectionProps({ channels: ['share', 'feed'] }),
    });
    await publish.execute(BASE_INPUT);

    const res = await close.execute({ companyId: 7, postingRef: 'post_1', actorId: 42 });

    assert.equal((await feed.listPublished(7)).length, 0);
    assert.equal(
      res.results.every((r) => r.status === 'removed'),
      true,
    );
    assert.equal((provider as MockLinkedInProvider).deleted.length, 1);

    const saved = await posts.listByPosting(7, 'post_1');
    assert.equal(
      saved.every((p) => p.status === 'removed'),
      true,
    );
  });

  it('bağlantı silinmiş olsa bile snapshot kapatılır', async () => {
    const { publish, feed } = setup({ connection: connectionProps({ channels: ['feed'] }) });
    await publish.execute(BASE_INPUT);

    // Bağlantıyı kaldır — public beslemede ilan asılı kalmamalı.
    const gone = setup({ connection: null });
    const closeWithoutConn = new CloseJobPostingUseCase(
      new LinkedInAccess(gone.connections, new FakeCipher(), gone.provider, fixedClock()),
      gone.provider,
      feed,
      gone.posts,
      fixedClock(),
    );
    await closeWithoutConn.execute({ companyId: 7, postingRef: 'post_1', actorId: null });

    assert.equal((await feed.listPublished(7)).length, 0);
  });
});
