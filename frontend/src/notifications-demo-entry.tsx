/**
 * Standalone demo sayfası — NotificationBell modülünü izole test eder.
 *
 * App.jsx'e hiç dokunmaz. URL: http://localhost:5173/notifications-demo.html
 *
 * Login formu + bell. Token localStorage'da tutulur.
 */
import { createRoot } from 'react-dom/client';

import { NotificationsDemoPage } from './modules/notifications/demo/NotificationsDemoPage';

const container = document.getElementById('notifications-root');
if (!container) {
  throw new Error('#notifications-root bulunamadi');
}
createRoot(container).render(<NotificationsDemoPage apiBaseUrl="http://localhost:3000" />);
