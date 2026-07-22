/**
 * Beyanname domain hatası → HTTP status mapping.
 */
import { HTTPException } from 'hono/http-exception';

import {
  BeyannameNotFoundError,
  BeyannameStateError,
  BeyannameValidationError,
  CredentialDecryptError,
  CredentialsMissingError,
  GibAuthError,
  GibNotFoundError,
  GibUnexpectedError,
  GibValidationError,
} from '../domain/errors/BeyannameErrors.js';

export function mapBeyannameError(err: unknown): never {
  if (err instanceof BeyannameNotFoundError || err instanceof GibNotFoundError) {
    throw new HTTPException(404, { message: err.message });
  }
  if (err instanceof CredentialsMissingError) {
    throw new HTTPException(412, { message: err.message }); // Precondition Failed
  }
  if (err instanceof BeyannameStateError) {
    throw new HTTPException(409, { message: err.message });
  }
  if (err instanceof BeyannameValidationError || err instanceof CredentialDecryptError) {
    throw new HTTPException(400, { message: err.message });
  }
  if (err instanceof GibValidationError) {
    throw new HTTPException(422, {
      message: err.messages.length > 0 ? err.messages.join('; ') : err.message,
    });
  }
  if (err instanceof GibAuthError) {
    // Dış sistem kimlik/yetki reddi — 502 (bizim auth değil, GİB reddetti)
    throw new HTTPException(502, { message: err.message });
  }
  if (err instanceof GibUnexpectedError) {
    throw new HTTPException(502, { message: err.message });
  }
  throw err;
}
