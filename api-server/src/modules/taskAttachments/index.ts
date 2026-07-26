/**
 * Görev Ekleri modülü — Public API + DI composition root.
 *
 * registerTaskAttachmentsModule(pool) PgTaskAttachmentRepository'yi wire eder ve
 * { router } döndürür. api-server/src/index.ts bunu `/v1/task-attachments` altına
 * mount eder. Dosya içeriği PG'de BYTEA olarak saklanır (app-state blob'una değil).
 */
import type { Hono } from 'hono';
import type { Pool } from 'pg';

import { PgTaskAttachmentRepository } from './infrastructure/persistence/PgTaskAttachmentRepository.js';
import { createTaskAttachmentsRouter } from './presentation/taskAttachmentRoutes.js';

export type {
  TaskAttachmentContent,
  TaskAttachmentMeta,
  TaskAttachmentRepository,
  NewTaskAttachmentInput,
} from './application/ports/TaskAttachmentRepository.js';
export { PgTaskAttachmentRepository };
export { createTaskAttachmentsRouter };

export interface RegisteredTaskAttachmentsModule {
  router: Hono;
}

export function registerTaskAttachmentsModule(pool: Pool): RegisteredTaskAttachmentsModule {
  const repo = new PgTaskAttachmentRepository(pool);
  const router = createTaskAttachmentsRouter(repo);
  return { router };
}
