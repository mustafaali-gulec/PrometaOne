/**
 * Vitest global setup — jest-dom matcher'lari + MSW lifecycle + Testing
 * Library cleanup.
 *
 * Her test öncesi/sonrasi:
 *  - MSW handler'lar resetlenir (testler birbirinden bağımsız).
 *  - Testing Library `cleanup()` çağrılır — Vitest 3 ile @testing-library/react
 *    artık otomatik cleanup yapmıyor (Vitest 2'de globals=true ile yapardı).
 *    Manuel afterEach ile DOM'u temizleriz, render'lar birikmez.
 *
 * `onUnhandledRequest: 'error'` ayarı, MSW'de tanımlanmamış bir endpoint
 * çağrıldığında testi kırar — bu sayede unutulan stub'lar erkenden yakalanır.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './msw/server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
