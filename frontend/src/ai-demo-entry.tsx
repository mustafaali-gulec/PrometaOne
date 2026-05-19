/**
 * Standalone demo sayfası — AiAssistantWidget'i izole test eder.
 *
 * App.jsx'e dokunmaz. URL: http://localhost:5173/ai-demo.html
 */
import { createRoot } from 'react-dom/client';

import { AiDemoPage } from './modules/ai/demo/AiDemoPage';

const container = document.getElementById('ai-demo-root');
if (!container) {
  throw new Error('#ai-demo-root bulunamadi');
}
createRoot(container).render(<AiDemoPage apiBaseUrl="http://localhost:3000" />);
