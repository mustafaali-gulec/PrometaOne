/**
 * Standalone demo sayfası — ConstructionPage'i App.jsx'e dokunmadan izole açar.
 *
 * URL: http://localhost:5173/santiye-demo.html
 *
 * Neden var: şantiye ekranlarını doğrulamak için uygulamaya giriş yapmak ve menü
 * ağacından ilerlemek gerekiyordu. Bu sayfa modülü doğrudan mount eder — sekme
 * seçimi ve dil URL'den gelir, böylece bir ekran tek adreste açılıp
 * ekran görüntüsüyle doğrulanabilir.
 *
 * Token edinmek için (birinden biri yeter):
 *   - #token=... hash parametresi
 *   - localStorage.setItem('promet_access_token', '...')
 *
 * Örnekler:
 *   /santiye-demo.html#token=eyJ...
 *   /santiye-demo.html?tab=performance&lang=en#token=eyJ...
 *
 * API çağrıları relative gider (apiBaseUrl=''), yani vite proxy'si üzerinden
 * construction-service'e ulaşır. Yerel servise yönlendirmek için:
 *   VITE_CONSTRUCTION_TARGET=http://localhost:3003 npx vite
 */
import { createRoot } from 'react-dom/client';

import { ConstructionPage, type ConstructionTab } from './modules/construction-site';

const container = document.getElementById('santiye-demo-root');
if (!container) {
  throw new Error('#santiye-demo-root bulunamadi');
}

const params = new URLSearchParams(window.location.search);

const TABS: ConstructionTab[] = [
  'projects',
  'contracts',
  'boq',
  'progress',
  'measurements',
  'finance',
  'depot',
  'labor',
  'reports',
  'poz',
  'locations',
  'templates',
  'trackings',
  'dailylog',
  'performance',
  'approvals',
];

const tabParam = params.get('tab');
const tab: ConstructionTab | undefined =
  tabParam !== null && (TABS as string[]).includes(tabParam)
    ? (tabParam as ConstructionTab)
    : undefined;

const companyId = Number(params.get('companyId') ?? '1') || 1;
const lang = params.get('lang') ?? 'tr';

createRoot(container).render(
  <ConstructionPage
    apiBaseUrl=""
    companyId={companyId}
    lang={lang}
    {...(tab === undefined ? {} : { initialTab: tab })}
    // Kilit açma düğmesi demo sayfasında görünsün ki akış tam denenebilsin;
    // gerçek uygulamada canAct("construction.daily_log.approve") karar verir.
    canUnlockDailyLog
    // Onay akışında yönetici yetkileri de demo sayfasında açık; gerçek
    // uygulamada canAct("construction.approvals.*") karar verir.
    canApproveFlows
    canCreateFlows
  />,
);
