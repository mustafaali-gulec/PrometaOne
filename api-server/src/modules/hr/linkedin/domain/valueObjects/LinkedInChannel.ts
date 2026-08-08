/**
 * LinkedInChannel — ilanın LinkedIn'e hangi yoldan gittiği.
 *
 *   share    Şirket sayfasına gönderi (Posts API + OAuth). Tam otomatik.
 *            LinkedIn'den "Community Management API" ürün onayı ister.
 *   feed     Public XML iş ilanı beslemesi. LinkedIn feed'i tarar ve GERÇEK
 *            native iş ilanı açar. Bizim tarafta anahtar gerekmez; feed URL'inin
 *            bir kez LinkedIn'e kaydettirilmesi yeterlidir.
 *   job_api  LinkedIn Job Posting API. Talent Solutions PARTNER onayı şart —
 *            onay yoksa bu kanal kullanılamaz (LinkedInChannelUnavailableError).
 */
import { InvalidLinkedInChannelError } from '../errors/LinkedInErrors.js';

export const ALL_LINKEDIN_CHANNELS = ['share', 'feed', 'job_api'] as const;

export type LinkedInChannel = (typeof ALL_LINKEDIN_CHANNELS)[number];

/** Bu sürümde gerçek bir sağlayıcı implementasyonu olan kanallar. */
export const IMPLEMENTED_LINKEDIN_CHANNELS: readonly LinkedInChannel[] = ['share', 'feed'];

export function isLinkedInChannel(value: unknown): value is LinkedInChannel {
  return typeof value === 'string' && (ALL_LINKEDIN_CHANNELS as readonly string[]).includes(value);
}

export function toLinkedInChannel(value: unknown): LinkedInChannel {
  if (!isLinkedInChannel(value)) throw new InvalidLinkedInChannelError(value);
  return value;
}

/** Bilinmeyenleri sessizce eleyip sırayı sabitler (DB TEXT[] okurken). */
export function normalizeChannels(values: readonly unknown[]): LinkedInChannel[] {
  const seen = new Set<LinkedInChannel>();
  for (const v of values) {
    if (isLinkedInChannel(v)) seen.add(v);
  }
  return ALL_LINKEDIN_CHANNELS.filter((c) => seen.has(c));
}
