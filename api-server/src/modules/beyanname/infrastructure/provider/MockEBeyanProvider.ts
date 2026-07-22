/**
 * MockEBeyanProvider — ortam='mock' için ağsız, gerçekçi sahte GİB yanıtları.
 *
 * Geliştirme/demo: gönder → kontrol → onayla akışı gerçek GİB olmadan uçtan uca
 * denenebilir. Üretilen beyannameId zaman damgasına dayanır (tekil). Kontrol her
 * zaman hatasız, onay örnek tahakkuk döndürür.
 */
import type { BeyannameConfig, BeyannamePayload } from '../../application/dto/BeyannameDtos.js';
import type {
  EBeyanProvider,
  GibBeyannameListFilter,
  GibBeyannameListPage,
  GibResult,
  OnaylaRequest,
  PdfTuru,
  TopluKaydetRequest,
  VergiDairesi,
} from '../../application/ports/EBeyanProvider.js';

function ok<T>(data: T, success?: string): GibResult<T> {
  return {
    data,
    messages: success !== undefined ? { successMessages: [success] } : {},
    traceId: 'mock-trace',
  };
}

export class MockEBeyanProvider implements EBeyanProvider {
  readonly name = 'mock';

  baglantiTest(_config: BeyannameConfig): Promise<{ ok: boolean; message: string }> {
    return Promise.resolve({ ok: true, message: 'Mock GİB bağlantısı başarılı (test verisi)' });
  }

  topluKaydet(
    _config: BeyannameConfig,
    _request: TopluKaydetRequest,
  ): Promise<GibResult<{ beyannameId: string }>> {
    const id = `MOCK${Date.now()}`;
    return Promise.resolve(ok({ beyannameId: id }, 'Beyanname taslak olarak oluşturuldu (mock)'));
  }

  kismiEkle(
    _config: BeyannameConfig,
    beyannameId: string,
    _payload: BeyannamePayload,
  ): Promise<GibResult<unknown>> {
    return Promise.resolve(ok({ beyannameId }, 'Kayıtlar eklendi (mock)'));
  }

  kismiSil(
    _config: BeyannameConfig,
    beyannameId: string,
    sekmeAdi: string,
  ): Promise<GibResult<unknown>> {
    return Promise.resolve(ok({ beyannameId, sekmeAdi }, 'Sekme kayıtları silindi (mock)'));
  }

  kontrolEt(_config: BeyannameConfig, beyannameId: string): Promise<GibResult<unknown>> {
    return Promise.resolve(
      ok(
        { beyannameId, sekmeBilgisiList: [] },
        'Beyanname kontrolü tamamlandı, hata bulunamadı (mock)',
      ),
    );
  }

  onayla(_config: BeyannameConfig, request: OnaylaRequest): Promise<GibResult<unknown>> {
    return Promise.resolve(
      ok(
        {
          tahakkukOid: `MOCKTAH${Date.now()}`,
          tahakkukTutarlari: { odenecekKdv: '0.00' },
          fisListesi: [],
          beyannameId: request.beyannameId,
        },
        'Beyanname onaylandı (mock)',
      ),
    );
  }

  taslakDurumunaGetir(_config: BeyannameConfig, beyannameId: string): Promise<GibResult<unknown>> {
    return Promise.resolve(ok({ beyannameId }, 'Beyanname taslak durumuna getirildi (mock)'));
  }

  durumGetir(_config: BeyannameConfig, _beyannameId: string): Promise<GibResult<string>> {
    return Promise.resolve(ok('TASLAK'));
  }

  kanuniSureKontrolu(_config: BeyannameConfig, _beyannameId: string): Promise<GibResult<boolean>> {
    return Promise.resolve(ok(true));
  }

  ozelOnayGetir(_config: BeyannameConfig, _beyannameId: string): Promise<GibResult<unknown>> {
    return Promise.resolve(
      ok({
        duzeltmeBeyannamesiMi: false,
        yasalSuresiDisindaGonderim: false,
        izahUygunMu: false,
      }),
    );
  }

  pdfIndir(_config: BeyannameConfig, _beyannameId: string, _tur: PdfTuru): Promise<Buffer> {
    // Minimal geçerli boş PDF (mock).
    const minimalPdf =
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 100]>>endobj\n' +
      'trailer<</Root 1 0 R>>\n%%EOF';
    return Promise.resolve(Buffer.from(minimalPdf, 'utf-8'));
  }

  beyannameListele(
    _config: BeyannameConfig,
    filter: GibBeyannameListFilter,
  ): Promise<GibResult<GibBeyannameListPage>> {
    return Promise.resolve(
      ok<GibBeyannameListPage>({
        content: [],
        currentPage: filter.page ?? 0,
        totalItems: 0,
        totalPages: 0,
      }),
    );
  }

  vergiDairesiListesi(_config: BeyannameConfig): Promise<GibResult<VergiDairesi[]>> {
    return Promise.resolve(
      ok<VergiDairesi[]>([
        { kod: '006257', ad: 'Ankara / Başkent VD (mock)' },
        { kod: '034021', ad: 'İstanbul / Beyoğlu VD (mock)' },
      ]),
    );
  }

  kdvOranlari(_config: BeyannameConfig): Promise<GibResult<unknown>> {
    return Promise.resolve(ok([0, 0.01, 0.1, 0.2]));
  }
}
