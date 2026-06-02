/**
 * @vitest-environment node
 *
 * HrApiClient unit testleri — MSW v2 ile gerçek fetch akışı.
 *
 * `@vitest-environment node` per-file override: HrApiClient'in DOM'a ihtiyacı
 * yok (sadece fetch), happy-dom'un fetch implementasyonu MSW v2 ile
 * "ReadableStream is locked" hatasını tetikliyor. Node native fetch (undici)
 * MSW v2'nin resmi destekli runtime'ı — stream interception sorunsuz çalışır.
 *
 * - HrApiClient `http://api.test` host root ile konstrükte edilir; client
 *   path'leri `/v1/hr/...` olarak ekler. Handler factory'leri
 *   (test/msw/hrHandlers.ts) `HR_BASE = http://api.test/v1/hr` kullanır.
 * - Her test kendi handler'ını `server.use(...)` ile yükler; setup.ts
 *   `onUnhandledRequest: 'error'` ayarladığı için unutulan stub testi kırar.
 * - Auth header doğrulamaları için `createCapture()` helper'ı kullanılır.
 */
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import {
  applicationFixture,
  applicationsFixture,
  candidateFixture,
  candidatesFixture,
  departmentFixture,
  employeeFixture,
  employeesFixture,
  funnelFixture,
  orgTreeFixture,
  orgUnitChild,
  orgUnitRoot,
  positionFixture,
  positionsFixture,
} from '../../../test/fixtures/hrFixtures';
import {
  API_ORIGIN,
  HR_BASE,
  archiveOrgUnitOk,
  createCapture,
  createOrgUnitOk,
  deleteCandidateOk,
  hrError,
  listCandidatesOk,
  listEmployeesOk,
  listPositionsOk,
  orgTreeOk,
  recruitmentFunnelOk,
  updateOrgUnitOk,
} from '../../../test/msw/hrHandlers';
import { server } from '../../../test/msw/server';
import { StaticAuthTokenProvider } from '../application/ports/AuthTokenProvider';
import { HrApiClient } from '../infrastructure/api/HrApiClient';

const TOKEN = 'test-token-123';

function makeClient(token: string | null = TOKEN): HrApiClient {
  return new HrApiClient(API_ORIGIN, new StaticAuthTokenProvider(token));
}

describe('HrApiClient — happy path', () => {
  it('GET /org-tree returns data, Authorization Bearer header and URL correct', async () => {
    const capture = createCapture();
    server.use(orgTreeOk(orgTreeFixture, capture));

    const client = makeClient();
    const result = await client.getOrgTree(100);

    expect(result).toEqual(orgTreeFixture);
    expect(capture.calls).toHaveLength(1);
    const call = capture.calls[0]!;
    expect(call.method).toBe('GET');
    expect(call.authHeader).toBe(`Bearer ${TOKEN}`);
    expect(call.url).toBe(`${HR_BASE}/org-tree?companyId=100`);
    expect(call.searchParams).toEqual({ companyId: '100' });
  });

  it('GET /org-tree includes includeInactive flag in query', async () => {
    const capture = createCapture();
    server.use(orgTreeOk(orgTreeFixture, capture));

    const client = makeClient();
    await client.getOrgTree(100, { includeInactive: true });

    expect(capture.calls[0]!.searchParams).toEqual({
      companyId: '100',
      includeInactive: 'true',
    });
  });

  it('POST /org-units serializes body as JSON with Content-Type', async () => {
    const capture = createCapture();
    server.use(createOrgUnitOk(orgUnitChild, capture));

    const client = makeClient();
    const body = {
      companyId: 100,
      parentId: 1,
      name: 'Mühendislik',
      code: 'ENG',
      sortOrder: 1,
    };
    const result = await client.createOrgUnit(body);

    expect(result).toEqual(orgUnitChild);
    const call = capture.calls[0]!;
    expect(call.method).toBe('POST');
    expect(call.contentType).toBe('application/json');
    expect(call.body).toEqual(body);
    expect(call.url).toBe(`${HR_BASE}/org-units`);
    expect(call.authHeader).toBe(`Bearer ${TOKEN}`);
  });

  it('PATCH /org-units/:id targets the correct URL', async () => {
    const capture = createCapture();
    server.use(updateOrgUnitOk(orgUnitRoot, capture));

    const client = makeClient();
    const result = await client.updateOrgUnit(42, { companyId: 100, name: 'Yeni Ad' });

    expect(result).toEqual(orgUnitRoot);
    const call = capture.calls[0]!;
    expect(call.method).toBe('PATCH');
    expect(call.url).toBe(`${HR_BASE}/org-units/42`);
    expect(call.body).toEqual({ companyId: 100, name: 'Yeni Ad' });
  });

  it('DELETE /org-units/:id returns the archived unit when server responds JSON', async () => {
    const capture = createCapture();
    server.use(archiveOrgUnitOk(orgUnitRoot, capture));

    const client = makeClient();
    const result = await client.archiveOrgUnit(1, 100);

    expect(result).toEqual(orgUnitRoot);
    const call = capture.calls[0]!;
    expect(call.method).toBe('DELETE');
    expect(call.url).toBe(`${HR_BASE}/org-units/1?companyId=100`);
  });

  it('DELETE /candidates/:id returns undefined when server responds 204', async () => {
    const capture = createCapture();
    server.use(deleteCandidateOk(capture));

    const client = makeClient();
    const result = await client.deleteCandidate(40, 100);

    expect(result).toBeUndefined();
    const call = capture.calls[0]!;
    expect(call.method).toBe('DELETE');
    expect(call.url).toBe(`${HR_BASE}/candidates/40?companyId=100`);
  });

  it('GET /applications/funnel parses response', async () => {
    server.use(recruitmentFunnelOk(funnelFixture));

    const client = makeClient();
    const result = await client.getRecruitmentFunnel(100, 20);

    expect(result).toEqual(funnelFixture);
  });

  it('GET /applications/funnel omits positionId when undefined', async () => {
    const capture = createCapture();
    server.use(recruitmentFunnelOk(funnelFixture, capture));

    const client = makeClient();
    await client.getRecruitmentFunnel(100);

    expect(capture.calls[0]!.searchParams).toEqual({ companyId: '100' });
  });

  it('GET /positions maps status + departmentId filters into query', async () => {
    const capture = createCapture();
    server.use(listPositionsOk(positionsFixture, capture));

    const client = makeClient();
    const result = await client.listPositions(100, { status: 'open', departmentId: 10 });

    expect(result).toEqual(positionsFixture);
    expect(capture.calls[0]!.searchParams).toEqual({
      companyId: '100',
      status: 'open',
      departmentId: '10',
    });
  });

  it('GET /positions skips null departmentId', async () => {
    const capture = createCapture();
    server.use(listPositionsOk(positionsFixture, capture));

    const client = makeClient();
    await client.listPositions(100, { status: 'draft', departmentId: null });

    expect(capture.calls[0]!.searchParams).toEqual({
      companyId: '100',
      status: 'draft',
    });
  });

  it('GET /employees maps status, departmentId, positionId, q', async () => {
    const capture = createCapture();
    server.use(listEmployeesOk(employeesFixture, capture));

    const client = makeClient();
    await client.listEmployees(100, {
      status: 'active',
      departmentId: 10,
      positionId: 20,
      q: 'Ada',
    });

    expect(capture.calls[0]!.searchParams).toEqual({
      companyId: '100',
      status: 'active',
      departmentId: '10',
      positionId: '20',
      q: 'Ada',
    });
  });

  it('GET /employees omits empty q string', async () => {
    const capture = createCapture();
    server.use(listEmployeesOk(employeesFixture, capture));

    const client = makeClient();
    await client.listEmployees(100, { q: '' });

    expect(capture.calls[0]!.searchParams).toEqual({ companyId: '100' });
  });

  it('GET /candidates maps source and q filters', async () => {
    const capture = createCapture();
    server.use(listCandidatesOk(candidatesFixture, capture));

    const client = makeClient();
    const result = await client.listCandidates(100, { source: 'linkedin', q: 'Alan' });

    expect(result).toEqual(candidatesFixture);
    expect(capture.calls[0]!.searchParams).toEqual({
      companyId: '100',
      source: 'linkedin',
      q: 'Alan',
    });
  });

  it('GET /applications maps positionId/candidateId/stage filters', async () => {
    const capture = createCapture();
    server.use(
      http.get(`${HR_BASE}/applications`, async ({ request }) => {
        const url = new URL(request.url);
        capture.push({
          url: request.url,
          method: request.method,
          authHeader: request.headers.get('authorization'),
          contentType: request.headers.get('content-type'),
          body: undefined,
          searchParams: Object.fromEntries(url.searchParams),
        });
        return HttpResponse.json(applicationsFixture);
      }),
    );

    const client = makeClient();
    const result = await client.listApplications(100, {
      positionId: 20,
      candidateId: 40,
      stage: 'interview',
    });

    expect(result).toEqual(applicationsFixture);
    expect(capture.calls[0]!.searchParams).toEqual({
      companyId: '100',
      positionId: '20',
      candidateId: '40',
      stage: 'interview',
    });
  });

  it('POST /applications/:id/reject sends companyId + reason in body', async () => {
    const capture = createCapture();
    server.use(
      http.post(`${HR_BASE}/applications/:id/reject`, async ({ request }) => {
        const body = (await request.clone().json()) as unknown;
        capture.push({
          url: request.url,
          method: request.method,
          authHeader: request.headers.get('authorization'),
          contentType: request.headers.get('content-type'),
          body,
          searchParams: {},
        });
        return HttpResponse.json(applicationFixture);
      }),
    );

    const client = makeClient();
    const result = await client.rejectApplication(50, 100, 'culture mismatch');

    expect(result).toEqual(applicationFixture);
    const call = capture.calls[0]!;
    expect(call.url).toBe(`${HR_BASE}/applications/50/reject`);
    expect(call.body).toEqual({ companyId: 100, reason: 'culture mismatch' });
  });

  it('POST /applications/:id/withdraw omits note when undefined', async () => {
    const capture = createCapture();
    server.use(
      http.post(`${HR_BASE}/applications/:id/withdraw`, async ({ request }) => {
        const body = (await request.clone().json()) as unknown;
        capture.push({
          url: request.url,
          method: request.method,
          authHeader: request.headers.get('authorization'),
          contentType: request.headers.get('content-type'),
          body,
          searchParams: {},
        });
        return HttpResponse.json(applicationFixture);
      }),
    );

    const client = makeClient();
    await client.withdrawApplication(50, 100);

    expect(capture.calls[0]!.body).toEqual({ companyId: 100 });
  });

  it('POST /positions creates and returns the new position', async () => {
    server.use(http.post(`${HR_BASE}/positions`, () => HttpResponse.json(positionFixture)));

    const client = makeClient();
    const result = await client.createPosition({
      companyId: 100,
      departmentId: 10,
      title: 'Senior Engineer',
    });

    expect(result).toEqual(positionFixture);
  });

  it('POST /departments returns the created department', async () => {
    server.use(http.post(`${HR_BASE}/departments`, () => HttpResponse.json(departmentFixture)));

    const client = makeClient();
    const result = await client.createDepartment({
      companyId: 100,
      orgUnitId: 2,
      name: 'Backend',
    });

    expect(result).toEqual(departmentFixture);
  });

  it('POST /employees returns the hired employee', async () => {
    server.use(http.post(`${HR_BASE}/employees`, () => HttpResponse.json(employeeFixture)));

    const client = makeClient();
    const result = await client.hireEmployee({
      companyId: 100,
      departmentId: 10,
      positionId: 20,
      firstName: 'Ada',
      lastName: 'Lovelace',
      hireDate: '2026-01-01',
    });

    expect(result).toEqual(employeeFixture);
  });

  it('POST /candidates returns the registered candidate', async () => {
    server.use(http.post(`${HR_BASE}/candidates`, () => HttpResponse.json(candidateFixture)));

    const client = makeClient();
    const result = await client.registerCandidate({
      companyId: 100,
      firstName: 'Alan',
      lastName: 'Turing',
    });

    expect(result).toEqual(candidateFixture);
  });
});

describe('HrApiClient — error path', () => {
  it('401 → throws with server message', async () => {
    server.use(
      hrError('get', '/org-tree', { status: 401, message: 'Unauthorized — token expired' }),
    );

    const client = makeClient();
    await expect(client.getOrgTree(100)).rejects.toThrow('Unauthorized — token expired');
  });

  it('403 → throws hr_manager rolü hatasi', async () => {
    server.use(hrError('post', '/org-units', { status: 403, message: 'hr_manager rolü gerekli' }));

    const client = makeClient();
    await expect(
      client.createOrgUnit({ companyId: 100, parentId: null, name: 'X' }),
    ).rejects.toThrow('hr_manager rolü gerekli');
  });

  it('404 → throws server message', async () => {
    server.use(hrError('patch', '/org-units/:id', { status: 404, message: 'OrgUnit not found' }));

    const client = makeClient();
    await expect(client.updateOrgUnit(999, { companyId: 100 })).rejects.toThrow(
      'OrgUnit not found',
    );
  });

  it('422 → validation error message parsed from body', async () => {
    server.use(
      hrError('post', '/employees', {
        status: 422,
        message: 'hireDate must be a valid ISO date',
      }),
    );

    const client = makeClient();
    await expect(
      client.hireEmployee({
        companyId: 100,
        departmentId: 10,
        positionId: null,
        firstName: 'X',
        lastName: 'Y',
        hireDate: 'bad-date',
      }),
    ).rejects.toThrow('hireDate must be a valid ISO date');
  });

  it('500 → falls back to generic HTTP message when body has no message', async () => {
    server.use(hrError('get', '/positions', { status: 500 }));

    const client = makeClient();
    await expect(client.listPositions(100)).rejects.toThrow('HTTP 500');
  });

  it('500 with non-JSON body → falls back to HTTP status message', async () => {
    server.use(
      http.get(
        `${HR_BASE}/positions`,
        () => new HttpResponse('Internal server error', { status: 500 }),
      ),
    );

    const client = makeClient();
    await expect(client.listPositions(100)).rejects.toThrow('HTTP 500');
  });
});

describe('HrApiClient — token handling', () => {
  it('throws and does not call fetch when token is null', async () => {
    const client = makeClient(null);
    // No handler registered intentionally — if request reaches MSW the test
    // would fail with "onUnhandledRequest: 'error'".
    await expect(client.getOrgTree(100)).rejects.toThrow('Auth token yok — önce giriş yapın');
  });

  it('throws when token is empty string', async () => {
    const client = makeClient('');
    await expect(client.getOrgTree(100)).rejects.toThrow('Auth token yok — önce giriş yapın');
  });
});
