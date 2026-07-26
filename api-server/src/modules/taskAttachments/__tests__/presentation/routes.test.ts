/**
 * Görev ekleri route testi — Hono in-memory request/response + gerçek JWT
 * (config.JWT_SECRET .env'den gelir; authMiddleware + companyScopeGuard zincirde).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import jwt from 'jsonwebtoken';

import { config } from '../../../../config.js';
import type { UserRole } from '../../../../types.js';
import type {
  NewTaskAttachmentInput,
  TaskAttachmentContent,
  TaskAttachmentMeta,
  TaskAttachmentRepository,
} from '../../application/ports/TaskAttachmentRepository.js';
import { createTaskAttachmentsRouter } from '../../presentation/taskAttachmentRoutes.js';

class InMemoryTaskAttachmentRepository implements TaskAttachmentRepository {
  private seq = 0;
  private rows: TaskAttachmentContent[] = [];

  create(input: NewTaskAttachmentInput): Promise<TaskAttachmentMeta> {
    const row: TaskAttachmentContent = {
      id: ++this.seq,
      companyId: input.companyId,
      taskRef: input.taskRef,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.content.length,
      note: input.note,
      uploadedBy: input.uploadedBy,
      createdAt: '2026-07-26T00:00:00.000Z',
      content: input.content,
    };
    this.rows.push(row);
    const { content: _content, ...meta } = row;
    return Promise.resolve(meta);
  }

  listByTask(companyId: number, taskRef: string): Promise<TaskAttachmentMeta[]> {
    return Promise.resolve(
      this.rows
        .filter((r) => r.companyId === companyId && r.taskRef === taskRef)
        .map(({ content: _c, ...m }) => m),
    );
  }

  getContent(companyId: number, id: number): Promise<TaskAttachmentContent | null> {
    return Promise.resolve(this.rows.find((r) => r.companyId === companyId && r.id === id) ?? null);
  }

  delete(companyId: number, id: number): Promise<boolean> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.companyId === companyId && r.id === id));
    return Promise.resolve(this.rows.length < before);
  }
}

function bearer(username = 'ali', role: UserRole = 'editor', sub = 7): string {
  return `Bearer ${jwt.sign({ sub, username, role }, config.JWT_SECRET)}`;
}

function jsonReq(body: unknown, auth?: string): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  };
}

describe('createTaskAttachmentsRouter', () => {
  it('token yoksa 401 döner', async () => {
    const router = createTaskAttachmentsRouter(new InMemoryTaskAttachmentRepository());
    const res = await router.request('/?companyId=1&taskRef=task_1');
    assert.equal(res.status, 401);
  });

  it('POST / geçerli base64 ile ek yükler → 201 + metadata', async () => {
    const repo = new InMemoryTaskAttachmentRepository();
    const router = createTaskAttachmentsRouter(repo);
    const contentBase64 = Buffer.from('merhaba dünya').toString('base64');
    const res = await router.request(
      '/',
      jsonReq(
        {
          companyId: 1,
          taskRef: 'task_abc',
          fileName: 'not.txt',
          mimeType: 'text/plain',
          contentBase64,
        },
        bearer(),
      ),
    );
    assert.equal(res.status, 201);
    const meta = (await res.json()) as TaskAttachmentMeta;
    assert.equal(meta.taskRef, 'task_abc');
    assert.equal(meta.fileName, 'not.txt');
    assert.equal(meta.sizeBytes, Buffer.from('merhaba dünya').length);
    assert.equal(meta.uploadedBy, 7);
  });

  it('boş dosya (base64 boş byte) → 400', async () => {
    const router = createTaskAttachmentsRouter(new InMemoryTaskAttachmentRepository());
    const res = await router.request(
      '/',
      jsonReq(
        { companyId: 1, taskRef: 'task_abc', fileName: 'x', contentBase64: '====' },
        bearer(),
      ),
    );
    assert.equal(res.status, 400);
  });

  it('GET / bir görevin eklerini listeler; download içeriği akıtır; delete siler', async () => {
    const repo = new InMemoryTaskAttachmentRepository();
    const router = createTaskAttachmentsRouter(repo);
    const contentBase64 = Buffer.from('dosya').toString('base64');
    const up = await router.request(
      '/',
      jsonReq({ companyId: 3, taskRef: 'task_z', fileName: 'a.txt', contentBase64 }, bearer()),
    );
    const created = (await up.json()) as TaskAttachmentMeta;

    const list = await router.request('/?companyId=3&taskRef=task_z', {
      headers: { Authorization: bearer() },
    });
    assert.equal(list.status, 200);
    const { attachments } = (await list.json()) as { attachments: TaskAttachmentMeta[] };
    assert.equal(attachments.length, 1);
    assert.equal(attachments[0]?.id, created.id);

    const dl = await router.request(`/${created.id}/download?companyId=3`, {
      headers: { Authorization: bearer() },
    });
    assert.equal(dl.status, 200);
    assert.equal(await dl.text(), 'dosya');

    const del = await router.request(`/${created.id}?companyId=3`, {
      method: 'DELETE',
      headers: { Authorization: bearer() },
    });
    assert.equal(del.status, 200);
    assert.deepEqual(await del.json(), { deleted: true });

    const after = await router.request('/?companyId=3&taskRef=task_z', {
      headers: { Authorization: bearer() },
    });
    const { attachments: rest } = (await after.json()) as { attachments: TaskAttachmentMeta[] };
    assert.equal(rest.length, 0);
  });

  it('başka şirketin ek indirmesi 404 (tenant izolasyonu)', async () => {
    const repo = new InMemoryTaskAttachmentRepository();
    const router = createTaskAttachmentsRouter(repo);
    const contentBase64 = Buffer.from('gizli').toString('base64');
    const up = await router.request(
      '/',
      jsonReq({ companyId: 1, taskRef: 'task_q', fileName: 'g.txt', contentBase64 }, bearer()),
    );
    const created = (await up.json()) as TaskAttachmentMeta;
    const dl = await router.request(`/${created.id}/download?companyId=2`, {
      headers: { Authorization: bearer() },
    });
    assert.equal(dl.status, 404);
  });
});
