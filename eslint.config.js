import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // A leading underscore marks a value dropped on purpose (e.g. omitted from a rest spread).
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // Data layer boundary (CLAUDE.md): UI never imports Supabase directly.
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@supabase/*'], message: 'Import from src/data only.' }] },
      ],
    },
  },
  {
    // Route table, not a component module.
    files: ['src/app/router.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: { 'no-unused-vars': ['error', { ignoreRestSiblings: true }] },
  },
);
