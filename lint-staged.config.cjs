/**
 * Prometa One — lint-staged
 *
 * Pre-commit hook'unda sadece staged dosyalara format + lint çalıştırır.
 * Tüm projeyi her commit'te değil — sadece dokunulanları tarar.
 */
module.exports = {
  // TS/TSX dosyaları: ESLint (auto-fix) + Prettier + i18n guard (Dil Ajanı)
  '*.{ts,tsx}': ['eslint --fix', 'prettier --write', 'node frontend/scripts/i18n-guard.cjs'],

  // JS/JSX dosyaları (yeni kod — legacy App.jsx Prettier ignore'da) + i18n guard
  '*.{js,jsx,mjs,cjs}': [
    'eslint --fix',
    'prettier --write',
    'node frontend/scripts/i18n-guard.cjs',
  ],

  // Stil / markup
  '*.{css,scss,html,md,mdx,json,jsonc,yml,yaml}': ['prettier --write'],
};
