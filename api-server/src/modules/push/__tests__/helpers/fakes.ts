/**
 * Push testleri için in-memory repo + fake sender.
 */
import type {
  PushDeviceRepository,
  UpsertDeviceInput,
} from '../../application/ports/PushDeviceRepository.js';
import type {
  PushPayload,
  PushSender,
  PushSendResult,
} from '../../application/ports/PushSender.js';
import type { PushDevice, PushProvider } from '../../domain/entities/PushDevice.js';

export class InMemoryPushDeviceRepository implements PushDeviceRepository {
  devices: PushDevice[] = [];
  /** touchLastUsed ile işaretlenen endpoint'ler (assert için). */
  touched: string[] = [];

  seed(partial: Partial<PushDevice> & { endpoint: string; username: string }): PushDevice {
    const device: PushDevice = {
      id: partial.id ?? `dev_${this.devices.length + 1}`,
      userId: partial.userId ?? null,
      username: partial.username,
      platform: partial.platform ?? 'web',
      provider: partial.provider ?? 'web_push',
      endpoint: partial.endpoint,
      keys: partial.keys ?? { p256dh: 'p', auth: 'a' },
      userAgent: partial.userAgent ?? null,
      bundleId: partial.bundleId ?? null,
      registeredAt: partial.registeredAt ?? new Date('2026-07-01T00:00:00Z'),
      lastUsedAt: partial.lastUsedAt ?? new Date('2026-07-01T00:00:00Z'),
      active: partial.active ?? true,
    };
    this.devices.push(device);
    return device;
  }

  async upsertByEndpoint(input: UpsertDeviceInput): Promise<PushDevice> {
    const existing = this.devices.find((d) => d.endpoint === input.endpoint);
    if (existing) {
      existing.active = true;
      existing.lastUsedAt = new Date();
      existing.keys = input.keys;
      existing.userAgent = input.userAgent;
      existing.username = input.username;
      existing.userId = input.userId;
      return existing;
    }
    return this.seed({
      id: input.id,
      userId: input.userId,
      username: input.username,
      platform: input.platform,
      provider: input.provider,
      endpoint: input.endpoint,
      keys: input.keys,
      userAgent: input.userAgent,
      bundleId: input.bundleId,
      active: true,
    });
  }

  async deactivateByUsernameProvider(username: string, provider?: PushProvider): Promise<number> {
    let n = 0;
    for (const d of this.devices) {
      if (
        d.username === username &&
        (provider === undefined || d.provider === provider) &&
        d.active
      ) {
        d.active = false;
        n += 1;
      }
    }
    return n;
  }

  async deactivateByEndpoint(endpoint: string): Promise<number> {
    let n = 0;
    for (const d of this.devices) {
      if (d.endpoint === endpoint && d.active) {
        d.active = false;
        n += 1;
      }
    }
    return n;
  }

  async findActiveByUsername(username: string): Promise<PushDevice[]> {
    return this.devices.filter((d) => d.username === username && d.active);
  }

  async findByEndpoints(endpoints: string[]): Promise<PushDevice[]> {
    const set = new Set(endpoints);
    return this.devices.filter((d) => set.has(d.endpoint));
  }

  async touchLastUsed(endpoints: string[]): Promise<void> {
    this.touched.push(...endpoints);
  }
}

export class FakePushSender implements PushSender {
  sent: Array<{ device: PushDevice; payload: PushPayload }> = [];
  /** endpoint → sonuç; kayıt yoksa { ok: true }. */
  results = new Map<string, PushSendResult>();

  async send(device: PushDevice, payload: PushPayload): Promise<PushSendResult> {
    this.sent.push({ device, payload });
    return this.results.get(device.endpoint) ?? { ok: true };
  }
}
