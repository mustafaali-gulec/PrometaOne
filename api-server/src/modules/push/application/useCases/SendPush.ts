/**
 * SendPush — bildirimi hedef cihazlara gönderir.
 *
 * Hedef seçimi:
 *   - `devices` verilmişse: istekteki endpoint'ler push_devices'ta KAYITLI ve
 *     AKTİF olanlarla KESİŞTİRİLİR — keyfi endpoint'e relay engeli. İstemcinin
 *     yolladığı keys değil, DB'deki kayıtlı keys kullanılır.
 *   - `devices` yoksa: `username`'in (o da yoksa çağıranın) aktif cihazları.
 *
 * Sonuç işleme:
 *   - gone (HTTP 404/410) → cihaz pasife alınır (active=false).
 *   - başarı → last_used_at güncellenir.
 *
 * Dönüş: { success, sent, failed } — success: en az bir cihaza ulaşıldı.
 */
import type { PushDevice, PushKeys, PushProvider } from '../../domain/entities/PushDevice.js';
import type { PushDeviceRepository } from '../ports/PushDeviceRepository.js';
import type { PushPayload, PushSender } from '../ports/PushSender.js';

export interface SendPushInput {
  /** Çağıranın kimliği (authMiddleware zorunlu → hep var). */
  auth: { userId: number; username: string };
  notification: PushPayload;
  /** Hedef cihaz aday listesi (FE hrPushDevices'tan yollar). */
  devices?:
    | Array<{
        provider: PushProvider;
        endpoint: string;
        keys?: PushKeys | undefined;
      }>
    | undefined;
  /** devices yoksa bu kullanıcının aktif cihazları hedeflenir. */
  username?: string | undefined;
}

export interface SendPushResult {
  success: boolean;
  sent: number;
  failed: number;
}

export class SendPushUseCase {
  constructor(
    private readonly repo: PushDeviceRepository,
    private readonly sender: PushSender,
  ) {}

  async execute(input: SendPushInput): Promise<SendPushResult> {
    const targets = await this.resolveTargets(input);

    let sent = 0;
    let failed = 0;
    const delivered: string[] = [];

    for (const device of targets) {
      const result = await this.sender.send(device, input.notification);
      if (result.ok) {
        sent += 1;
        delivered.push(device.endpoint);
      } else {
        failed += 1;
        if (result.gone) {
          await this.repo.deactivateByEndpoint(device.endpoint);
        }
      }
    }

    if (delivered.length > 0) {
      await this.repo.touchLastUsed(delivered);
    }

    return { success: sent > 0, sent, failed };
  }

  private async resolveTargets(input: SendPushInput): Promise<PushDevice[]> {
    if (input.devices !== undefined) {
      // Relay engeli: yalnız kayıtlı + aktif endpoint'lerle kesişim.
      // Boş liste = açıkça sıfır hedef (çağıranın cihazlarına DÜŞÜLMEZ).
      const requested = new Set(input.devices.map((d) => d.endpoint));
      const known = await this.repo.findByEndpoints([...requested]);
      return known.filter((d) => d.active && requested.has(d.endpoint));
    }

    const username = input.username?.trim() || input.auth.username;
    return this.repo.findActiveByUsername(username);
  }
}
