/**
 * LinkedInPostStatus — kanal başına gönderim durumu.
 *
 *   pending    Kuyruğa alındı / gönderim sürüyor
 *   published  LinkedIn'de yayında (share: gönderi URN'i var; feed: XML'de listeleniyor)
 *   failed     Gönderim hata aldı (error_message dolu) — UI tekrar dene sunar
 *   removed    İlan kapatıldı, LinkedIn'den de çekildi
 */
import { InvalidLinkedInPostStatusError } from '../errors/LinkedInErrors.js';

export const ALL_LINKEDIN_POST_STATUSES = ['pending', 'published', 'failed', 'removed'] as const;

export type LinkedInPostStatus = (typeof ALL_LINKEDIN_POST_STATUSES)[number];

export function isLinkedInPostStatus(value: unknown): value is LinkedInPostStatus {
  return (
    typeof value === 'string' && (ALL_LINKEDIN_POST_STATUSES as readonly string[]).includes(value)
  );
}

export function toLinkedInPostStatus(value: unknown): LinkedInPostStatus {
  if (!isLinkedInPostStatus(value)) throw new InvalidLinkedInPostStatusError(value);
  return value;
}
