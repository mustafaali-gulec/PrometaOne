import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { JobPostingSnapshot } from '../../domain/entities/JobPostingSnapshot.js';
import {
  buildShareCommentary,
  isShareLang,
  MAX_COMMENTARY_LENGTH,
} from '../../domain/services/JobShareTextBuilder.js';

function snapshot(over: Partial<Parameters<typeof JobPostingSnapshot.create>[0]> = {}) {
  return JobPostingSnapshot.create({
    id: 1,
    companyId: 7,
    postingRef: 'post_1',
    slug: 'yazilim-muhendisi',
    title: 'Yazılım Mühendisi',
    description: 'Backend ekibimize katılacak arkadaş arıyoruz.',
    location: 'İstanbul',
    employmentType: 'full_time',
    companyName: 'Promet',
    applyUrl: 'https://kariyer.promet.com/ilan/yazilim-muhendisi',
    status: 'published',
    publishedAt: new Date('2026-08-01T09:00:00.000Z'),
    closedAt: null,
    ...over,
  });
}

describe('JobShareTextBuilder', () => {
  it('isShareLang 4 dili kabul eder', () => {
    for (const l of ['tr', 'en', 'de', 'ar']) assert.equal(isShareLang(l), true);
    assert.equal(isShareLang('fr'), false);
    assert.equal(isShareLang(undefined), false);
  });

  it('TR metni başlık + konum + tür + açıklama + başvuru linki içerir', () => {
    const text = buildShareCommentary(snapshot(), 'tr');
    assert.match(text, /Yazılım Mühendisi/);
    assert.match(text, /Konum: İstanbul/);
    assert.match(text, /Çalışma şekli: Tam Zamanlı/);
    assert.match(text, /Backend ekibimize/);
    assert.match(text, /Başvuru: https:\/\/kariyer\.promet\.com/);
  });

  it('dil değişince etiketler de değişir (sabit-Türkçe yok)', () => {
    const en = buildShareCommentary(snapshot(), 'en');
    assert.match(en, /We are hiring/);
    assert.match(en, /Location: İstanbul/);
    assert.match(en, /Employment type: Full-time/);

    const de = buildShareCommentary(snapshot(), 'de');
    assert.match(de, /Wir stellen ein/);
    assert.match(de, /Standort: İstanbul/);

    const ar = buildShareCommentary(snapshot(), 'ar');
    assert.match(ar, /الموقع: İstanbul/);
  });

  it('eksik konum/tür satırları atlanır', () => {
    const text = buildShareCommentary(snapshot({ location: null, employmentType: null }), 'tr');
    assert.equal(text.includes('Konum:'), false);
    assert.equal(text.includes('Çalışma şekli:'), false);
    assert.match(text, /Yazılım Mühendisi/);
  });

  it('çok uzun açıklamada bile sınır aşılmaz ve başvuru linki KORUNUR', () => {
    const text = buildShareCommentary(snapshot({ description: 'çok uzun '.repeat(2000) }), 'tr');
    assert.ok(
      text.length <= MAX_COMMENTARY_LENGTH,
      `metin ${String(text.length)} karakter — sınır ${String(MAX_COMMENTARY_LENGTH)}`,
    );
    assert.match(text, /Başvuru: https:\/\/kariyer\.promet\.com\/ilan\/yazilim-muhendisi/);
    assert.match(text, /…/);
  });

  it('başvuru linki yoksa metin yine kurulur', () => {
    const text = buildShareCommentary(snapshot({ applyUrl: null }), 'tr');
    assert.equal(text.includes('Başvuru:'), false);
    assert.match(text, /#işilanı/);
  });
});
