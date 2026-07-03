/**
 * Özlük Belge HTTP route'ları — /v1/hr/documents altına mount edilir.
 *
 *   GET    /?companyId=&employeeRef=&category=   → metadata listesi (içerik yok)
 *   POST   /                                      → base64 içerikle belge yükle
 *   GET    /:id/download?companyId=               → dosyayı akıt (BYTEA)
 *   DELETE /:id?companyId=                        → belge sil
 *
 * Tüm route'lar authMiddleware ile korunur; yazma (POST/DELETE) hr_manager ister.
 * İçerik app-state blob'una DEĞİL PG'ye (BYTEA) yazılır — kota koruması.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { authMiddleware, requireRole } from '../../../middleware/auth.js';
import type { EmployeeDocumentRepository } from '../application/ports/EmployeeDocumentRepository.js';

// 10 MB ham dosya sınırı (base64 ~13.4 MB'a şişer — gövde sınırı ona göre).
const MAX_BYTES = 10 * 1024 * 1024;

// İzinli özlük belge kategorileri (özlük sekmeleriyle eşleşir).
const CATEGORIES = [
  'contract',
  'education',
  'certificate',
  'court',
  'discipline',
  'identity',
  'other',
] as const;

const positiveInt = z.coerce.number().int().positive();
const categoryEnum = z.enum(CATEGORIES);

export function createHrDocumentsRouter(repo: EmployeeDocumentRepository): Hono {
  const app = new Hono();

  app.use('*', authMiddleware);
  const requireHrWrite = requireRole('hr_manager');

  // --- LİSTE (metadata) ------------------------------------------------------
  app.get(
    '/',
    zValidator(
      'query',
      z.object({
        companyId: positiveInt,
        employeeRef: z.string().min(1).max(64),
        category: categoryEnum.optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      const docs = await repo.listByEmployee(q.companyId, q.employeeRef, q.category);
      return c.json({ documents: docs });
    },
  );

  // --- YÜKLE (base64) --------------------------------------------------------
  app.post(
    '/',
    requireHrWrite,
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        employeeRef: z.string().min(1).max(64),
        category: categoryEnum,
        fileName: z.string().min(1).max(300),
        mimeType: z.string().max(150).nullable().optional(),
        note: z.string().max(2000).nullable().optional(),
        contentBase64: z.string().min(1),
      }),
    ),
    async (c) => {
      const body = c.req.valid('json');
      const auth = c.get('auth');

      let content: Buffer;
      try {
        content = Buffer.from(body.contentBase64, 'base64');
      } catch {
        throw new HTTPException(400, { message: 'Geçersiz base64 içerik' });
      }
      if (content.length === 0) {
        throw new HTTPException(400, { message: 'Boş dosya' });
      }
      if (content.length > MAX_BYTES) {
        throw new HTTPException(413, { message: 'Dosya çok büyük (en fazla 10 MB)' });
      }

      const meta = await repo.create({
        companyId: body.companyId,
        employeeRef: body.employeeRef,
        category: body.category,
        fileName: body.fileName,
        mimeType: body.mimeType ?? null,
        note: body.note ?? null,
        content,
        uploadedBy: auth.userId,
      });
      return c.json(meta, 201);
    },
  );

  // --- İNDİR (BYTEA akıt) ----------------------------------------------------
  app.get(
    '/:id/download',
    zValidator('param', z.object({ id: positiveInt })),
    zValidator('query', z.object({ companyId: positiveInt })),
    async (c) => {
      const { id } = c.req.valid('param');
      const { companyId } = c.req.valid('query');
      const doc = await repo.getContent(companyId, id);
      if (!doc) throw new HTTPException(404, { message: 'Belge bulunamadı' });

      // Dosya adını RFC 5987 (UTF-8) ile ver — Türkçe karakter güvenli.
      const encoded = encodeURIComponent(doc.fileName);
      c.header('Content-Type', doc.mimeType || 'application/octet-stream');
      c.header('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
      c.header('Content-Length', String(doc.content.length));
      return c.body(new Uint8Array(doc.content));
    },
  );

  // --- SİL -------------------------------------------------------------------
  app.delete(
    '/:id',
    requireHrWrite,
    zValidator('param', z.object({ id: positiveInt })),
    zValidator('query', z.object({ companyId: positiveInt })),
    async (c) => {
      const { id } = c.req.valid('param');
      const { companyId } = c.req.valid('query');
      const ok = await repo.delete(companyId, id);
      if (!ok) throw new HTTPException(404, { message: 'Belge bulunamadı' });
      return c.json({ deleted: true });
    },
  );

  return app;
}
