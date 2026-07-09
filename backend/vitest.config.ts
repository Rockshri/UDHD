import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://test@localhost:5432/test',
      JWT_ACCESS_SECRET: 'a'.repeat(48),
      JWT_REFRESH_SECRET: 'b'.repeat(48),
      ACCESS_TOKEN_TTL_SECONDS: '900',
      REFRESH_TOKEN_TTL_SECONDS: '2592000',
      CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
    },
  },
});
