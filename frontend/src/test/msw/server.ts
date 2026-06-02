/**
 * MSW Node server — frontend unit testleri için.
 *
 * Tek bir paylaşılan instance; setup.ts'te beforeAll/afterEach/afterAll
 * lifecycle hook'larına bağlanır. Her test kendi handler'larını
 * `server.use(...)` ile eklemeli; `resetHandlers()` her test sonrası
 * temizler.
 */
import { setupServer } from 'msw/node';

export const server = setupServer();
