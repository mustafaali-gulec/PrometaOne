/**
 * Beyanname modülü DTO / veri tipleri.
 *
 * Para alanları GİB e-Beyan sözleşmesi gereği STRING taşınır ("100.5" = 100 TL
 * 50 kr). KDV/tevkifat oranları double ("0.2" = %20). Enum'lar KDV1_XXX kod
 * biçimindedir. payload bölümleri frontend'den geçirilir (passthrough).
 */

/** Şifreli saklanan entegrasyon config'i (apiKey dahil). */
export interface BeyannameConfig {
  apiKey: string;
  ortam: BeyannameOrtam;
  entegratorVkn: string;
  entegratorUnvan: string;
  mukellefVkn: string;
  sifat: SifatBilgisi;
  duzenleyen: DuzenleyenBilgisi;
}

export type BeyannameOrtam = 'test' | 'prod' | 'mock';

export interface SifatBilgisi {
  tip: 'MUKELLEF' | 'MIRASCI' | 'KANUNI_TEMSILCI';
  adSoyadUnvan: string;
  tckn?: string;
  vkn?: string;
  eposta: string;
  telefon: string;
}

export interface DuzenleyenBilgisi {
  tckn?: string;
  vkn?: string;
  adSoyadUnvan: string;
  eposta: string;
  telefon: string;
}

/** GET /credentials — apiKey maskeli döner (asla düz metin sızmaz). */
export interface MaskedCredential {
  ortam: BeyannameOrtam;
  entegratorVkn: string;
  entegratorUnvan: string;
  mukellefVkn: string;
  sifat: SifatBilgisi;
  duzenleyen: DuzenleyenBilgisi;
  apiKeyMask: string; // '****' + son 4 hane; hiç key yoksa ''
  isActive: boolean;
  updatedAt: string | null;
}

export type BeyannameDurum = 'taslak' | 'gonderildi' | 'kontrol_edildi' | 'onaylandi' | 'hatali';

/** Beyannamenin dönem bilgisi (GİB DonemCommandV40). */
export interface DonemBilgisi {
  tip: 'AYLIK' | 'UC_AYLIK';
  yil: number;
  ay: string; // OCAK..ARALIK
}

/**
 * KDV1 beyanname veri bölümleri — GİB toplu request bölümleri (passthrough).
 * Sınır (route zValidator) tipiyle uyum için alanlar açıkça `| undefined`.
 */
export interface BeyannamePayload {
  matrah?: Record<string, unknown> | undefined;
  indirimler?: Record<string, unknown> | undefined;
  istisnalar?: Record<string, unknown> | undefined;
  ihracKaydiylaTeslimler?: Record<string, unknown> | undefined;
  ekler?: Record<string, unknown> | undefined;
  sonucHesaplari?: Record<string, unknown> | undefined;
}

/** Lokal beyanname kaydı (DB satırının camelCase görünümü). */
export interface BeyannameRecord {
  id: number;
  companyId: number;
  tur: string; // 'KDV1'
  donem: DonemBilgisi;
  vergiDairesiKod: string | null;
  vergiDairesiAd: string | null;
  duzeltmeMi: boolean;
  durum: BeyannameDurum;
  gibBeyannameId: string | null;
  gibDurum: string | null;
  payload: BeyannamePayload;
  kontrolSonucu: unknown;
  onaySonucu: unknown;
  sonHata: unknown;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeclarationInput {
  companyId: number;
  tur?: string;
  donem: DonemBilgisi;
  vergiDairesiKod?: string | null;
  vergiDairesiAd?: string | null;
  duzeltmeMi?: boolean;
  payload?: BeyannamePayload;
  createdBy?: number | null;
}

export interface UpdateDeclarationInput {
  donem?: DonemBilgisi;
  vergiDairesiKod?: string | null;
  vergiDairesiAd?: string | null;
  duzeltmeMi?: boolean;
  payload?: BeyannamePayload;
}

export interface ListDeclarationsFilter {
  durum?: BeyannameDurum;
  yil?: number;
}

/** GİB özel onay seçimi (kanuni süre dışı onay). */
export interface OzelOnaySecim {
  kanuniSuresindenSonra?: boolean | undefined;
  pismanlikTalebi?: boolean | undefined;
  izah?: boolean | undefined;
  ihtiraziKayit?: boolean | undefined;
}
