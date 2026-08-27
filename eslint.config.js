import js from '@eslint/js';
import globals from 'globals';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  {
    ignores: [
      'coverage/**',
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        sourceType: 'module',
      },
    },
    plugins: {
      'jsx-a11y': jsxA11y,
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: [
      'src/**/*.test.{js,jsx}',
      'src/**/*.spec.{js,jsx}',
      'src/test/**/*.{js,jsx}',
      'tests/**/*.{js,jsx}',
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
  {
    files: [
      'eslint.config.js',
      'playwright.config.js',
      'postcss.config.js',
      'tailwind.config.js',
      'vite.config.js',
      'vitest.config.js',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];