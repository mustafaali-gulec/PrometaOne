/**
 * Prometa One — Conventional Commits enforced via commitlint.
 *
 * Format: <type>(<scope>)?: <subject>
 *
 * Örnekler:
 *   feat(modules/notifications): bell drop-down çalışan kişiye filtreliyor
 *   fix(api-server/auth): JWT exp tarihi UTC'de değildi
 *   refactor(legacy): strangle invoice list out of App.jsx
 *   chore(deps): bump typescript to 5.6.3
 *   docs(adr): add 0004 dependency injection decision
 *
 * Tipler için ADR-0005 (henüz yazılmadı) veya `docs/CONTRIBUTING.md`'a bakın.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // İzin verilen type'lar
    'type-enum': [
      2,
      'always',
      [
        'feat', // Yeni özellik
        'fix', // Bug fix
        'refactor', // Davranışı değiştirmeyen kod düzenleme
        'perf', // Performans iyileştirmesi
        'style', // Format/whitespace (kod davranışı değişmez)
        'test', // Test ekleme/düzeltme
        'docs', // Dokümantasyon
        'build', // Build sistemi / bağımlılıklar
        'ci', // CI config
        'chore', // Bakım, ne feat ne fix
        'revert', // Bir commit'i geri al
      ],
    ],

    // Subject zorunlu, lowercase ile başlamalı, nokta ile bitmemeli
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-case': [
      2,
      'never',
      ['sentence-case', 'start-case', 'pascal-case', 'upper-case'],
    ],

    // Header uzunluğu — okumayı zorlaştırmasın
    'header-max-length': [2, 'always', 100],

    // Body line uzunluğu
    'body-max-line-length': [2, 'always', 100],

    // Scope opsiyonel ama varsa lowercase kebab-case
    'scope-case': [2, 'always', 'kebab-case'],

    // Type lowercase
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
  },
};
