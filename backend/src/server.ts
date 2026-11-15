import { createServer } from 'node:http';
import { env } from './config/env.js';
import { app } from './app.js';
import { logger } from './utils/logger.js';

const server = createServer(app);

server.on('error', (error: NodeJS.ErrnoException) => {
  logger.error('Backend server error', {
    errorType: error.name,
    ...(error.code ? { code: error.code } : {}),
  });
  process.exitCode = 1;
});

server.listen(env.port, () => {
  logger.info('CyberSaathi AI backend started', {
    port: env.port,
    environment: env.nodeEnv,
  });
});

let isShuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info('Shutdown signal received', { signal });

  const forceCloseTimer = setTimeout(() => {
    logger.warn('Shutdown timed out; closing active connections');
    server.closeAllConnections();
  }, 10_000);

  server.close((error) => {
    clearTimeout(forceCloseTimer);

    if (error) {
      logger.error('Backend shutdown failed', { errorType: error.name });
      process.exitCode = 1;
      return;
    }

    logger.info('Backend server stopped');
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
