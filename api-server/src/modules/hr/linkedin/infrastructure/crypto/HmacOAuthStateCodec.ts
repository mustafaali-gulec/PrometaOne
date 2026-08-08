/**
 * HmacOAuthStateCodec — OAuth `state` parametresini HMAC-SHA256 ile imzalar.
 *
 * Format: base64url(JSON payload) + '.' + base64url(HMAC)
 *
 * Callback ucu auth'suz olduğu için companyId'nin kaynağı YALNIZCA bu imzadır.
 * Karşılaştırma `timingSafeEqual` ile yapılır (imza oracle'ı olmasın).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
  OAuthStateCodec,
  OAuthStatePayload,
} from '../../application/ports/OAuthStateCodec.js';
import { LinkedInAuthError } from '../../domain/errors/LinkedInErrors.js';

export class HmacOAuthStateCodec implements OAuthStateCodec {
  constructor(
    private readonly secret: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (secret.length < 16) {
      throw new Error('OAuth state imzalama sırrı en az 16 karakter olmalı');
    }
  }

  private mac(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }

  sign(payload: OAuthStatePayload): string {
    const body = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
    return `${body}.${this.mac(body)}`;
  }

  verify(state: string): OAuthStatePayload {
    const dot = state.lastIndexOf('.');
    if (dot <= 0) throw new LinkedInAuthError('state parametresi biçimsiz');

    const body = state.slice(0, dot);
    const provided = Buffer.from(state.slice(dot + 1), 'base64url');
    const expected = Buffer.from(this.mac(body), 'base64url');
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new LinkedInAuthError('state imzası doğrulanamadı');
    }

    let payload: OAuthStatePayload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as OAuthStatePayload;
    } catch {
      throw new LinkedInAuthError('state içeriği çözülemedi');
    }

    if (typeof payload.companyId !== 'number' || !Number.isInteger(payload.companyId)) {
      throw new LinkedInAuthError('state içinde geçerli şirket kimliği yok');
    }
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= this.now().getTime()) {
      throw new LinkedInAuthError('yetkilendirme oturumu zaman aşımına uğradı, tekrar deneyin');
    }
    return payload;
  }
}
