import { createApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { env } from './env.js';

async function main(): Promise<void> {
  // Apply any pending SQL migrations before serving traffic. If a migration
  // fails, exit non-zero so the platform restarts (and keeps failing
  // loudly) rather than serving 500s against a stale schema.
  try {
    await runMigrations();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Migration on startup failed: ${message}\n`);
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    const banner = `BUIDCO API listening on http://localhost:${env.PORT} [${env.NODE_ENV}]`;
    process.stdout.write(`${banner}\n`);
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    process.stdout.write(`Received ${signal}, shutting down\n`);
    server.close((err) => {
      if (err) {
        process.stderr.write(`Error during shutdown: ${err.message}\n`);
        process.exit(1);
      }
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
