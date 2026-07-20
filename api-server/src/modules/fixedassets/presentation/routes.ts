/**
 * Sabit Kıymet (Fixed Assets) HTTP route'ları.
 *
 * Tüm endpoint'ler authMiddleware + companyScopeGuard ile korunur; sync en az
 * 'cfo' rolü ister (warehouse kalıbı). POST /sync full-state yansıtmadır:
 * istemci blob'u (kaynak-of-truth) şirketin tüm kıymet kartı + hareket +
 * amortisman koşumlarını gönderir; prune=true payload'da olmayanları siler.
 * POST /depreciation/preview VUK hesap motorunun (DepreciationCalculator)
 * dönem koşum satırlarını döndürür — frontend pariteyi doğrulamak için
 * kullanır (yazma yapmaz, view yeterli). İş kuralı yazmaz; use-case'leri /
 * domain servisini çağırır.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware, companyScopeGuard, requireRole } from '../../../middleware/auth.js';
import type {
  ListDepreciationRunsUseCase,
  ListFixedAssetMovementsUseCase,
  ListFixedAssetsUseCase,
} from '../application/useCases/ListUseCases.js';
import type { SyncFixedAssetsUseCase } from '../application/useCases/SyncFixedAssetsUseCase.js';
import type { DepreciationCalculator } from '../domain/services/DepreciationCalculator.js';

import { mapFixedAssetError } from './errorMapping.js';

export interface FixedAssetsRouterDeps {
  syncFixedAssets: SyncFixedAssetsUseCase;
  listAssets: ListFixedAssetsUseCase;
  listMovements: ListFixedAssetMovementsUseCase;
  listRuns: ListDepreciationRunsUseCase;
  depreciationCalculator: DepreciationCalculator;
}

// --- Schema fragmanları -----------------------------------------------------
// Blob aynası olduğundan şema makul GEVŞEKTİR: bilinmeyen alanlar atılır (zod
// varsayılanı strip), sayısallar coerce edilir, bozuk enum/sayı değerleri
// catch ile güvenli varsayılana düşer. Kimlik + zorunlu çekirdek alanlar katı.

const companyIdQ = z.object({ companyId: z.coerce.number().int().positive() });

const clientId = z.string().min(1).max(80);
const isoDate = z.string().max(64).nullish();

const looseNumber = (fallback: number) =>
  z.preprocess(
    (v) => (v == null || v === '' ? fallback : Number(v)),
    z.number().finite().catch(fallback),
  );

const nullableNumber = z.preprocess(
  (v) => (v == null || v === '' ? null : Number(v)),
  z.number().finite().nullable().catch(null),
);

const nullableString = (max: number) => z.string().max(max).nullish().catch(null);

const assetSchema = z.object({
  id: clientId,
  code: z.string().max(120).catch(''),
  name: z.string().max(300).catch(''),
  category: nullableString(200),
  location: nullableString(300),
  departmentId: nullableString(80),
  employeeId: nullableString(80),
  acquisitionDate: z.string().min(7).max(40),
  acquisitionCost: looseNumber(0),
  usefulLifeYears: looseNumber(5),
  method: z.enum(['normal', 'declining']).catch('normal'),
  isPassengerCar: z.boolean().catch(false),
  salvageValue: looseNumber(0),
  openingAccumulated: looseNumber(0),
  assetAccountCode: nullableString(40),
  accumAccountCode: nullableString(40),
  expenseAccountCode: nullableString(40),
  status: z.enum(['active', 'sold', 'scrapped', 'inactive']).catch('active'),
  disposalDate: nullableString(40),
  disposalAmount: nullableNumber,
  disposalJournalEntryId: nullableString(80),
  notes: nullableString(4000),
  createdAt: isoDate,
  updatedAt: isoDate,
});

const movementSchema = z.object({
  id: clientId,
  assetId: clientId,
  type: z.enum(['transfer', 'sale', 'scrap']).nullable().catch(null),
  date: z.string().min(7).max(40),
  amount: nullableNumber,
  vatRate: nullableNumber,
  counterAccountCode: nullableString(40),
  gainLoss: nullableNumber,
  fromLocation: nullableString(300),
  toLocation: nullableString(300),
  notes: nullableString(4000),
  journalEntryId: nullableString(80),
  createdAt: isoDate,
});

const runLineSchema = z.object({
  assetId: clientId,
  amount: looseNumber(0),
});

const runSchema = z.object({
  id: clientId,
  periodStart: z.string().min(7).max(20),
  periodEnd: z.string().min(7).max(20),
  runDate: nullableString(40),
  total: looseNumber(0),
  journalEntryId: nullableString(80),
  voucherNo: nullableString(80),
  status: z.string().max(40).catch('posted'),
  lines: z.array(runLineSchema).max(10000).catch([]),
  createdAt: isoDate,
  updatedAt: isoDate,
});

const syncSchema = z.object({
  companyId: z.coerce.number().int().positive(),
  prune: z.boolean().optional(),
  assets: z.array(assetSchema).max(20000).default([]),
  movements: z.array(movementSchema).max(50000).default([]),
  runs: z.array(runSchema).max(5000).default([]),
});

const previewAssetSchema = z.object({
  id: clientId,
  acquisitionDate: z.string().min(7).max(40),
  acquisitionCost: looseNumber(0),
  usefulLifeYears: looseNumber(0),
  method: z.enum(['normal', 'declining']).catch('normal'),
  isPassengerCar: z.boolean().catch(false),
  salvageValue: looseNumber(0),
  openingAccumulated: looseNumber(0),
});

const previewSchema = z.object({
  companyId: z.coerce.number().int().positive(),
  period: z.string().regex(/^\d{4}-\d{2}$/, "Dönem 'YYYY-MM' formatında olmalı"),
  assets: z.array(previewAssetSchema).max(20000),
  /** Kıymet başına ayrılmış toplam (openingAccumulated DAHİL). Verilmezse kıymetin openingAccumulated'ı kullanılır. */
  alreadyBooked: z.record(z.coerce.number()).optional(),
});

export function createFixedAssetsRouter(deps: FixedAssetsRouterDeps): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  app.use('*', companyScopeGuard);
  const requireWrite = requireRole('cfo');

  app.get('/assets', zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    try {
      const assets = await deps.listAssets.execute({ companyId: q.companyId });
      return c.json({ assets });
    } catch (err) {
      mapFixedAssetError(err);
    }
  });

  app.get('/movements', zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    try {
      const movements = await deps.listMovements.execute({ companyId: q.companyId });
      return c.json({ movements });
    } catch (err) {
      mapFixedAssetError(err);
    }
  });

  app.get('/runs', zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    try {
      const runs = await deps.listRuns.execute({ companyId: q.companyId });
      return c.json({ runs });
    } catch (err) {
      mapFixedAssetError(err);
    }
  });

  app.post('/sync', requireWrite, zValidator('json', syncSchema), async (c) => {
    const b = c.req.valid('json');
    try {
      const result = await deps.syncFixedAssets.execute({
        companyId: b.companyId,
        prune: b.prune,
        assets: b.assets.map((x) => ({
          id: x.id,
          code: x.code,
          name: x.name,
          category: x.category ?? null,
          location: x.location ?? null,
          departmentId: x.departmentId ?? null,
          employeeId: x.employeeId ?? null,
          acquisitionDate: x.acquisitionDate,
          acquisitionCost: x.acquisitionCost,
          usefulLifeYears: Math.floor(x.usefulLifeYears),
          method: x.method,
          isPassengerCar: x.isPassengerCar,
          salvageValue: x.salvageValue,
          openingAccumulated: x.openingAccumulated,
          assetAccountCode: x.assetAccountCode ?? null,
          accumAccountCode: x.accumAccountCode ?? null,
          expenseAccountCode: x.expenseAccountCode ?? null,
          status: x.status,
          disposalDate: x.disposalDate ?? null,
          disposalAmount: x.disposalAmount,
          disposalJournalEntryId: x.disposalJournalEntryId ?? null,
          notes: x.notes ?? null,
          createdAt: x.createdAt ?? null,
          updatedAt: x.updatedAt ?? null,
        })),
        movements: b.movements.map((x) => ({
          id: x.id,
          assetId: x.assetId,
          type: x.type,
          date: x.date,
          amount: x.amount,
          vatRate: x.vatRate,
          counterAccountCode: x.counterAccountCode ?? null,
          gainLoss: x.gainLoss,
          fromLocation: x.fromLocation ?? null,
          toLocation: x.toLocation ?? null,
          notes: x.notes ?? null,
          journalEntryId: x.journalEntryId ?? null,
          createdAt: x.createdAt ?? null,
        })),
        runs: b.runs.map((x) => ({
          id: x.id,
          periodStart: x.periodStart,
          periodEnd: x.periodEnd,
          runDate: x.runDate ?? null,
          total: x.total,
          journalEntryId: x.journalEntryId ?? null,
          voucherNo: x.voucherNo ?? null,
          status: x.status,
          lines: x.lines,
          createdAt: x.createdAt ?? null,
          updatedAt: x.updatedAt ?? null,
        })),
      });
      return c.json(result);
    } catch (err) {
      mapFixedAssetError(err);
    }
  });

  app.post('/depreciation/preview', zValidator('json', previewSchema), (c) => {
    const b = c.req.valid('json');
    try {
      // alreadyBooked verilmişse openingAccumulated DAHİL kabul edilir (çağıran
      // hesaplar); verilmeyen kıymetler için openingAccumulated varsayılır.
      const booked: Record<string, number> = {};
      for (const a of b.assets) {
        booked[a.id] = b.alreadyBooked?.[a.id] ?? a.openingAccumulated;
      }
      const lines = deps.depreciationCalculator.computeRunLines(b.period, b.assets, booked);
      const total = Math.round(lines.reduce((sum, l) => sum + l.amount, 0) * 100) / 100;
      return c.json({ period: b.period, lines, total });
    } catch (err) {
      mapFixedAssetError(err);
    }
  });

  return app;
}
