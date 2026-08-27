import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/tests/browser/**',
      '**/browser-tests/**',
      '**/e2e/**',
      '**/*.browser.{js,jsx}',
      '**/*.e2e.{js,jsx}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/**/*.test.{js,jsx}',
        'src/**/*.spec.{js,jsx}',
        'src/test/**',
        'src/main.jsx',
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/tests/browser/**',
        '**/browser-tests/**',
        '**/e2e/**',
      ],
    },
  },
});