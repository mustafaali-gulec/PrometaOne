/**
 * GibEBeyanProvider — GİB e-Beyan REST API'sinin gerçek (test/prod) adapter'ı.
 *
 * Ortam bazlı base URL (test: ebeyanpreprodapi, prod: ebeyanapi); path prefix
 * /kdv1 (KDV1 yaşam döngüsü) ve /kullanici (listeleme). Her istekte zorunlu
 * header'lar kurulur: Authorization Bearer + CHANNEL: ENTEGRATOR + MUKELLEF-VKN
 * + ENTEGRATOR ("VKN-Ünvan"). RestResponse zarfı açılır; hata durumunda domain
 * hatası (GibAuthError/GibValidationError/GibNotFoundError/GibUnexpectedError).
 *
 * fetchFn enjekte edilebilir (test); varsayılan globalThis.fetch. Her çağrı
 * AbortController ile 60 sn timeout.
 */
import type { BeyannameConfig, BeyannamePayload } from '../../application/dto/BeyannameDtos.js';
import type {
  EBeyanProvider,
  GibBeyannameListFilter,
  GibBeyannameListPage,
  GibMessages,
  GibResult,
  OnaylaRequest,
  PdfTuru,
  TopluKaydetRequest,
  VergiDairesi,
} from '../../application/ports/EBeyanProvider.js';
import {
  GibAuthError,
  GibNotFoundError,
  GibUnexpectedError,
  GibValidationError,
} from '../../domain/errors/BeyannameErrors.js';

const BASE_URLS: Record<'test' | 'prod', string> = {
  test: 'https://ebeyanpreprodapi.gib.gov.tr',
  prod: 'https://ebeyanapi.gib.gov.tr',
};

const PDF_PATHS: Record<PdfTuru, string> = {
  beyanname: '/kdv1/beyanname/pdf',
  tahakkuk: '/kdv1/beyanname/pdf/tahakkuk',
  ihbarname: '/kdv1/beyanname/pdf/ihbarname',
  hatali: '/kdv1/beyanname/pdf/hatali',
};

type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

interface RestEnvelope {
  data?: unknown;
  messages?: GibMessages;
  traceId?: string;
}

export class GibEBeyanProvider implements EBeyanProvider {
  readonly name = 'gib';

  constructor(private readonly options: { fetchFn?: FetchLike; timeoutMs?: number } = {}) {}

  private get timeoutMs(): number {
    return this.options.timeoutMs ?? 60_000;
  }

  private baseUrl(config: BeyannameConfig): string {
    if (config.ortam === 'prod') return BASE_URLS.prod;
    return BASE_URLS.test;
  }

  private headers(config: BeyannameConfig): Record<string, string> {
    return {
      Authorization: `Bearer ${config.apiKey}`,
      CHANNEL: 'ENTEGRATOR',
      'MUKELLEF-VKN': config.mukellefVkn,
      ENTEGRATOR: `${config.entegratorVkn}-${config.entegratorUnvan}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /** Ortak çağrı: header kur, JSON parse, RestResponse zarfını aç, hata eşle. */
  private async callJson<T>(
    config: BeyannameConfig,
    method: string,
    apiPath: string,
    opts: { body?: unknown; query?: Record<string, string | number | undefined> } = {},
  ): Promise<GibResult<T>> {
    const fetchFn: FetchLike = this.options.fetchFn ?? globalThis.fetch;
    const url = new URL(this.baseUrl(config) + apiPath);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Awaited<ReturnType<FetchLike>>;
    let raw = '';
    try {
      res = await fetchFn(url.toString(), {
        method,
        headers: this.headers(config),
        ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
        signal: controller.signal,
      });
      raw = await res.text();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new GibUnexpectedError(`${method} ${apiPath}: ${reason}`);
    } finally {
      clearTimeout(timer);
    }

    let env: RestEnvelope = {};
    if (raw.length > 0) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        // Zarf {data,messages,traceId} olabilir; düz değer de olabilir.
        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed) &&
          ('data' in parsed || 'messages' in parsed || 'traceId' in parsed)
        ) {
          env = parsed as RestEnvelope;
        } else {
          env = { data: parsed };
        }
      } catch {
        env = { data: raw };
      }
    }
    const messages = env.messages ?? {};

    if (!res.ok) {
      const msg = pickErrorMessage(messages, raw, res.status, res.statusText);
      const errMsgs = messages.errorMessages ?? [];
      if (res.status === 401 || res.status === 403) throw new GibAuthError(msg);
      if (res.status === 404) throw new GibNotFoundError(msg);
      if (res.status === 400 || res.status === 422) throw new GibValidationError(msg, errMsgs);
      throw new GibUnexpectedError(`${res.status} ${res.statusText}: ${msg}`);
    }

    return {
      data: env.data as T,
      messages,
      ...(env.traceId !== undefined ? { traceId: env.traceId } : {}),
    };
  }

  async baglantiTest(config: BeyannameConfig): Promise<{ ok: boolean; message: string }> {
    try {
      await this.callJson<VergiDairesi[]>(config, 'GET', '/kullanici/common/vergi-dairesi');
      return { ok: true, message: 'GİB e-Beyan bağlantısı başarılı' };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  topluKaydet(
    config: BeyannameConfig,
    request: TopluKaydetRequest,
  ): Promise<GibResult<{ beyannameId: string }>> {
    return this.callJson<{ beyannameId: string }>(config, 'POST', '/kdv1/beyanname/toplu', {
      body: request,
    });
  }

  kismiEkle(
    config: BeyannameConfig,
    beyannameId: string,
    payload: BeyannamePayload,
  ): Promise<GibResult<unknown>> {
    return this.callJson(config, 'POST', '/kdv1/beyanname/toplu/kismiEkle', {
      body: { beyannameId, ...payload },
    });
  }

  kismiSil(
    config: BeyannameConfig,
    beyannameId: string,
    sekmeAdi: string,
  ): Promise<GibResult<unknown>> {
    return this.callJson(config, 'POST', '/kdv1/beyanname/toplu/kismiSil', {
      body: { beyannameId, sekmeAdi },
    });
  }

  kontrolEt(config: BeyannameConfig, beyannameId: string): Promise<GibResult<unknown>> {
    return this.callJson(config, 'PATCH', '/kdv1/beyanname/toplu/kontrolEt', {
      body: { beyannameId },
    });
  }

  onayla(config: BeyannameConfig, request: OnaylaRequest): Promise<GibResult<unknown>> {
    return this.callJson(config, 'PATCH', '/kdv1/beyanname/toplu/onayla', { body: request });
  }

  taslakDurumunaGetir(config: BeyannameConfig, beyannameId: string): Promise<GibResult<unknown>> {
    return this.callJson(config, 'POST', '/kdv1/beyanname/toplu/taslakDurumunaGetir', {
      body: { beyannameId },
    });
  }

  durumGetir(config: BeyannameConfig, beyannameId: string): Promise<GibResult<string>> {
    return this.callJson<string>(config, 'GET', '/kdv1/beyanname/durum', {
      query: { beyannameId },
    });
  }

  kanuniSureKontrolu(config: BeyannameConfig, beyannameId: string): Promise<GibResult<boolean>> {
    return this.callJson<boolean>(config, 'GET', '/kdv1/beyanname/kanuniSureKontrolu', {
      query: { beyannameId },
    });
  }

  ozelOnayGetir(config: BeyannameConfig, beyannameId: string): Promise<GibResult<unknown>> {
    return this.callJson(config, 'GET', '/kdv1/ozelOnay', { query: { beyannameId } });
  }

  async pdfIndir(config: BeyannameConfig, beyannameId: string, tur: PdfTuru): Promise<Buffer> {
    const fetchFn: FetchLike = this.options.fetchFn ?? globalThis.fetch;
    const url = new URL(this.baseUrl(config) + PDF_PATHS[tur]);
    url.searchParams.set('beyannameId', beyannameId);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetchFn(url.toString(), {
        method: 'GET',
        headers: this.headers(config),
        signal: controller.signal,
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403)
          throw new GibAuthError('PDF erişimi reddedildi');
        if (res.status === 404) throw new GibNotFoundError(`PDF bulunamadı: ${beyannameId}`);
        throw new GibUnexpectedError(`PDF ${res.status} ${res.statusText}`);
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (
        err instanceof GibAuthError ||
        err instanceof GibNotFoundError ||
        err instanceof GibUnexpectedError
      ) {
        throw err;
      }
      throw new GibUnexpectedError(err instanceof Error ? err.message : String(err));
    } finally {
      clearTimeout(timer);
    }
  }

  beyannameListele(
    config: BeyannameConfig,
    filter: GibBeyannameListFilter,
  ): Promise<GibResult<GibBeyannameListPage>> {
    return this.callJson<GibBeyannameListPage>(config, 'POST', '/kullanici/beyanname/mukellef', {
      body: {
        beyannameTuru: filter.beyannameTuru ?? ['KDV1'],
        ...(filter.beyannameDurum !== undefined ? { beyannameDurum: filter.beyannameDurum } : {}),
        page: filter.page ?? 0,
        size: filter.size ?? 20,
      },
    });
  }

  vergiDairesiListesi(config: BeyannameConfig): Promise<GibResult<VergiDairesi[]>> {
    return this.callJson<VergiDairesi[]>(config, 'GET', '/kullanici/common/vergi-dairesi');
  }

  kdvOranlari(config: BeyannameConfig): Promise<GibResult<unknown>> {
    return this.callJson(config, 'GET', '/kdv1/kdvOrani');
  }
}

function pickErrorMessage(
  messages: GibMessages,
  raw: string,
  status: number,
  statusText: string,
): string {
  const errs = messages.errorMessages;
  if (errs && errs.length > 0) return errs.join('; ');
  if (raw.length > 0 && raw.length < 500) return raw;
  return `${status} ${statusText}`;
}
