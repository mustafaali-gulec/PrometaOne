import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Yazılım sürümü tek kaynaktan (package.json) gelir; UI'da sol menünün altında
// gösterilir. Build zamanında sabite çevrilir, runtime'da package.json okunmaz.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

// Derleme kimliği (kısa commit SHA). Sürüm yalnızca yayın kesilirken artar
// (docs/RELEASE.md), oysa master günde birkaç kez deploy olabilir — "şu an hangi
// kod çalışıyor" sorusunun cevabı bu SHA'dır.
//   1) VITE_COMMIT_SHA / GITHUB_SHA — .git'e erişimi olmayan ortamlar (yalnızca
//      frontend/ dizinini bind-mount eden konteyner, CI imaj build'i) için.
//   2) git — repo içinden çalışan dev/build.
//   3) boş — rozet yalnızca sürümü gösterir, hata vermez.
const commitSha = (() => {
  const fromEnv = process.env.VITE_COMMIT_SHA || process.env.GITHUB_SHA || '';
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      cwd: fileURLToPath(new URL('.', import.meta.url)),
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
})();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commitSha),
  },
  server: {
    port: 5173,
    host: true,
    // Docker bind-mount (Windows host → Linux container) üzerinden inotify fs olayları
    // iletilmiyor → Vite dosya değişimini görmez, HMR tetiklenmez, eski transform serve
    // edilir. Polling ile değişiklikler güvenilir algılanır (bare-metal'de de zararsız).
    watch: { usePolling: true, interval: 300 },
    // Backend API'yi proxy'le (CORS sorununu önler).
    // Frontend Docker container'i icinde backend ayri network/compose'da olabilir;
    // host port map'i uzerinden host.docker.internal ile erisilir. Bare-metal local
    // dev icin VITE_PROXY_TARGET=http://localhost:3000 verin.
    proxy: {
      // Şantiye Yönetim BAĞIMSIZ mikroservis (construction-service, :3002).
      // Daha spesifik kural önce gelmeli — /v1/construction/* monolit yerine
      // servise gider; gerisi (/v1/*) monolite. UI değişmez (relative çağrılar).
      '/v1/construction': {
        target: process.env.VITE_CONSTRUCTION_TARGET || 'http://host.docker.internal:3002',
        changeOrigin: true,
      },
      '/v1': {
        target: process.env.VITE_PROXY_TARGET || 'http://host.docker.internal:3000',
        changeOrigin: true,
      },
      // ML servisi (FastAPI :8001). Prod'daki nginx ile aynı sözleşme:
      // /api/ml/x -> /x (ml-service rotaları kökte: /health, /models, /v1/feedback...)
      '/api/ml': {
        target: process.env.VITE_ML_PROXY_TARGET || 'http://host.docker.internal:8001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/ml/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
