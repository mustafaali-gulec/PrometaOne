/**
 * Cari (party) DTO'ları — bulk-import giriş/çıkış sözleşmeleri.
 */
export type PartyImportMode = 'merge' | 'only_new' | 'replace_all';

export interface PartyImportItemDto {
  /** Frontend cari id'si; yoksa backend üretir. */
  id?: string;
  code: string;
  name: string;
  type: string;
  personType?: string | null;
  taxId?: string | null;
  status?: string | null;
  /** Frontend'in tam cari objesi (risk, params, accounting, integration ...). */
  data?: Record<string, unknown> | null;
}

export interface BulkImportPartiesRequestDto {
  companyId: number;
  mode: PartyImportMode;
  parties: ReadonlyArray<PartyImportItemDto>;
}

export interface BulkImportPartiesResultDto {
  total: number;
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
}
