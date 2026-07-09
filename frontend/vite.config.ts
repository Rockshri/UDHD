import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = env.BACKEND_PORT ?? '4000';
  const backendTarget = env.BACKEND_URL ?? `http://localhost:${backendPort}`;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: true,
      css: false,
      env: {
        // Absolute URL — Node's fetch (used by vitest+jsdom) rejects relative URLs.
        VITE_API_BASE_URL: 'http://localhost:5173/api',
      },
    },
  };
});
