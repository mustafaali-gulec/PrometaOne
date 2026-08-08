import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { JobPostingSnapshot } from '../../domain/entities/JobPostingSnapshot.js';
import {
  buildJobFeedXml,
  formatFeedDate,
  mapEmploymentTypeToLinkedIn,
  splitLocation,
} from '../../domain/services/JobFeedXmlBuilder.js';

const PUBLISHED_AT = new Date('2026-08-01T09:30:00.000Z');
const GENERATED_AT = new Date('2026-08-08T12:00:00.000Z');

function snapshot(over: Partial<Parameters<typeof JobPostingSnapshot.create>[0]> = {}) {
  return JobPostingSnapshot.create({
    id: 1,
    companyId: 7,
    postingRef: 'post_1',
    slug: 'kidemli-yazilim-muhendisi',
    title: 'Kıdemli Yazılım Mühendisi',
    description: 'Ekibimize katılacak mühendis arıyoruz.',
    location: 'İstanbul, Türkiye',
    employmentType: 'full_time',
    companyName: 'Promet Bilişim',
    applyUrl: 'https://kariyer.promet.com/ilan/kidemli-yazilim-muhendisi',
    status: 'published',
    publishedAt: PUBLISHED_AT,
    closedAt: null,
    ...over,
  });
}

const publisher = {
  name: 'Promet Bilişim',
  url: 'https://kariyer.promet.com',
  generatedAt: GENERATED_AT,
};

describe('JobFeedXmlBuilder', () => {
  it('formatFeedDate LinkedIn biçimi (YYYY-MM-DD HH:mm:ss, UTC)', () => {
    assert.equal(formatFeedDate(PUBLISHED_AT), '2026-08-01 09:30:00');
  });

  it('mapEmploymentTypeToLinkedIn bilinen türleri çevirir, bilinmeyeni OTHER yapar', () => {
    assert.equal(mapEmploymentTypeToLinkedIn('full_time'), 'FULL_TIME');
    assert.equal(mapEmploymentTypeToLinkedIn('intern'), 'INTERNSHIP');
    assert.equal(mapEmploymentTypeToLinkedIn('freelance'), 'CONTRACT');
    assert.equal(mapEmploymentTypeToLinkedIn('uydurma'), 'OTHER');
    assert.equal(mapEmploymentTypeToLinkedIn(null), 'FULL_TIME');
  });

  it('splitLocation şehir/ülkeye böler', () => {
    assert.deepEqual(splitLocation('İstanbul, Türkiye'), { city: 'İstanbul', country: 'Türkiye' });
    assert.deepEqual(splitLocation('Ankara'), { city: 'Ankara', country: '' });
    assert.deepEqual(splitLocation(null), { city: '', country: '' });
    assert.deepEqual(splitLocation('  '), { city: '', country: '' });
  });

  it('yayınlanmış ilanı <job> düğümü olarak yazar', () => {
    const xml = buildJobFeedXml([snapshot()], publisher);
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(xml, /<partnerJobId><!\[CDATA\[post_1]]><\/partnerJobId>/);
    assert.match(xml, /<title><!\[CDATA\[Kıdemli Yazılım Mühendisi]]><\/title>/);
    assert.match(xml, /<jobtype><!\[CDATA\[FULL_TIME]]><\/jobtype>/);
    assert.match(xml, /<city><!\[CDATA\[İstanbul]]><\/city>/);
    assert.match(xml, /<country><!\[CDATA\[Türkiye]]><\/country>/);
    assert.match(xml, /<postingdate><!\[CDATA\[2026-08-01 09:30:00]]><\/postingdate>/);
  });

  it('kapatılan ilan beslemeye GİRMEZ', () => {
    const xml = buildJobFeedXml([snapshot({ status: 'closed' })], publisher);
    assert.equal(xml.includes('<job>'), false);
    assert.match(xml, /<source>/);
  });

  it('boş liste geçerli XML üretir', () => {
    const xml = buildJobFeedXml([], publisher);
    assert.match(xml, /<source>[\s\S]*<\/source>/);
    assert.equal(xml.includes('<job>'), false);
  });

  it("içerikteki ]]> CDATA'yı erken kapatmaz", () => {
    const xml = buildJobFeedXml([snapshot({ description: 'kötü ]]> girdi' })], publisher);
    // Açılan her CDATA bölümü kapanmalı — sayılar eşit olmalı.
    const opens = (xml.match(/<!\[CDATA\[/g) ?? []).length;
    const closes = (xml.match(/]]>/g) ?? []).length;
    assert.equal(opens, closes);
    assert.match(xml, /kötü ]]]]><!\[CDATA\[> girdi/);
  });

  it('boş alanlar self-closing etiket olur', () => {
    const xml = buildJobFeedXml([snapshot({ location: null, applyUrl: null })], publisher);
    assert.match(xml, /<location\/>/);
    assert.match(xml, /<applyurl\/>/);
  });
});
