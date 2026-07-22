/**
 * EBeyanProvider — GİB e-Beyan REST API portu.
 *
 * Application katmanı HTTP detayını bilmez; yalnızca çözülmüş `BeyannameConfig`
 * ile bu porttan geçer. Concrete impl'ler:
 *  - infrastructure/provider/GibEBeyanProvider.ts (gerçek REST: test/prod)
 *  - infrastructure/provider/MockEBeyanProvider.ts (ortam='mock', ağsız demo)
 *
 * Tüm metotlar GİB RestResponse zarfını açar; hata durumunda domain hatası
 * (GibAuthError / GibValidationError / GibNotFoundError / GibUnexpectedError)
 * fırlatır.
 */
import type {
  BeyannameConfig,
  BeyannamePayload,
  DonemBilgisi,
  DuzenleyenBilgisi,
  OzelOnaySecim,
  SifatBilgisi,
} from '../dto/BeyannameDtos.js';

/** GİB yanıt zarfındaki mesaj grupları. */
export interface GibMessages {
  successMessages?: string[];
  errorMessages?: string[];
  warningMessages?: string[];
  infoMessages?: string[];
}

/** Açılmış GİB RestResponse: veri + mesajlar + traceId. */
export interface GibResult<T> {
  data: T;
  messages: GibMessages;
  traceId?: string;
}

/** GİB /kdv1/beyanname/toplu isteğinin çözülmüş gövdesi. */
export interface TopluKaydetRequest {
  idariBilgiler: { donem: DonemBilgisi; vergiDairesi: { kod: string } };
  sifat: SifatBilgisi;
  duzenleyen: DuzenleyenBilgisi;
  duzeltmeMi: boolean;
  matrah?: Record<string, unknown>;
  indirimler?: Record<string, unknown>;
  istisnalar?: Record<string, unknown>;
  ihracKaydiylaTeslimler?: Record<string, unknown>;
  ekler?: Record<string, unknown>;
  sonucHesaplari?: Record<string, unknown>;
}

export interface OnaylaRequest {
  beyannameId: string;
  ozelOnaySecim?: OzelOnaySecim;
  ozelOnayDetay?: Record<string, unknown>;
  duzeltmeAciklama?: string;
}

/** GİB'deki beyanname özet satırı (kullanici API listesi). */
export interface GibBeyannameSummary {
  beyannameId: string;
  mukellefUnvan?: string;
  mukellefVkn?: string;
  vdKod?: string;
  vdAd?: string;
  beyannameTuru?: string;
  donemBaslangicTarih?: string;
  donemBitisTarih?: string;
  islemTarihi?: string;
  beyannameDurum?: string;
  tahakkukOid?: string;
}

export interface GibBeyannameListPage {
  content: GibBeyannameSummary[];
  currentPage: number;
  totalItems: number;
  totalPages: number;
}

export interface GibBeyannameListFilter {
  beyannameTuru?: string[];
  beyannameDurum?: string[];
  page?: number;
  size?: number;
}

export interface VergiDairesi {
  kod: string;
  ad: string;
}

export type PdfTuru = 'beyanname' | 'tahakkuk' | 'ihbarname' | 'hatali';

export interface EBeyanProvider {
  readonly name: string;

  baglantiTest(config: BeyannameConfig): Promise<{ ok: boolean; message: string }>;

  // --- KDV1 yaşam döngüsü ---
  topluKaydet(
    config: BeyannameConfig,
    request: TopluKaydetRequest,
  ): Promise<GibResult<{ beyannameId: string }>>;
  kismiEkle(
    config: BeyannameConfig,
    beyannameId: string,
    payload: BeyannamePayload,
  ): Promise<GibResult<unknown>>;
  kismiSil(
    config: BeyannameConfig,
    beyannameId: string,
    sekmeAdi: string,
  ): Promise<GibResult<unknown>>;
  kontrolEt(config: BeyannameConfig, beyannameId: string): Promise<GibResult<unknown>>;
  onayla(config: BeyannameConfig, request: OnaylaRequest): Promise<GibResult<unknown>>;
  taslakDurumunaGetir(config: BeyannameConfig, beyannameId: string): Promise<GibResult<unknown>>;
  durumGetir(config: BeyannameConfig, beyannameId: string): Promise<GibResult<string>>;
  kanuniSureKontrolu(config: BeyannameConfig, beyannameId: string): Promise<GibResult<boolean>>;
  ozelOnayGetir(config: BeyannameConfig, beyannameId: string): Promise<GibResult<unknown>>;
  pdfIndir(config: BeyannameConfig, beyannameId: string, tur: PdfTuru): Promise<Buffer>;

  // --- Referans / listeleme (kullanici API) ---
  beyannameListele(
    config: BeyannameConfig,
    filter: GibBeyannameListFilter,
  ): Promise<GibResult<GibBeyannameListPage>>;
  vergiDairesiListesi(config: BeyannameConfig): Promise<GibResult<VergiDairesi[]>>;
  kdvOranlari(config: BeyannameConfig): Promise<GibResult<unknown>>;
}
