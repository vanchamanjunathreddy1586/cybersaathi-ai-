import cors from 'cors';
import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import helmet from 'helmet';

import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { academyRouter } from './routes/academy.routes.js';
import { appScannerRouter } from './routes/app-scanner.routes.js';
import { callScannerRouter } from './routes/call-scanner.routes.js';
import { assistantRouter } from './routes/assistant.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { investigationsRouter } from './routes/investigations.routes.js';
import { nexconnRouter } from './routes/nexconn.routes.js';
import { recoveryRouter } from './routes/recovery.routes.js';
import { familySafetyRouter } from './routes/family-safety.routes.js';
import { scannerRouter } from './routes/scanner.routes.js';
import { securityCenterRouter } from './routes/security-center.routes.js';
import { metrics } from './services/resilience/metrics.service.js';
import {
  resolveRateLimitKey,
  createRateLimitHandler,
} from './services/rate-limiting/rate-limiter.service.js';


export interface AppOptions {
  generalLimit?: number;
  generalWindowMs?: number;
  healthLimit?: number;
  healthWindowMs?: number;
}

export function createApp(options?: AppOptions): express.Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        callback(
          null,
          origin === undefined || env.allowedOrigins.includes(origin),
        );
      },
    }),
  );
  app.use(express.json({ limit: '12kb' }));

  // Global request metrics & latency tracking
  app.use((request, response, next) => {
    const start = Date.now();
    response.on('finish', () => {
      const latency = Date.now() - start;
      const category = request.baseUrl || request.path.split('/')[2] || 'root';
      metrics.recordRequest(category, response.statusCode, latency);
    });
    next();
  });

  // Dedicated health limiter for automated probes, diagnostics, and multi-tab monitoring
  const healthLimiter = rateLimit({
    windowMs: options?.healthWindowMs ?? 60 * 1000,
    limit: options?.healthLimit ?? 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    passOnStoreError: true,
    validate: { keyGeneratorIpFallback: false },
    keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip || req.socket.remoteAddress || '127.0.0.1')}`,
    handler: createRateLimitHandler(
      'Health check request limit exceeded. Try again in a minute.',
      'HEALTH_LIMIT_EXCEEDED',
    ),
  });

  // General rate limiter for all other API endpoints (100 requests per 15 minutes)
  // Keyed per-user (User ID > Auth Token hash > IP address)
  const generalApiLimiter = rateLimit({
    windowMs: options?.generalWindowMs ?? 15 * 60 * 1000,
    limit: options?.generalLimit ?? 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    passOnStoreError: true,
    validate: { keyGeneratorIpFallback: false },
    keyGenerator: (request, response) => resolveRateLimitKey(request, response),
    handler: createRateLimitHandler(
      'Too many requests. Please try again later.',
      'RATE_LIMIT_EXCEEDED',
    ),

    skip: (request) =>
      request.path.startsWith('/api/health') ||
      request.baseUrl === '/api/health' ||
      request.originalUrl.startsWith('/api/health'),
  });

  // 1. Health endpoints are registered before the general API limiter
  // and are protected by their own dedicated healthLimiter.
  app.use('/api/health', healthLimiter, healthRouter);

  // 2. General rate limiter applies to all other /api endpoints.
  app.use('/api', generalApiLimiter);

  // 3. Sensitive & feature endpoints (each retaining their route-specific strict limiters).
  app.use('/api/academy', academyRouter);
  app.use('/api/assistant', assistantRouter);
  app.use('/api/security-center', securityCenterRouter);
  app.use('/api/scanner', scannerRouter);
  app.use('/api/app-scanner', appScannerRouter);
  app.use('/api/call-scanner', callScannerRouter);
  app.use('/api/investigations', investigationsRouter);
  app.use('/api/recovery', recoveryRouter);
  app.use('/api/family-safety', familySafetyRouter);
  app.use('/api/nexconn', nexconnRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
