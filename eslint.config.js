// =============================================================================
// Prometa One — ESLint Flat Config (ESLint 9+)
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
  // 0) Global ignores
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
      // Eski 81K satırlık monolith — Strangler Fig sırasında modul-modul
      // cikarilacak, bitince silinecek. ESLint ona dokunmaz.
      'frontend/src/App.jsx',
      'frontend/src/main.jsx',
      'frontend/src/api.js',
      'frontend/src/utils/**',
    ],
  },

  // 1) Baseline JS recommended
  js.configs.recommended,

  // 2) TypeScript recommended-type-checked
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

  // 3) Frontend (React + a11y + import order)
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
      'react/prop-types': 'off',
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
    },
  },

  // 4) api-server (Node env + import order)
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

  // 5) Test dosyalari (gevsek)
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/__tests__/**/*'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  },

  // 6) Config dosyalari (Node env)
  {
    files: ['*.config.{js,ts,cjs,mjs}', '**/*.config.{js,ts,cjs,mjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // 7) Prettier — her zaman en sonda
  prettierConfig,
];
