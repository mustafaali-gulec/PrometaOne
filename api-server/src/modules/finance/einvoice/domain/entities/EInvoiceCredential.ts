/**
 * EInvoiceCredential — bir şirketin bir entegratör için erişim bilgisi.
 *
 * Hassas alanlar (`config`) DB'ye AES-256-GCM ile şifreli yazılır
 * (CredentialCipher port'u). Entity yalnızca metadata + (gerektiğinde transient)
 * çözülmüş config taşır; persistence katmanı şifreli blob'u yönetir.
 */
import type { ProviderType } from '../valueObjects/ProviderType.js';

/** Entegratöre gönderilen düz (şifresiz) erişim konfigürasyonu. */
export interface CredentialConfig {
  username: string;
  password: string;
  /** Mükellef VKN'si. */
  vergiNo: string;
  env: 'test' | 'prod';
  wsdlUrl?: string;
  extras?: Record<string, string>;
}

export interface EInvoiceCredentialProps {
  id: number | null;
  companyId: number;
  provider: ProviderType;
  isActive: boolean;
  autoSyncEnabled: boolean;
  autoSyncCron: string;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
  lastSyncIncoming: number;
  lastSyncOutgoing: number;
  createdAt: Date;
  updatedAt: Date;
}

export class EInvoiceCredential {
  private constructor(private readonly props: EInvoiceCredentialProps) {}

  static create(props: EInvoiceCredentialProps): EInvoiceCredential {
    return new EInvoiceCredential(props);
  }

  get id(): number | null {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get provider(): ProviderType {
    return this.props.provider;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get autoSyncEnabled(): boolean {
    return this.props.autoSyncEnabled;
  }
  get autoSyncCron(): string {
    return this.props.autoSyncCron;
  }
  get lastSyncAt(): Date | null {
    return this.props.lastSyncAt;
  }
  get lastSyncStatus(): string | null {
    return this.props.lastSyncStatus;
  }

  withId(id: number): EInvoiceCredential {
    return new EInvoiceCredential({ ...this.props, id });
  }

  /** Sync sonucu metadata'sını günceller (yeni instance). */
  recordSync(
    result: { status: string; message: string | null; incoming: number; outgoing: number },
    now: Date,
  ): EInvoiceCredential {
    return new EInvoiceCredential({
      ...this.props,
      lastSyncAt: now,
      lastSyncStatus: result.status,
      lastSyncMessage: result.message,
      lastSyncIncoming: result.incoming,
      lastSyncOutgoing: result.outgoing,
      updatedAt: now,
    });
  }

  toJSON(): Omit<EInvoiceCredentialProps, 'createdAt' | 'updatedAt' | 'lastSyncAt'> & {
    createdAt: string;
    updatedAt: string;
    lastSyncAt: string | null;
  } {
    return {
      id: this.props.id,
      companyId: this.props.companyId,
      provider: this.props.provider,
      isActive: this.props.isActive,
      autoSyncEnabled: this.props.autoSyncEnabled,
      autoSyncCron: this.props.autoSyncCron,
      lastSyncStatus: this.props.lastSyncStatus,
      lastSyncMessage: this.props.lastSyncMessage,
      lastSyncIncoming: this.props.lastSyncIncoming,
      lastSyncOutgoing: this.props.lastSyncOutgoing,
      lastSyncAt: this.props.lastSyncAt ? this.props.lastSyncAt.toISOString() : null,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }
}
