import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  appType: 'spa',
  base: '/',
  plugins: [react()],
  build: {
    assetsDir: 'assets',
    cssCodeSplit: true,
    emptyOutDir: true,
    manifest: false,
    minify: 'esbuild',
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
});