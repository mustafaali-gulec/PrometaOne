/**
 * Beyanname persistence portları.
 *
 * Concrete impl: infrastructure/persistence/Pg*Repository.ts. Kimlik deposu
 * yalnızca şifreli blob görür (plaintext use-case'te CredentialCipher ile).
 */
import type {
  BeyannameDurum,
  BeyannamePayload,
  BeyannameRecord,
  CreateDeclarationInput,
  DonemBilgisi,
  ListDeclarationsFilter,
} from '../dto/BeyannameDtos.js';

import type { EncryptedCredential } from './CredentialCipher.js';

export interface SaveCredentialInput {
  companyId: number;
  encrypted: EncryptedCredential;
  createdBy?: number | null;
}

export interface BeyannameCredentialRepository {
  save(input: SaveCredentialInput): Promise<void>;
  getEncrypted(companyId: number): Promise<EncryptedCredential | null>;
  getMeta(companyId: number): Promise<{ isActive: boolean; updatedAt: Date } | null>;
  remove(companyId: number): Promise<void>;
}

/** Beyanname kaydına uygulanacak kısmi güncelleme (yalnız verilen alanlar). */
export interface BeyannamePatch {
  donem?: DonemBilgisi;
  vergiDairesiKod?: string | null;
  vergiDairesiAd?: string | null;
  duzeltmeMi?: boolean;
  durum?: BeyannameDurum;
  gibBeyannameId?: string | null;
  gibDurum?: string | null;
  payload?: BeyannamePayload;
  kontrolSonucu?: unknown;
  onaySonucu?: unknown;
  sonHata?: unknown;
}

export interface BeyannameLogEntry {
  companyId: number;
  beyannameId: number | null;
  islem: string;
  gibEndpoint?: string | null;
  httpStatus?: number | null;
  traceId?: string | null;
  mesajlar?: unknown;
  createdBy?: number | null;
}

export interface BeyannameRepository {
  list(companyId: number, filter: ListDeclarationsFilter): Promise<BeyannameRecord[]>;
  getById(companyId: number, id: number): Promise<BeyannameRecord | null>;
  create(input: CreateDeclarationInput): Promise<BeyannameRecord>;
  update(companyId: number, id: number, patch: BeyannamePatch): Promise<BeyannameRecord>;
  remove(companyId: number, id: number): Promise<void>;
  appendLog(entry: BeyannameLogEntry): Promise<void>;
}
