// =============================================================================
// Prometa One — ESLint Flat Config (ESLint 9+)
// =============================================================================
// Bu config kök seviyede yaşar ve tüm workspace'leri kapsar.
//
// Katmanlı kurallar:
//   - Tüm TS/TSX dosyalarda: typescript-eslint recommended-type-checked
//   - Frontend src/modules/**: React + hooks + a11y + boundaries
//   - api-server src/**: Node ortamı kuralları
//   - legacy/**: tamamen ignore
//   - App.jsx: gevşek mod (sadece syntax + no-undef)
// =============================================================================

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';

export default [
  // ---------------------------------------------------------------------------
  // 0) Global ignore'lar
  // ---------------------------------------------------------------------------
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.vite/**',
      '**/.cache/**',
      '**/*.min.js',
      '**/*.tsbuildinfo',
      'legacy/**',
      'ml-service/**',
      'frontend/public/**',
    ],
  },

  // ---------------------------------------------------------------------------
  // 1) Tüm JS/TS dosyalar için ortak baseline
  // ---------------------------------------------------------------------------
  js.configs.recommended,

  // ---------------------------------------------------------------------------
  // 2) TypeScript dosyaları — recommended + type-checked
  // ---------------------------------------------------------------------------
  ...tseslint.configs.recommendedTypeChecked.map((conf) => ({
    ...conf,
    files: ['**/*.ts', '**/*.tsx'],
  })),
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },

  // ---------------------------------------------------------------------------
  // 3) Frontend kuralları — React + hooks + a11y + import order
  // ---------------------------------------------------------------------------
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
    },
    settings: {
      react: { version: '18.3' },
      'import/resolver': {
        typescript: { project: 'frontend/tsconfig.json' },
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'react/prop-types': 'off', // TS zaten kontrol ediyor
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          pathGroups: [
            { pattern: 'react', group: 'external', position: 'before' },
            { pattern: '@app/**', group: 'internal' },
            { pattern: '@modules/**', group: 'internal' },
            { pattern: '@shared/**', group: 'internal' },
          ],
          pathGroupsExcludedImportTypes: ['react'],
        },
      ],
      'import/no-default-export': 'off', // React component'ları için kapalı
    },
  },

  // ---------------------------------------------------------------------------
  // 4) api-server kuralları — Node ortamı
  // ---------------------------------------------------------------------------
  {
    files: ['api-server/src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        typescript: { project: 'api-server/tsconfig.json' },
      },
    },
    rules: {
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          pathGroups: [
            { pattern: '@app/**', group: 'internal' },
            { pattern: '@modules/**', group: 'internal' },
            { pattern: '@shared/**', group: 'internal' },
          ],
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // ---------------------------------------------------------------------------
  // 5) Test dosyaları — daha gevşek
  // ---------------------------------------------------------------------------
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/__tests__/**/*'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  },

  // ---------------------------------------------------------------------------
  // 6) Eski App.jsx + JS dosyaları — minimum kontrol
  // ---------------------------------------------------------------------------
  {
    files: ['frontend/src/App.jsx', 'frontend/src/main.jsx', 'frontend/src/api.js', 'frontend/src/utils/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // Eski kod — sadece kritik hataları yakala
      'no-undef': 'error',
      'no-unused-vars': 'off', // 81K satırda binlerce false-positive var
      'no-empty': 'off',
      'no-constant-condition': 'off',
    },
  },

  // ---------------------------------------------------------------------------
  // 7) Config dosyaları (Node ortamı)
  // ---------------------------------------------------------------------------
  {
    files: ['*.config.{js,ts,cjs,mjs}', '**/*.config.{js,ts,cjs,mjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'import/no-default-export': 'off',
    },
  },

  // ---------------------------------------------------------------------------
  // 8) Prettier ile çakışan kuralları KAPAT (her zaman EN SONDA)
  // ---------------------------------------------------------------------------
  prettierConfig,
];
