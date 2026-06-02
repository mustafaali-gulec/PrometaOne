import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// =============================================================================
// Vitest config — frontend unit/integration testleri
// -----------------------------------------------------------------------------
// - happy-dom: jsdom alternatifi — modern ESM, daha hızlı, Node version
//   uyumluluk sorunu yaşamaz. React hook + DOM testleri için yeterli.
// - globals: false → describe/it/expect import edilir (TS strict ile daha güvenli)
// - setupFiles: jest-dom matcher'lari + MSW server lifecycle
// - include: yalnız src altındaki *.test.{ts,tsx}; e2e Playwright klasörü
//   bu projede henüz yok ama ileride eklenecek.
// =============================================================================
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'e2e/**'],
  },
});
