import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: r('src/content/content-script.ts'),
      output: {
        entryFileNames: 'content.js',
        format: 'iife',
      },
    },
  },
});
