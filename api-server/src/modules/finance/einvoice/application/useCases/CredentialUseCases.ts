/**
 * Entegratör kimlik bilgisi use-case'leri: Save (şifreli), Test, Delete.
 */
import type {
  CredentialConfig,
  EInvoiceCredential,
} from '../../domain/entities/EInvoiceCredential.js';
import { EInvoiceCredentialNotFoundError } from '../../domain/errors/EInvoiceErrors.js';
import type { ProviderType } from '../../domain/valueObjects/ProviderType.js';
import type { CredentialCipher } from '../ports/CredentialCipher.js';
import type { EInvoiceProvider, ProviderTestResult } from '../ports/EInvoiceProvider.js';
import type { EInvoiceCredentialRepository } from '../ports/EInvoiceRepositories.js';

export interface SaveCredentialInput {
  companyId: number;
  provider: ProviderType;
  config: CredentialConfig;
  autoSyncEnabled?: boolean;
  autoSyncCron?: string;
  actorUserId: number | null;
}

export class SaveCredentialUseCase {
  constructor(
    private readonly credentials: EInvoiceCredentialRepository,
    private readonly cipher: CredentialCipher,
  ) {}

  async execute(input: SaveCredentialInput): Promise<EInvoiceCredential> {
    const encrypted = this.cipher.encrypt(input.config);
    return this.credentials.save({
      companyId: input.companyId,
      provider: input.provider,
      encrypted,
      ...(input.autoSyncEnabled !== undefined ? { autoSyncEnabled: input.autoSyncEnabled } : {}),
      ...(input.autoSyncCron !== undefined ? { autoSyncCron: input.autoSyncCron } : {}),
      createdBy: input.actorUserId,
    });
  }
}

export class TestConnectionUseCase {
  constructor(
    private readonly credentials: EInvoiceCredentialRepository,
    private readonly cipher: CredentialCipher,
    private readonly provider: EInvoiceProvider,
  ) {}

  async execute(input: { companyId: number; provider: ProviderType }): Promise<ProviderTestResult> {
    const encrypted = await this.credentials.getEncrypted(input.companyId, input.provider);
    if (encrypted === null) {
      throw new EInvoiceCredentialNotFoundError(input.companyId, input.provider);
    }
    const config = this.cipher.decrypt(encrypted);
    return this.provider.testConnection(config);
  }
}

export class DeleteCredentialUseCase {
  constructor(private readonly credentials: EInvoiceCredentialRepository) {}

  async execute(input: { companyId: number; provider: ProviderType }): Promise<void> {
    await this.credentials.remove(input.companyId, input.provider);
  }
}
