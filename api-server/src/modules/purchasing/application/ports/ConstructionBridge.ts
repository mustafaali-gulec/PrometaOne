/**
 * ConstructionBridge — satınalma → şantiye taahhüt köprüsü portu.
 * Concrete: infrastructure/bridge/HttpConstructionBridge.ts
 *
 * KÖPRÜ KARARI (şantiye revizyonu, kullanıcı onaylı): satınalma şantiyede
 * İKİZLENMEZ; monolit kaynak-of-truth kalır, sipariş tutarları
 * construction-service'teki cs_commitments PROJEKSİYONUNA akar. Senkron ucu
 * (POST /v1/construction/commitments/sync) idempotenttir — anahtar
 * (company, source, refNo, refLineNo); aynı yük iki kez gönderilse sonuç
 * değişmez, o yüzden her yazma sonrası koşulsuz tam-yük göndermek güvenlidir.
 *
 * BEST-EFFORT: köprü hatası SİPARİŞİ DÜŞÜRMEZ (loglanır). Kaçan senkron bir
 * sonraki yazmada kendini düzeltir; kalıcı kopukluk migration/elle sync ile
 * kapatılır. Sipariş kaydını şantiye servisinin ayakta olmasına bağlamak,
 * köprünün amacını (gevşek bağlaşım) bozar.
 */
import type { PurchaseOrder } from '../../domain/entities/PurchaseOrder.js';
import { round2 } from '../../domain/valueObjects/Currency.js';

export interface CommitmentSyncLine {
  refNo: string;
  refLineNo: number;
  projectId: number;
  boqLineId?: number | null;
  vendorId?: number | null;
  description: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  /** KÜMÜLATİF teslim tutarı (delta değil — Faz 7 kuralı). */
  deliveredAmount?: number;
  currency?: string;
  committedAt?: string;
  cancelled?: boolean;
}

export interface CommitmentSyncPayload {
  companyId: number;
  source: 'purchase_order';
  lines: CommitmentSyncLine[];
}

/**
 * PO → senkron yükü. NULL dönerse senkron GEREKMEZ:
 * - şantiye bağı (constructionProjectId) yoksa — köprü kapsamı dışı sipariş;
 * - taslakta — taahhüt VERİLMİŞ sipariştir, taslak henüz maruziyet değildir
 *   (taslakken senkronlansaydı sonra silinen taslak projeksiyonu şişirirdi).
 *
 * deliveredAmount = alınan miktar × birim fiyat (kümülatif). received/closed
 * durumunda tüm satır teslim kabul edilir — sahada kalem kalem işlenmemiş
 * miktar varken statünün 'received' yapılması "tamamı geldi" beyanıdır.
 */
export function poToCommitmentSync(po: PurchaseOrder): CommitmentSyncPayload | null {
  const projectId = po.constructionProjectId;
  if (projectId === null || po.status === 'draft') return null;

  // node-pg BIGINT tuzağı: BIGSERIAL kolonlar (vendors.id vb.) satırdan STRING
  // döner; tip number dese de çalışma zamanında string olabilir. Senkron ucu
  // zod ile katı number ister — burada zorla sayıya çevrilir.
  const vendorId = Number(po.vendorId);
  const projectIdNum = Number(projectId);

  const fullyDelivered =
    po.status === 'received' || po.status === 'invoiced' || po.status === 'closed';
  const committedAt = (po.orderedAt ?? po.createdAt).toISOString().slice(0, 10);

  return {
    companyId: po.companyId,
    source: 'purchase_order',
    lines: po.lines.map((l) => {
      const amount = round2(l.quantity * l.unitPrice);
      const receivedQty = fullyDelivered ? l.quantity : Math.min(l.receivedQty, l.quantity);
      return {
        refNo: po.poNo,
        refLineNo: l.lineNo,
        projectId: projectIdNum,
        boqLineId: l.constructionBoqLineId == null ? null : Number(l.constructionBoqLineId),
        vendorId,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        amount,
        deliveredAmount: round2(receivedQty * l.unitPrice),
        currency: po.currency,
        committedAt,
        ...(po.status === 'cancelled' ? { cancelled: true } : {}),
      };
    }),
  };
}

export interface ConstructionBridge {
  /** Best-effort: asla fırlatmaz; başarısızlık loglanır. */
  syncPurchaseOrder(po: PurchaseOrder): Promise<void>;
}
