/**
 * HR endpoint handler factory'leri (MSW v2 API).
 *
 * Burada her endpoint için "Ok" / "Unauthorized" / "Forbidden" / "NotFound" /
 * "Validation" gibi factory'ler tutarız. Testler `server.use(orgTreeOk(data))`
 * benzeri çağrı ile spesifik fixture'larını yükler.
 *
 * Test base URL'i `HR_BASE` constant'ından gelir — HrApiClient bu URL ile
 * konstrükte edilir.
 */
import { http, HttpResponse, type HttpHandler } from 'msw';

import type {
  ApplicationDto,
  ApplicationsResponse,
  CandidateDto,
  CandidatesResponse,
  DepartmentDto,
  EmployeeDto,
  EmployeesResponse,
  OrgTreeResponse,
  OrgUnitDto,
  PositionDto,
  PositionsResponse,
  RecruitmentFunnelDto,
} from '../../modules/hr/application/dto/HrDtos';

export const API_ORIGIN = 'http://api.test';
export const HR_BASE = `${API_ORIGIN}/v1/hr`;

// ---------------------------------------------------------------------------
// Generic hata factory'leri — herhangi bir path için statü/mesaj döndürür.
// ---------------------------------------------------------------------------
type Method = 'get' | 'post' | 'patch' | 'delete';

interface ErrorOptions {
  status: number;
  message?: string;
}

function errorResponse({ status, message }: ErrorOptions) {
  if (message === undefined) {
    return new HttpResponse(null, { status });
  }
  return HttpResponse.json({ message }, { status });
}

export function hrError(method: Method, pathSuffix: string, options: ErrorOptions): HttpHandler {
  const url = `${HR_BASE}${pathSuffix}`;
  return http[method](url, () => errorResponse(options));
}

// ---------------------------------------------------------------------------
// Capture helper — istek gövdesini/headerlarını test'te assert etmek için
// ---------------------------------------------------------------------------
export interface CapturedRequest {
  url: string;
  method: string;
  authHeader: string | null;
  contentType: string | null;
  body: unknown;
  searchParams: Record<string, string>;
}

export interface RequestCapture {
  readonly calls: ReadonlyArray<CapturedRequest>;
  reset(): void;
}

export function createCapture(): RequestCapture & { push(c: CapturedRequest): void } {
  const calls: CapturedRequest[] = [];
  return {
    get calls() {
      return calls;
    },
    push(c) {
      calls.push(c);
    },
    reset() {
      calls.length = 0;
    },
  };
}

async function captureRequest(
  request: Request,
  capture: ReturnType<typeof createCapture>,
): Promise<void> {
  let body: unknown = undefined;
  const ct = request.headers.get('content-type');
  if (ct !== null && ct.includes('application/json')) {
    try {
      body = await request.clone().json();
    } catch {
      body = null;
    }
  }
  const url = new URL(request.url);
  const searchParams: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    searchParams[k] = v;
  });
  capture.push({
    url: request.url,
    method: request.method,
    authHeader: request.headers.get('authorization'),
    contentType: ct,
    body,
    searchParams,
  });
}

// ---------------------------------------------------------------------------
// OrgUnit
// ---------------------------------------------------------------------------
export const orgTreeOk = (
  data: OrgTreeResponse,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.get(`${HR_BASE}/org-tree`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const createOrgUnitOk = (
  data: OrgUnitDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.post(`${HR_BASE}/org-units`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const updateOrgUnitOk = (
  data: OrgUnitDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.patch(`${HR_BASE}/org-units/:id`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const moveOrgUnitOk = (
  data: OrgUnitDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.post(`${HR_BASE}/org-units/:id/move`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const archiveOrgUnitOk = (
  data: OrgUnitDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.delete(`${HR_BASE}/org-units/:id`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

// ---------------------------------------------------------------------------
// Department
// ---------------------------------------------------------------------------
export const createDepartmentOk = (
  data: DepartmentDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.post(`${HR_BASE}/departments`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const updateDepartmentOk = (
  data: DepartmentDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.patch(`${HR_BASE}/departments/:id`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const archiveDepartmentOk = (
  data: DepartmentDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.delete(`${HR_BASE}/departments/:id`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const assignManagerOk = (
  data: DepartmentDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.post(`${HR_BASE}/departments/:id/assign-manager`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

// ---------------------------------------------------------------------------
// Position
// ---------------------------------------------------------------------------
export const listPositionsOk = (
  data: PositionsResponse,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.get(`${HR_BASE}/positions`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const createPositionOk = (
  data: PositionDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.post(`${HR_BASE}/positions`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const updatePositionOk = (
  data: PositionDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.patch(`${HR_BASE}/positions/:id`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const closePositionOk = (
  data: PositionDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.post(`${HR_BASE}/positions/:id/close`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

// ---------------------------------------------------------------------------
// Employee
// ---------------------------------------------------------------------------
export const listEmployeesOk = (
  data: EmployeesResponse,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.get(`${HR_BASE}/employees`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const hireEmployeeOk = (
  data: EmployeeDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.post(`${HR_BASE}/employees`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const updateEmployeeOk = (
  data: EmployeeDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.patch(`${HR_BASE}/employees/:id`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const transferEmployeeOk = (
  data: EmployeeDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.post(`${HR_BASE}/employees/:id/transfer`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const terminateEmployeeOk = (
  data: EmployeeDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.post(`${HR_BASE}/employees/:id/terminate`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const linkEmployeeOk = (
  data: EmployeeDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.post(`${HR_BASE}/employees/:id/link-user`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const unlinkEmployeeOk = (
  data: EmployeeDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.delete(`${HR_BASE}/employees/:id/link-user`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

// ---------------------------------------------------------------------------
// Candidate
// ---------------------------------------------------------------------------
export const listCandidatesOk = (
  data: CandidatesResponse,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.get(`${HR_BASE}/candidates`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const registerCandidateOk = (
  data: CandidateDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.post(`${HR_BASE}/candidates`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const deleteCandidateOk = (capture?: ReturnType<typeof createCapture>): HttpHandler =>
  http.delete(`${HR_BASE}/candidates/:id`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return new HttpResponse(null, { status: 204 });
  });

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------
export const listApplicationsOk = (
  data: ApplicationsResponse,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.get(`${HR_BASE}/applications`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const recruitmentFunnelOk = (
  data: RecruitmentFunnelDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.get(`${HR_BASE}/applications/funnel`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const submitApplicationOk = (
  data: ApplicationDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.post(`${HR_BASE}/applications`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const moveApplicationStageOk = (
  data: ApplicationDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.post(`${HR_BASE}/applications/:id/move-stage`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const rejectApplicationOk = (
  data: ApplicationDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.post(`${HR_BASE}/applications/:id/reject`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const withdrawApplicationOk = (
  data: ApplicationDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.post(`${HR_BASE}/applications/:id/withdraw`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });

export const hireFromApplicationOk = (
  data: EmployeeDto,
  capture?: ReturnType<typeof createCapture>,
): HttpHandler =>
  http.post(`${HR_BASE}/applications/:id/hire`, async ({ request }) => {
    if (capture !== undefined) await captureRequest(request, capture);
    return HttpResponse.json(data);
  });
