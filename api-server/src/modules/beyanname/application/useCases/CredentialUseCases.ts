/**
 * BeyannameCredentialService — e-Beyan entegrasyon kimliği CRUD + bağlantı testi.
 *
 * GET tarafı apiKey'i ASLA düz metin döndürmez (maskeli). Şifre çözme yalnız
 * burada (repo şifresiz görmez). Provider ortam'a göre seçilir (mock/test/prod).
 */
import { CredentialsMissingError } from '../../domain/errors/BeyannameErrors.js';
import type { BeyannameConfig, BeyannameOrtam, MaskedCredential } from '../dto/BeyannameDtos.js';
import type { BeyannameCredentialRepository } from '../ports/BeyannameRepositories.js';
import type { CredentialCipher } from '../ports/CredentialCipher.js';
import type { EBeyanProvider } from '../ports/EBeyanProvider.js';

export type ProviderFactory = (ortam: BeyannameOrtam) => EBeyanProvider;

/** Şifreli kimliği çöz; yoksa CredentialsMissingError. */
export async function resolveConfig(
  repo: BeyannameCredentialRepository,
  cipher: CredentialCipher,
  companyId: number,
): Promise<BeyannameConfig> {
  const blob = await repo.getEncrypted(companyId);
  if (blob === null) throw new CredentialsMissingError(companyId);
  return cipher.decrypt(blob);
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 4) return '****';
  return `****${apiKey.slice(-4)}`;
}

export class BeyannameCredentialService {
  constructor(
    private readonly repo: BeyannameCredentialRepository,
    private readonly cipher: CredentialCipher,
    private readonly providerFor: ProviderFactory,
  ) {}

  async save(input: {
    companyId: number;
    config: BeyannameConfig;
    createdBy?: number | null;
  }): Promise<void> {
    const encrypted = this.cipher.encrypt(input.config);
    await this.repo.save({
      companyId: input.companyId,
      encrypted,
      ...(input.createdBy !== undefined ? { createdBy: input.createdBy } : {}),
    });
  }

  async getMasked(companyId: number): Promise<MaskedCredential | null> {
    const meta = await this.repo.getMeta(companyId);
    if (meta === null) return null;
    const blob = await this.repo.getEncrypted(companyId);
    if (blob === null) return null;
    const config = this.cipher.decrypt(blob);
    return {
      ortam: config.ortam,
      entegratorVkn: config.entegratorVkn,
      entegratorUnvan: config.entegratorUnvan,
      mukellefVkn: config.mukellefVkn,
      sifat: config.sifat,
      duzenleyen: config.duzenleyen,
      apiKeyMask: maskApiKey(config.apiKey),
      isActive: meta.isActive,
      updatedAt: meta.updatedAt.toISOString(),
    };
  }

  async delete(companyId: number): Promise<void> {
    await this.repo.remove(companyId);
  }

  async testConnection(companyId: number): Promise<{ ok: boolean; message: string }> {
    const config = await resolveConfig(this.repo, this.cipher, companyId);
    return this.providerFor(config.ortam).baglantiTest(config);
  }
}
