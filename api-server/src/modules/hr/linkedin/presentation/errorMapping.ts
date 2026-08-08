/**
 * LinkedIn entegrasyonu error → HTTP status mapping.
 *
 * Dış sistem (LinkedIn REST) hataları 502 döner — 500 değil; böylece izleme
 * tarafında "bizim hatamız" ile "LinkedIn'in hatası" ayrışır.
 */
import { HTTPException } from 'hono/http-exception';

import {
  InvalidFeedTokenError,
  InvalidLinkedInChannelError,
  InvalidLinkedInPostStatusError,
  InvalidOrganizationUrnError,
  JobPostingFeedEntryNotFoundError,
  JobPostingNotPublishableError,
  LinkedInApiError,
  LinkedInAuthError,
  LinkedInChannelUnavailableError,
  LinkedInConnectionNotFoundError,
  LinkedInCredentialDecryptError,
  LinkedInNotConnectedError,
  LinkedInOrganizationNotSelectedError,
  LinkedInTokenExpiredError,
} from '../domain/errors/LinkedInErrors.js';

export function mapLinkedInError(err: unknown): never {
  if (
    err instanceof LinkedInConnectionNotFoundError ||
    err instanceof JobPostingFeedEntryNotFoundError
  ) {
    throw new HTTPException(404, { message: err.message });
  }

  // Kurulum eksik / süresi dolmuş — kullanıcı eyleme dönüştürebilir (409),
  // 401 DEĞİL: 401 istemcide oturum yenileme akışını tetikler, alakasız.
  if (
    err instanceof LinkedInNotConnectedError ||
    err instanceof LinkedInTokenExpiredError ||
    err instanceof LinkedInOrganizationNotSelectedError ||
    err instanceof LinkedInCredentialDecryptError ||
    err instanceof LinkedInChannelUnavailableError
  ) {
    throw new HTTPException(409, { message: err.message });
  }

  if (
    err instanceof InvalidLinkedInChannelError ||
    err instanceof InvalidLinkedInPostStatusError ||
    err instanceof InvalidOrganizationUrnError ||
    err instanceof InvalidFeedTokenError ||
    err instanceof JobPostingNotPublishableError
  ) {
    throw new HTTPException(400, { message: err.message });
  }

  if (err instanceof LinkedInAuthError || err instanceof LinkedInApiError) {
    throw new HTTPException(502, { message: err.message });
  }

  throw err;
}
