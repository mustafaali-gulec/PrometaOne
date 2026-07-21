/**
 * RegisterDevice — cihaz/abonelik kaydı (upsert).
 *
 * Kimlik: token'daki username (auth) her zaman body kimliğini EZER; token
 * yoksa body.username kullanılır; ikisi de yoksa doğrulama hatası (route 400).
 * Aynı endpoint yeniden kaydedilirse ON CONFLICT ile mevcut satır yeniden
 * aktive edilir (deviceId mevcut kaydınki döner).
 */
import { randomUUID } from 'node:crypto';

import type { PushKeys, PushPlatform, PushProvider } from '../../domain/entities/PushDevice.js';
import type { PushDeviceRepository } from '../ports/PushDeviceRepository.js';

/** Route katmanında 400'e map edilir. */
export class PushValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PushValidationError';
  }
}

export interface RegisterDeviceInput {
  /** Token'dan gelen kimlik (varsa body'yi ezer). */
  auth?: { userId: number; username: string } | undefined;
  body: {
    id?: string | undefined;
    userId?: string | undefined;
    username?: string | undefined;
    platform?: PushPlatform | undefined;
    provider: PushProvider;
    endpoint: string;
    keys?: PushKeys | undefined;
    userAgent?: string | undefined;
    bundleId?: string | undefined;
  };
}

export interface RegisterDeviceResult {
  deviceId: string;
}

export class RegisterDeviceUseCase {
  constructor(private readonly repo: PushDeviceRepository) {}

  async execute(input: RegisterDeviceInput): Promise<RegisterDeviceResult> {
    const username = input.auth?.username ?? input.body.username?.trim();
    if (!username) {
      throw new PushValidationError('username zorunlu (token ya da gövdede)');
    }

    const userId =
      input.auth !== undefined ? String(input.auth.userId) : (input.body.userId ?? null);

    const device = await this.repo.upsertByEndpoint({
      id: input.body.id ?? `dev_${randomUUID()}`,
      userId,
      username,
      platform: input.body.platform ?? 'web',
      provider: input.body.provider,
      endpoint: input.body.endpoint,
      keys: input.body.keys ?? null,
      userAgent: input.body.userAgent ?? null,
      bundleId: input.body.bundleId ?? null,
    });

    return { deviceId: device.id };
  }
}
