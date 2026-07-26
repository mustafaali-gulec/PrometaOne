/**
 * Görev Eki HTTP route'ları — /v1/task-attachments altına mount edilir.
 *
 *   GET    /?companyId=&taskRef=       → metadata listesi (içerik yok)
 *   POST   /                            → base64 içerikle ek yükle
 *   GET    /:id/download?companyId=     → dosyayı akıt (BYTEA)
 *   DELETE /:id?companyId=              → ek sil
 *
 * Tüm route'lar authMiddleware + companyScopeGuard ile korunur. Görevleri herkes
 * birbirine atayabildiğinden yazma için ayrı rol (requireRole) İSTENMEZ — company
 * scope yeterlidir. İçerik app-state blob'una DEĞİL PG'ye (BYTEA) yazılır.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { authMiddleware, companyScopeGuard } from '../../../middleware/auth.js';
import type { TaskAttachmentRepository } from '../application/ports/TaskAttachmentRepository.js';

// 10 MB ham dosya sınırı (base64 ~13.4 MB'a şişer — gövde sınırı ona göre).
const MAX_BYTES = 10 * 1024 * 1024;

const positiveInt = z.coerce.number().int().positive();
const taskRef = z.string().min(1).max(64);

export function createTaskAttachmentsRouter(repo: TaskAttachmentRepository): Hono {
  const app = new Hono();

  app.use('*', authMiddleware);
  app.use('*', companyScopeGuard);

  // --- LİSTE (metadata) ------------------------------------------------------
  app.get('/', zValidator('query', z.object({ companyId: positiveInt, taskRef })), async (c) => {
    const q = c.req.valid('query');
    const attachments = await repo.listByTask(q.companyId, q.taskRef);
    return c.json({ attachments });
  });

  // --- YÜKLE (base64) --------------------------------------------------------
  app.post(
    '/',
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        taskRef,
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
        taskRef: body.taskRef,
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
      const att = await repo.getContent(companyId, id);
      if (!att) throw new HTTPException(404, { message: 'Ek bulunamadı' });

      // Dosya adını RFC 5987 (UTF-8) ile ver — Türkçe karakter güvenli.
      const encoded = encodeURIComponent(att.fileName);
      c.header('Content-Type', att.mimeType || 'application/octet-stream');
      c.header('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
      c.header('Content-Length', String(att.content.length));
      return c.body(new Uint8Array(att.content));
    },
  );

  // --- SİL -------------------------------------------------------------------
  app.delete(
    '/:id',
    zValidator('param', z.object({ id: positiveInt })),
    zValidator('query', z.object({ companyId: positiveInt })),
    async (c) => {
      const { id } = c.req.valid('param');
      const { companyId } = c.req.valid('query');
      const ok = await repo.delete(companyId, id);
      if (!ok) throw new HTTPException(404, { message: 'Ek bulunamadı' });
      return c.json({ deleted: true });
    },
  );

  return app;
}
