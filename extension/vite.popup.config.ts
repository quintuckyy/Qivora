import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: r('src/popup/popup.ts'),
      output: {
        entryFileNames: 'popup.js',
        format: 'iife',
      },
    },
  },
});
