/**
 * Standalone demo sayfası — HrDemoPage'i izole test eder.
 *
 * App.jsx'e dokunmaz. URL: http://localhost:5173/hr-demo.html
 *
 * Token edinmek için:
 *   - #token=... hash parametresi
 *   - veya localStorage.setItem('promet_access_token', '...')
 */
import { createRoot } from 'react-dom/client';

import { HrDemoPage } from './modules/hr';

const container = document.getElementById('hr-demo-root');
if (!container) {
  throw new Error('#hr-demo-root bulunamadi');
}
createRoot(container).render(<HrDemoPage apiBaseUrl="http://localhost:3000" />);
