/**
 * JobFeedXmlBuilder — LinkedIn iş ilanı XML beslemesi üreteci (saf fonksiyon).
 *
 * LinkedIn Jobs, `<source>` kökü altında `<job>` düğümleri bekleyen bir XML
 * beslemesini periyodik tarar ve her düğüm için native bir LinkedIn iş ilanı
 * açar. Bizim tarafta API anahtarı/partner onayı GEREKMEZ — feed URL'inin bir
 * kez LinkedIn'e kaydettirilmesi yeterlidir.
 *
 * Yalnızca `published` snapshot'lar yayınlanır; kapatılan ilan feed'den düşer
 * ve LinkedIn bir sonraki taramada ilanı kapatır.
 */
import type { JobPostingSnapshot } from '../entities/JobPostingSnapshot.js';

/** Uygulama içi istihdam türü → LinkedIn jobtype sözlüğü. */
const JOB_TYPE_MAP: Record<string, string> = {
  full_time: 'FULL_TIME',
  part_time: 'PART_TIME',
  contract: 'CONTRACT',
  intern: 'INTERNSHIP',
  freelance: 'CONTRACT',
  temporary: 'TEMPORARY',
};

export interface JobFeedPublisher {
  /** Beslemeyi yayınlayan taraf — genelde şirket adı. */
  name: string;
  /** Kariyer sitesi / şirket sitesi kök adresi. */
  url: string;
  /** Feed'in üretildiği an. */
  generatedAt: Date;
}

/**
 * CDATA'ya güvenle gömer. İçerikte `]]>` geçerse CDATA bölümünü ikiye ayırır
 * (aksi hâlde XML erken kapanır ve besleme bozulur).
 */
function cdata(value: string | null | undefined): string {
  const safe = (value ?? '').replace(/]]>/g, ']]]]><![CDATA[>');
  return `<![CDATA[${safe}]]>`;
}

function tag(name: string, value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return `    <${name}/>`;
  return `    <${name}>${cdata(value)}</${name}>`;
}

/** LinkedIn tarih formatı: `YYYY-MM-DD HH:mm:ss` (UTC). */
export function formatFeedDate(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

export function mapEmploymentTypeToLinkedIn(value: string | null): string {
  if (value === null) return 'FULL_TIME';
  return JOB_TYPE_MAP[value] ?? 'OTHER';
}

/**
 * Konum metnini şehir/ülkeye böler ("İstanbul, Türkiye" → city + country).
 * Tek parça verilmişse şehir kabul edilir; ülke boş bırakılır.
 */
export function splitLocation(location: string | null): { city: string; country: string } {
  if (location === null || location.trim() === '') return { city: '', country: '' };
  const parts = location
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p !== '');
  if (parts.length === 0) return { city: '', country: '' };
  if (parts.length === 1) return { city: parts[0] as string, country: '' };
  return { city: parts[0] as string, country: parts[parts.length - 1] as string };
}

export function buildJobFeedXml(
  snapshots: readonly JobPostingSnapshot[],
  publisher: JobFeedPublisher,
): string {
  const jobs = snapshots
    .filter((s) => s.status === 'published')
    .map((s) => {
      const { city, country } = splitLocation(s.location);
      return [
        '  <job>',
        tag('partnerJobId', s.postingRef),
        tag('company', s.companyName),
        tag('title', s.title),
        tag('description', s.description),
        tag('applyurl', s.applyUrl),
        tag('location', s.location),
        tag('city', city),
        tag('country', country),
        tag('jobtype', mapEmploymentTypeToLinkedIn(s.employmentType)),
        tag('postingdate', formatFeedDate(s.publishedAt ?? publisher.generatedAt)),
        '  </job>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<source>',
    `  <publisher>${cdata(publisher.name)}</publisher>`,
    `  <publisherurl>${cdata(publisher.url)}</publisherurl>`,
    `  <lastBuildDate>${cdata(formatFeedDate(publisher.generatedAt))}</lastBuildDate>`,
    ...(jobs === '' ? [] : [jobs]),
    '</source>',
    '',
  ].join('\n');
}
