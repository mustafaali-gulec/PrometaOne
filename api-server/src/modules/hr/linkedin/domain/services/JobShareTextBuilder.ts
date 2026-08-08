/**
 * JobShareTextBuilder — şirket sayfası gönderisinin metnini kurar (saf fonksiyon).
 *
 * LinkedIn gönderi metni ("commentary") 3000 karakterle sınırlıdır; açıklama
 * uzunsa kırpılır ve başvuru linki HER ZAMAN metnin sonunda kalır (link kaybı
 * ilanı işlevsiz bırakır).
 *
 * Metin ilanın dilinde kurulur — sabit-Türkçe yok, 4 dil de birinci sınıf.
 */
import type { JobPostingSnapshot } from '../entities/JobPostingSnapshot.js';

export type ShareLang = 'tr' | 'en' | 'de' | 'ar';

/** LinkedIn commentary sert sınırı. */
export const MAX_COMMENTARY_LENGTH = 3000;

interface ShareLabels {
  hiring: string;
  location: string;
  employmentType: string;
  apply: string;
  hashtags: string;
  employmentTypes: Record<string, string>;
}

const LABELS: Record<ShareLang, ShareLabels> = {
  tr: {
    hiring: 'Ekibimize katılacak yeni bir arkadaş arıyoruz',
    location: 'Konum',
    employmentType: 'Çalışma şekli',
    apply: 'Başvuru',
    hashtags: '#işilanı #kariyer #işealım',
    employmentTypes: {
      full_time: 'Tam Zamanlı',
      part_time: 'Kısmi Zamanlı',
      contract: 'Sözleşmeli',
      intern: 'Stajyer',
      freelance: 'Serbest Çalışan',
    },
  },
  en: {
    hiring: 'We are hiring',
    location: 'Location',
    employmentType: 'Employment type',
    apply: 'Apply',
    hashtags: '#hiring #jobs #careers',
    employmentTypes: {
      full_time: 'Full-time',
      part_time: 'Part-time',
      contract: 'Contract',
      intern: 'Internship',
      freelance: 'Freelance',
    },
  },
  de: {
    hiring: 'Wir stellen ein',
    location: 'Standort',
    employmentType: 'Beschäftigungsart',
    apply: 'Bewerbung',
    hashtags: '#Stellenangebot #Karriere #Jobs',
    employmentTypes: {
      full_time: 'Vollzeit',
      part_time: 'Teilzeit',
      contract: 'Befristet',
      intern: 'Praktikum',
      freelance: 'Freiberuflich',
    },
  },
  ar: {
    hiring: 'نبحث عن زميل جديد لفريقنا',
    location: 'الموقع',
    employmentType: 'نوع التوظيف',
    apply: 'التقديم',
    hashtags: '#وظائف #توظيف #مسيرة_مهنية',
    employmentTypes: {
      full_time: 'دوام كامل',
      part_time: 'دوام جزئي',
      contract: 'بعقد',
      intern: 'تدريب',
      freelance: 'عمل حر',
    },
  },
};

export function isShareLang(value: unknown): value is ShareLang {
  return value === 'tr' || value === 'en' || value === 'de' || value === 'ar';
}

/**
 * Metni `limit` karakterine kırpar; kelime ortasında kesmemek için son boşluğa
 * geri sarar ve üç nokta ekler.
 */
function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, Math.max(0, limit - 1));
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function buildShareCommentary(snapshot: JobPostingSnapshot, lang: ShareLang = 'tr'): string {
  const L = LABELS[lang];
  const head = `${L.hiring}: ${snapshot.title}`;

  const facts: string[] = [];
  if (snapshot.location !== null && snapshot.location !== '') {
    facts.push(`${L.location}: ${snapshot.location}`);
  }
  if (snapshot.employmentType !== null && snapshot.employmentType !== '') {
    const readable = L.employmentTypes[snapshot.employmentType] ?? snapshot.employmentType;
    facts.push(`${L.employmentType}: ${readable}`);
  }

  const tail: string[] = [];
  if (snapshot.applyUrl !== null && snapshot.applyUrl !== '') {
    tail.push(`${L.apply}: ${snapshot.applyUrl}`);
  }
  tail.push(L.hashtags);

  const fixed = [head, facts.join(' · '), tail.join('\n\n')].filter((s) => s !== '');
  // Açıklama dışındaki her şey sabit; kalan bütçeyi açıklamaya veriyoruz.
  const fixedLength = fixed.join('\n\n').length + 2;
  const budget = MAX_COMMENTARY_LENGTH - fixedLength;

  const description = snapshot.description.trim();
  const body = description === '' || budget <= 0 ? '' : truncate(description, budget);

  return [head, facts.join(' · '), body, tail.join('\n\n')].filter((s) => s !== '').join('\n\n');
}
