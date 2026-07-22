/**
 * BeyannameService — KDV1 beyanname yaşam döngüsü orkestrasyonu.
 *
 * Lokal taslak CRUD + GİB e-Beyan akışı (gönder → kontrol → onayla) + durum,
 * PDF, özel onay ve GİB/referans listeleme. Her GİB çağrısı beyanname_islem_log'a
 * yazılır. Durum makinesi kuralları burada enforce edilir.
 */
import {
  BeyannameNotFoundError,
  BeyannameStateError,
  BeyannameValidationError,
} from '../../domain/errors/BeyannameErrors.js';
import type {
  BeyannameConfig,
  BeyannameRecord,
  CreateDeclarationInput,
  ListDeclarationsFilter,
  OzelOnaySecim,
  UpdateDeclarationInput,
} from '../dto/BeyannameDtos.js';
import type {
  BeyannameCredentialRepository,
  BeyannameRepository,
} from '../ports/BeyannameRepositories.js';
import type { CredentialCipher } from '../ports/CredentialCipher.js';
import type {
  EBeyanProvider,
  GibBeyannameListFilter,
  GibBeyannameListPage,
  GibMessages,
  GibResult,
  PdfTuru,
  TopluKaydetRequest,
  VergiDairesi,
} from '../ports/EBeyanProvider.js';

import { resolveConfig, type ProviderFactory } from './CredentialUseCases.js';

const VD_KOD_RE = /^[0-9]{6}$/;

function hasErrors(messages: GibMessages): boolean {
  return (messages.errorMessages?.length ?? 0) > 0;
}

export interface BeyannameActionResult {
  record: BeyannameRecord;
  messages: GibMessages;
  traceId?: string;
}

export class BeyannameService {
  constructor(
    private readonly repo: BeyannameRepository,
    private readonly credRepo: BeyannameCredentialRepository,
    private readonly cipher: CredentialCipher,
    private readonly providerFor: ProviderFactory,
  ) {}

  private config(companyId: number): Promise<BeyannameConfig> {
    return resolveConfig(this.credRepo, this.cipher, companyId);
  }

  private provider(config: BeyannameConfig): EBeyanProvider {
    return this.providerFor(config.ortam);
  }

  private async require(companyId: number, id: number): Promise<BeyannameRecord> {
    const rec = await this.repo.getById(companyId, id);
    if (rec === null) throw new BeyannameNotFoundError(id);
    return rec;
  }

  // --- Lokal CRUD ---------------------------------------------------------

  list(companyId: number, filter: ListDeclarationsFilter): Promise<BeyannameRecord[]> {
    return this.repo.list(companyId, filter);
  }

  get(companyId: number, id: number): Promise<BeyannameRecord> {
    return this.require(companyId, id);
  }

  create(input: CreateDeclarationInput): Promise<BeyannameRecord> {
    if (input.vergiDairesiKod != null && !VD_KOD_RE.test(input.vergiDairesiKod)) {
      throw new BeyannameValidationError('Vergi dairesi kodu 6 haneli olmalı');
    }
    return this.repo.create(input);
  }

  async update(
    companyId: number,
    id: number,
    input: UpdateDeclarationInput,
  ): Promise<BeyannameRecord> {
    const rec = await this.require(companyId, id);
    if (rec.durum !== 'taslak' && rec.durum !== 'hatali') {
      throw new BeyannameStateError(
        `Yalnız taslak veya hatalı beyanname düzenlenebilir (mevcut durum: ${rec.durum})`,
      );
    }
    if (input.vergiDairesiKod != null && !VD_KOD_RE.test(input.vergiDairesiKod)) {
      throw new BeyannameValidationError('Vergi dairesi kodu 6 haneli olmalı');
    }
    return this.repo.update(companyId, id, input);
  }

  async remove(companyId: number, id: number): Promise<void> {
    const rec = await this.require(companyId, id);
    if (rec.gibBeyannameId !== null || rec.durum !== 'taslak') {
      throw new BeyannameStateError(
        'GİB’e gönderilmiş beyanname silinemez; önce taslak durumuna getirin veya GİB tarafında iptal edin',
      );
    }
    await this.repo.remove(companyId, id);
  }

  // --- GİB akışı ----------------------------------------------------------

  async send(
    companyId: number,
    id: number,
    actorUserId: number | null,
  ): Promise<BeyannameActionResult> {
    const rec = await this.require(companyId, id);
    if (rec.durum !== 'taslak' && rec.durum !== 'hatali') {
      throw new BeyannameStateError(
        `Yalnız taslak/hatalı beyanname gönderilebilir (mevcut durum: ${rec.durum})`,
      );
    }
    if (rec.vergiDairesiKod == null || !VD_KOD_RE.test(rec.vergiDairesiKod)) {
      throw new BeyannameValidationError('Göndermeden önce geçerli bir vergi dairesi kodu girin');
    }
    const config = await this.config(companyId);
    const request: TopluKaydetRequest = {
      idariBilgiler: { donem: rec.donem, vergiDairesi: { kod: rec.vergiDairesiKod } },
      sifat: config.sifat,
      duzenleyen: config.duzenleyen,
      duzeltmeMi: rec.duzeltmeMi,
      ...(rec.payload.matrah ? { matrah: rec.payload.matrah } : {}),
      ...(rec.payload.indirimler ? { indirimler: rec.payload.indirimler } : {}),
      ...(rec.payload.istisnalar ? { istisnalar: rec.payload.istisnalar } : {}),
      ...(rec.payload.ihracKaydiylaTeslimler
        ? { ihracKaydiylaTeslimler: rec.payload.ihracKaydiylaTeslimler }
        : {}),
      ...(rec.payload.ekler ? { ekler: rec.payload.ekler } : {}),
      ...(rec.payload.sonucHesaplari ? { sonucHesaplari: rec.payload.sonucHesaplari } : {}),
    };

    const res = await this.provider(config).topluKaydet(config, request);
    const updated = await this.repo.update(companyId, id, {
      durum: 'gonderildi',
      gibBeyannameId: res.data.beyannameId,
      gibDurum: 'TASLAK',
      sonHata: null,
    });
    await this.log(companyId, id, 'send', '/kdv1/beyanname/toplu', 201, res, actorUserId);
    return {
      record: updated,
      messages: res.messages,
      ...(res.traceId ? { traceId: res.traceId } : {}),
    };
  }

  async check(
    companyId: number,
    id: number,
    actorUserId: number | null,
  ): Promise<BeyannameActionResult> {
    const rec = await this.requireSent(companyId, id);
    const config = await this.config(companyId);
    const res = await this.provider(config).kontrolEt(config, rec.gibBeyannameId!);
    const durum = hasErrors(res.messages) ? 'hatali' : 'kontrol_edildi';
    const updated = await this.repo.update(companyId, id, {
      durum,
      kontrolSonucu: res.data ?? null,
      sonHata: hasErrors(res.messages) ? res.messages.errorMessages : null,
    });
    await this.log(
      companyId,
      id,
      'check',
      '/kdv1/beyanname/toplu/kontrolEt',
      200,
      res,
      actorUserId,
    );
    return {
      record: updated,
      messages: res.messages,
      ...(res.traceId ? { traceId: res.traceId } : {}),
    };
  }

  async ozelOnay(
    companyId: number,
    id: number,
  ): Promise<{ kanuniSureIcinde: boolean; ozelOnay: unknown }> {
    const rec = await this.requireSent(companyId, id);
    const config = await this.config(companyId);
    const provider = this.provider(config);
    const sure = await provider.kanuniSureKontrolu(config, rec.gibBeyannameId!);
    const bilgi = await provider.ozelOnayGetir(config, rec.gibBeyannameId!);
    return { kanuniSureIcinde: sure.data === true, ozelOnay: bilgi.data ?? null };
  }

  async approve(
    companyId: number,
    id: number,
    input: {
      ozelOnaySecim?: OzelOnaySecim;
      ozelOnayDetay?: Record<string, unknown>;
      duzeltmeAciklama?: string;
    },
    actorUserId: number | null,
  ): Promise<BeyannameActionResult> {
    const rec = await this.requireSent(companyId, id);
    const config = await this.config(companyId);
    const res = await this.provider(config).onayla(config, {
      beyannameId: rec.gibBeyannameId!,
      ...(input.ozelOnaySecim !== undefined ? { ozelOnaySecim: input.ozelOnaySecim } : {}),
      ...(input.ozelOnayDetay !== undefined ? { ozelOnayDetay: input.ozelOnayDetay } : {}),
      ...(input.duzeltmeAciklama !== undefined ? { duzeltmeAciklama: input.duzeltmeAciklama } : {}),
    });
    if (hasErrors(res.messages)) {
      const updated = await this.repo.update(companyId, id, {
        durum: 'hatali',
        sonHata: res.messages.errorMessages,
      });
      await this.log(
        companyId,
        id,
        'approve',
        '/kdv1/beyanname/toplu/onayla',
        200,
        res,
        actorUserId,
      );
      return {
        record: updated,
        messages: res.messages,
        ...(res.traceId ? { traceId: res.traceId } : {}),
      };
    }
    const updated = await this.repo.update(companyId, id, {
      durum: 'onaylandi',
      gibDurum: 'ONAYLANDI',
      onaySonucu: res.data ?? null,
      sonHata: null,
    });
    await this.log(companyId, id, 'approve', '/kdv1/beyanname/toplu/onayla', 200, res, actorUserId);
    return {
      record: updated,
      messages: res.messages,
      ...(res.traceId ? { traceId: res.traceId } : {}),
    };
  }

  async makeDraft(
    companyId: number,
    id: number,
    actorUserId: number | null,
  ): Promise<BeyannameActionResult> {
    const rec = await this.requireSent(companyId, id);
    const config = await this.config(companyId);
    const res = await this.provider(config).taslakDurumunaGetir(config, rec.gibBeyannameId!);
    const updated = await this.repo.update(companyId, id, {
      durum: 'gonderildi',
      gibDurum: 'TASLAK',
    });
    await this.log(
      companyId,
      id,
      'draft',
      '/kdv1/beyanname/toplu/taslakDurumunaGetir',
      200,
      res,
      actorUserId,
    );
    return {
      record: updated,
      messages: res.messages,
      ...(res.traceId ? { traceId: res.traceId } : {}),
    };
  }

  async refreshStatus(
    companyId: number,
    id: number,
    actorUserId: number | null,
  ): Promise<BeyannameActionResult> {
    const rec = await this.requireSent(companyId, id);
    const config = await this.config(companyId);
    const res = await this.provider(config).durumGetir(config, rec.gibBeyannameId!);
    const gibDurum = typeof res.data === 'string' ? res.data : rec.gibDurum;
    const updated = await this.repo.update(companyId, id, { gibDurum });
    await this.log(companyId, id, 'status', '/kdv1/beyanname/durum', 200, res, actorUserId);
    return {
      record: updated,
      messages: res.messages,
      ...(res.traceId ? { traceId: res.traceId } : {}),
    };
  }

  async pdf(
    companyId: number,
    id: number,
    tur: PdfTuru,
    actorUserId: number | null,
  ): Promise<Buffer> {
    const rec = await this.requireSent(companyId, id);
    const config = await this.config(companyId);
    const buf = await this.provider(config).pdfIndir(config, rec.gibBeyannameId!, tur);
    await this.repo.appendLog({
      companyId,
      beyannameId: id,
      islem: `pdf:${tur}`,
      gibEndpoint: '/kdv1/beyanname/pdf',
      httpStatus: 200,
      createdBy: actorUserId,
    });
    return buf;
  }

  // --- GİB / referans listeleme ------------------------------------------

  async listGib(companyId: number, filter: GibBeyannameListFilter): Promise<GibBeyannameListPage> {
    const config = await this.config(companyId);
    const res = await this.provider(config).beyannameListele(config, filter);
    return res.data;
  }

  async vergiDaireleri(companyId: number): Promise<VergiDairesi[]> {
    const config = await this.config(companyId);
    const res = await this.provider(config).vergiDairesiListesi(config);
    return res.data ?? [];
  }

  async kdvOranlari(companyId: number): Promise<unknown> {
    const config = await this.config(companyId);
    const res = await this.provider(config).kdvOranlari(config);
    return res.data ?? null;
  }

  // --- yardımcılar --------------------------------------------------------

  private async requireSent(companyId: number, id: number): Promise<BeyannameRecord> {
    const rec = await this.require(companyId, id);
    if (rec.gibBeyannameId === null) {
      throw new BeyannameStateError('Bu işlem için beyannamenin önce GİB’e gönderilmesi gerekir');
    }
    return rec;
  }

  private async log(
    companyId: number,
    beyannameId: number,
    islem: string,
    endpoint: string,
    httpStatus: number,
    res: GibResult<unknown>,
    actorUserId: number | null,
  ): Promise<void> {
    await this.repo.appendLog({
      companyId,
      beyannameId,
      islem,
      gibEndpoint: endpoint,
      httpStatus,
      traceId: res.traceId ?? null,
      mesajlar: res.messages,
      createdBy: actorUserId,
    });
  }
}
