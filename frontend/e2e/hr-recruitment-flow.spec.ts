/**
 * E2E: HR uçtan uca işe alım akışı.
 *
 * Senaryo:
 *   1. /hr-demo.html sayfasına git, auth token ile login.
 *   2. Organizasyon sekmesinde: kök org-unit oluştur (REST endpoint'i UI'dan
 *      çağrılmadığı için bu adım API client ile yapılır — UI henüz
 *      yaratma form'unu içermiyor; sadece görüntüleme).
 *   3. Departman + Pozisyon API ile hazırlanır.
 *   4. İşe Alım sekmesinde: CandidateForm'u doldur → submit → aday oluşur.
 *   5. API ile Application oluştur (offer stage'e kadar manuel ilerlet —
 *      backend transition policy'sine saygı duy).
 *   6. Kanban'da başvuru kartını "Teklif" kolonundan "İşe Alındı"
 *      eşdeğerine sürükle (UI sadece 4 kolon, hire actionu ayrı —
 *      bu testte hire'ı API ile çağırıp Employees'te görmeyi doğrula).
 *   7. Personel sekmesinde: yeni Employee tabloda görünür.
 *
 * NOT: Frontend henüz "create org-unit" / "create department" formlarını
 * göstermiyor (read-only modül demo). Bu yüzden E2E her adımı UI ile yapamaz;
 * setup adımları REST API ile yapılır, asıl iddia "UI doğru veriyi gösterir"
 * üzerinde.
 *
 * E2E suite çalıştırma:
 *   1. PG (testcontainers veya lokal) hazır.
 *   2. api-server `npm run dev` (port 3000).
 *   3. frontend `npm run dev` (port 5173).
 *   4. PROMETA_E2E_AUTH_TOKEN env değişkeni geçerli HR_MANAGER JWT.
 *   5. `npx playwright test`.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

const API_URL = process.env.PROMETA_E2E_API_URL ?? 'http://localhost:3000';
const AUTH_TOKEN = process.env.PROMETA_E2E_AUTH_TOKEN ?? '';
const _COMPANY_ID = Number(process.env.PROMETA_E2E_COMPANY_ID ?? '1');

if (AUTH_TOKEN === '') {
  console.warn('⚠ PROMETA_E2E_AUTH_TOKEN env değişkeni boş — E2E testleri 401 alacak.');
}

async function apiPost<T>(req: APIRequestContext, path: string, body: unknown): Promise<T> {
  const res = await req.post(`${API_URL}${path}`, {
    headers: {
      authorization: `Bearer ${AUTH_TOKEN}`,
      'content-type': 'application/json',
    },
    data: body,
  });
  if (!res.ok()) {
    throw new Error(`POST ${path} → ${res.status()} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

test.describe('HR uçtan uca işe alım akışı', () => {
  test("aday başvurur, hire edilir, Employees'te otomatik görünür", async ({ page, request }) => {
    test.setTimeout(60_000);

    // 1) Setup — API ile org-unit + department + position oluştur.
    const orgUnit = await apiPost<{ orgUnit: { id: number } }>(request, '/v1/hr/org-units', {
      name: 'E2E HQ',
      code: `E2E-HQ-${Date.now()}`,
    });
    const department = await apiPost<{ department: { id: number } }>(
      request,
      '/v1/hr/departments',
      { orgUnitId: orgUnit.orgUnit.id, name: 'E2E Engineering' },
    );
    const position = await apiPost<{ position: { id: number } }>(request, '/v1/hr/positions', {
      departmentId: department.department.id,
      title: 'E2E Senior Engineer',
      headcountTarget: 1,
      status: 'open',
    });

    // 2) Sayfaya git, token ile login (hash fragment).
    await page.goto(`/hr-demo.html#token=${AUTH_TOKEN}`);
    await expect(page.getByRole('heading', { name: /Demo|HR|Organizasyon/i })).toBeVisible({
      timeout: 10_000,
    });

    // 3) İşe Alım sekmesine geç ve CandidateForm'a aday gir.
    await page.getByRole('tab', { name: /İşe Alım/i }).click();
    await page.getByLabel(/Ad \*/).fill('E2E Ali');
    await page.getByLabel(/Soyad \*/).fill('E2E Veli');
    await page.getByLabel(/E-posta/).fill(`e2e+${Date.now()}@example.com`);
    await page.getByRole('button', { name: /Aday Kaydet/i }).click();

    // 4) API ile son adayı al → application oluştur ve offer'a kadar ilerlet.
    const candidatesResp = await request.get(`${API_URL}/v1/hr/candidates`, {
      headers: { authorization: `Bearer ${AUTH_TOKEN}` },
    });
    const candidatesBody = (await candidatesResp.json()) as {
      candidates: { id: number; firstName: string }[];
    };
    const cand = candidatesBody.candidates.find((c) => c.firstName === 'E2E Ali');
    expect(cand, 'Yeni aday API yanıtında bulundu').toBeDefined();

    const app = await apiPost<{ application: { id: number } }>(request, '/v1/hr/applications', {
      candidateId: cand!.id,
      positionId: position.position.id,
    });

    // Stage chain: new → screening → interview → offer
    for (const stage of ['screening', 'interview', 'offer'] as const) {
      await apiPost(request, `/v1/hr/applications/${app.application.id}/move-stage`, {
        newStage: stage,
      });
    }

    // 5) Hire — UI'da ayrı bir buton yok; API ile çağır.
    const employee = await apiPost<{ employee: { id: number; fullName: string } }>(
      request,
      `/v1/hr/applications/${app.application.id}/hire`,
      { departmentId: department.department.id, hireDate: '2026-06-01' },
    );

    // 6) UI: Personel sekmesinde yeni Employee görünür.
    await page.getByRole('tab', { name: /Personel/i }).click();
    await expect(page.getByText(employee.employee.fullName)).toBeVisible({ timeout: 10_000 });

    // 7) Funnel: hired count en az 1.
    await page.getByRole('tab', { name: /İşe Alım/i }).click();
    await expect(page.getByText(/İşe Alındı/i)).toBeVisible();
  });
});
