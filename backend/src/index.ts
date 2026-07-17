import { createApp } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';

async function main() {
  await connectDB();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', error);
  process.exit(1);
});
