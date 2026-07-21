/**
 * UnregisterDevices — cihaz kaydı silme (soft: active=false).
 *
 * İki mod:
 *   - endpoint verilmişse: yalnız o endpoint pasife alınır.
 *   - endpoint yoksa: (username, provider) TOPLU deaktivasyon — FE'nin
 *     disablePush akışı yalnız { username, provider } yollar (web push
 *     unsubscribe sonrası eski endpoint'e erişim garantisi yoktur).
 *
 * Kimlik: token varsa username token'dan alınır (body ezilir).
 */
import type { PushProvider } from '../../domain/entities/PushDevice.js';
import type { PushDeviceRepository } from '../ports/PushDeviceRepository.js';

import { PushValidationError } from './RegisterDevice.js';

export interface UnregisterDevicesInput {
  /** Token'dan gelen kimlik (varsa body.username'i ezer). */
  auth?: { userId: number; username: string } | undefined;
  body: {
    username?: string | undefined;
    provider?: PushProvider | undefined;
    endpoint?: string | undefined;
  };
}

export interface UnregisterDevicesResult {
  removed: number;
}

export class UnregisterDevicesUseCase {
  constructor(private readonly repo: PushDeviceRepository) {}

  async execute(input: UnregisterDevicesInput): Promise<UnregisterDevicesResult> {
    if (input.body.endpoint) {
      const removed = await this.repo.deactivateByEndpoint(input.body.endpoint);
      return { removed };
    }

    const username = input.auth?.username ?? input.body.username?.trim();
    if (!username) {
      throw new PushValidationError('username zorunlu (token ya da gövdede)');
    }
    if (!input.body.provider) {
      throw new PushValidationError('endpoint ya da provider zorunlu');
    }

    const removed = await this.repo.deactivateByUsernameProvider(username, input.body.provider);
    return { removed };
  }
}
