/**
 * GibEBeyanProvider testleri — header kurulumu, RestResponse zarf açma, hata
 * eşleme, ortam bazlı base URL, PDF binary. fetchFn mock enjekte edilir.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { BeyannameConfig } from '../../application/dto/BeyannameDtos.js';
import {
  GibAuthError,
  GibNotFoundError,
  GibUnexpectedError,
  GibValidationError,
} from '../../domain/errors/BeyannameErrors.js';
import { GibEBeyanProvider } from '../../infrastructure/provider/GibEBeyanProvider.js';

const config: BeyannameConfig = {
  apiKey: 'API-KEY-XYZ',
  ortam: 'test',
  entegratorVkn: '1111111111',
  entegratorUnvan: 'PROMET',
  mukellefVkn: '2222222222',
  sifat: { tip: 'MUKELLEF', adSoyadUnvan: 'Test A.Ş.', eposta: 'a@b.com', telefon: '905551112233' },
  duzenleyen: { adSoyadUnvan: 'Test A.Ş.', eposta: 'a@b.com', telefon: '905551112233' },
};

interface Capture {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

function jsonRes(status: number, payload: unknown) {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `S${status}`,
    text: () => Promise.resolve(raw),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  };
}

function providerWith(
  handler: (cap: Capture) => ReturnType<typeof jsonRes>,
  captures: Capture[] = [],
): GibEBeyanProvider {
  return new GibEBeyanProvider({
    fetchFn: (url, init) => {
      const cap: Capture = {
        url,
        ...(init?.method !== undefined ? { method: init.method } : {}),
        ...(init?.headers !== undefined ? { headers: init.headers } : {}),
        ...(init?.body !== undefined ? { body: init.body } : {}),
      };
      captures.push(cap);
      return Promise.resolve(handler(cap));
    },
  });
}

describe('GibEBeyanProvider', () => {
  it('zorunlu header ve base URL (test ortamı) doğru kurulur', async () => {
    const caps: Capture[] = [];
    const provider = providerWith(
      () => jsonRes(201, { data: { beyannameId: '10001' }, messages: {}, traceId: 't1' }),
      caps,
    );
    const res = await provider.topluKaydet(config, {
      idariBilgiler: {
        donem: { tip: 'AYLIK', yil: 2025, ay: 'OCAK' },
        vergiDairesi: { kod: '006257' },
      },
      sifat: config.sifat,
      duzenleyen: config.duzenleyen,
      duzeltmeMi: false,
    });

    assert.equal(res.data.beyannameId, '10001');
    assert.equal(res.traceId, 't1');
    const cap = caps[0]!;
    assert.ok(cap.url.startsWith('https://ebeyanpreprodapi.gib.gov.tr/kdv1/beyanname/toplu'));
    assert.equal(cap.method, 'POST');
    assert.equal(cap.headers?.['Authorization'], 'Bearer API-KEY-XYZ');
    assert.equal(cap.headers?.['CHANNEL'], 'ENTEGRATOR');
    assert.equal(cap.headers?.['MUKELLEF-VKN'], '2222222222');
    assert.equal(cap.headers?.['ENTEGRATOR'], '1111111111-PROMET');
  });

  it('prod ortamı prod base URL kullanır', async () => {
    const caps: Capture[] = [];
    const provider = providerWith(() => jsonRes(200, { data: 'ONAYLANDI', messages: {} }), caps);
    await provider.durumGetir({ ...config, ortam: 'prod' }, '10001');
    assert.ok(caps[0]!.url.startsWith('https://ebeyanapi.gib.gov.tr/kdv1/beyanname/durum'));
  });

  it('401 → GibAuthError', async () => {
    const provider = providerWith(() =>
      jsonRes(401, { messages: { errorMessages: ['yetkisiz'] } }),
    );
    await assert.rejects(() => provider.kontrolEt(config, '1'), GibAuthError);
  });

  it('403 → GibAuthError', async () => {
    const provider = providerWith(() => jsonRes(403, 'header eksik'));
    await assert.rejects(() => provider.kontrolEt(config, '1'), GibAuthError);
  });

  it('422 → GibValidationError ve errorMessages taşınır', async () => {
    const provider = providerWith(() =>
      jsonRes(422, { messages: { errorMessages: ['Matrah boş olamaz', 'Oran geçersiz'] } }),
    );
    await assert.rejects(
      () => provider.kontrolEt(config, '1'),
      (err: unknown) => {
        assert.ok(err instanceof GibValidationError);
        assert.deepEqual(err.messages, ['Matrah boş olamaz', 'Oran geçersiz']);
        return true;
      },
    );
  });

  it('404 → GibNotFoundError', async () => {
    const provider = providerWith(() => jsonRes(404, { messages: {} }));
    await assert.rejects(() => provider.durumGetir(config, '1'), GibNotFoundError);
  });

  it('500 → GibUnexpectedError', async () => {
    const provider = providerWith(() => jsonRes(500, 'sunucu hatası'));
    await assert.rejects(() => provider.durumGetir(config, '1'), GibUnexpectedError);
  });

  it('ağ hatası → GibUnexpectedError', async () => {
    const provider = new GibEBeyanProvider({
      fetchFn: () => Promise.reject(new Error('ECONNREFUSED')),
    });
    await assert.rejects(() => provider.durumGetir(config, '1'), GibUnexpectedError);
  });

  it('zarfsız düz değer de data olarak açılır', async () => {
    const provider = providerWith(() => jsonRes(200, true));
    const res = await provider.kanuniSureKontrolu(config, '1');
    assert.equal(res.data, true);
  });

  it('baglantiTest başarıda ok:true, hatada ok:false döner', async () => {
    const okProvider = providerWith(() => jsonRes(200, { data: [], messages: {} }));
    assert.deepEqual((await okProvider.baglantiTest(config)).ok, true);
    const failProvider = providerWith(() => jsonRes(401, 'nope'));
    assert.deepEqual((await failProvider.baglantiTest(config)).ok, false);
  });

  it('pdfIndir binary Buffer döndürür ve header kurar', async () => {
    const caps: Capture[] = [];
    const provider = new GibEBeyanProvider({
      fetchFn: (url, init) => {
        caps.push({ url, ...(init?.headers ? { headers: init.headers } : {}) });
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: () => Promise.resolve(''),
          arrayBuffer: () => Promise.resolve(new TextEncoder().encode('%PDF-1.4').buffer),
        });
      },
    });
    const buf = await provider.pdfIndir(config, '10001', 'tahakkuk');
    assert.ok(Buffer.isBuffer(buf));
    assert.equal(buf.toString('utf-8'), '%PDF-1.4');
    assert.ok(caps[0]!.url.includes('/kdv1/beyanname/pdf/tahakkuk'));
    assert.equal(caps[0]!.headers?.['Authorization'], 'Bearer API-KEY-XYZ');
  });
});
