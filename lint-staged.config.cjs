/**
 * Prometa One — lint-staged
 *
 * Pre-commit hook'unda sadece staged dosyalara format + lint çalıştırır.
 * Tüm projeyi her commit'te değil — sadece dokunulanları tarar.
 */
module.exports = {
  // TS/TSX dosyaları: ESLint (auto-fix) + Prettier
  '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],

  // JS/JSX dosyaları (yeni kod — legacy App.jsx Prettier ignore'da)
  '*.{js,jsx,mjs,cjs}': ['eslint --fix', 'prettier --write'],

  // Stil / markup
  '*.{css,scss,html,md,mdx,json,jsonc,yml,yaml}': ['prettier --write'],
};
