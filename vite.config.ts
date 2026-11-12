import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repo = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  build: { outDir: '../../dist', emptyOutDir: true },
  server: {
    // Serve only client code and dependencies, never history databases, eval captures or other workspace files.
    fs: {
      strict: true,
      allow: [repo('src/client'), repo('src/shared'), repo('node_modules')],
      // A custom list replaces Vite's defaults, so they are repeated first.
      deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**',
        '**/data/**', '**/evals/results/**', '*.{db,sqlite,sqlite3}', '*.{db,sqlite,sqlite3}-{wal,shm,journal}'],
    },
    // The app is same-origin; other localhost origins get no CORS read access.
    cors: false,
  },
});
