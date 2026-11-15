import { createHash } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator, type Options, type RateLimitRequestHandler } from 'express-rate-limit';
import Redis from 'ioredis';
import { RedisStore } from 'rate-limit-redis';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { metrics } from '../resilience/metrics.service.js';

/**
 * Resolves a unique rate-limit key for a request:
 * 1. Authenticated user ID (from response.locals.scannerAuth.userId or custom property)
 * 2. Hashed Bearer token (when Authorization header is present)
 * 3. Client IP address (with reverse-proxy & IPv6 subnet support)
 */
export function resolveRateLimitKey(request: Request, response?: Response): string {
  // 1. Authenticated user ID in response.locals
  const localsAuth = response?.locals?.scannerAuth as { userId?: string } | undefined;
  if (localsAuth?.userId && typeof localsAuth.userId === 'string') {
    return `user:${localsAuth.userId}`;
  }

  // 2. Authorization Bearer token hash
  const authorization = request.header('authorization') ?? '';
  const tokenMatch = /^Bearer\s+([^\s]+)$/i.exec(authorization);
  if (tokenMatch?.[1]) {
    const tokenHash = createHash('sha256').update(tokenMatch[1]).digest('hex').slice(0, 16);
    return `token:${tokenHash}`;
  }

  // 3. Fallback to client IP with IPv6 canonicalization
  const rawIp = request.ip || request.socket.remoteAddress || '127.0.0.1';
  const ip = ipKeyGenerator(rawIp);
  return `ip:${ip}`;
}


/**
 * Shared Redis client & store factory.
 * If REDIS_URL is configured, initializes RedisStore for distributed rate limiting.
 * Otherwise, returns undefined so express-rate-limit falls back to MemoryStore gracefully.
 */
let redisClient: Redis | null = null;
let redisStore: RedisStore | undefined = undefined;

if (env.redisUrl) {
  try {
    redisClient = new Redis(env.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });

    redisClient.on('error', (err) => {
      logger.warn('Distributed rate limiter Redis connection error; fallback to memory store', {
        error: err instanceof Error ? err.message : 'UnknownError',
      });
    });

    redisStore = new RedisStore({
      sendCommand: (...args: string[]) => {
        if (!redisClient) throw new Error('Redis client unavailable');
        const [command, ...params] = args;
        return (redisClient as any).call(command, ...params);
      },
      prefix: 'rl:cs:',
    });

    logger.info('Initialized distributed Redis store for rate limiting');
  } catch (error) {
    logger.warn('Failed to initialize Redis store for rate limiting; falling back to in-memory store', {
      error: error instanceof Error ? error.message : 'UnknownError',
    });
    redisStore = undefined;
  }
}

/**
 * Creates a standard JSON 429 response handler conforming to API contracts
 * and returning standard Retry-After headers.
 */
export function createRateLimitHandler(
  message: string,
  code = 'RATE_LIMIT_EXCEEDED',
) {
  return (request: Request, response: Response, _next: NextFunction, options: Options) => {
    const routeCategory = request.baseUrl ? `${request.baseUrl}${request.path}` : request.path;
    metrics.recordRateLimitEvent(routeCategory);

    const retryAfterSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
    response.setHeader('Retry-After', String(retryAfterSeconds));

    logger.warn('Rate limit exceeded', {
      route: routeCategory,
      key: resolveRateLimitKey(request, response),
      code,
      retryAfterSeconds,
    });

    response.status(429).json({
      success: false,
      message,
      code,
      retryAfter: retryAfterSeconds,
    });
  };
}

export interface CustomLimiterOptions {
  windowMs: number;
  limit: number;
  message: string;
  code?: string;
  keyGenerator?: (request: Request, response: Response) => string;
  skip?: (request: Request, response: Response) => boolean;
}

export function createEndpointLimiter(options: CustomLimiterOptions): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    passOnStoreError: true,
    validate: { keyGeneratorIpFallback: false },
    ...(redisStore ? { store: redisStore } : {}),
    keyGenerator: options.keyGenerator ?? ((req, res) => resolveRateLimitKey(req, res)),
    handler: createRateLimitHandler(options.message, options.code),
    ...(options.skip ? { skip: options.skip } : {}),
  });
}


// -------------------------------------------------------------
// Endpoint-specific Pre-configured Rate Limiters
// -------------------------------------------------------------

/**
 * Health limiter: IP-keyed, lightweight, separate from user quotas.
 */
export const healthLimiter = createEndpointLimiter({
  windowMs: 60_000,
  limit: 120,
  message: 'Health check request limit exceeded. Try again in a minute.',
  code: 'HEALTH_LIMIT_EXCEEDED',
  keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip || req.socket.remoteAddress || '127.0.0.1')}`,
});


/**
 * Authentication limiter: Strict brute-force protection.
 */
export const authLimiter = createEndpointLimiter({
  windowMs: 60_000,
  limit: 10,
  message: 'Too many authentication attempts. Please try again in a minute.',
  code: 'AUTH_RATE_LIMIT_EXCEEDED',
});

/**
 * Scanner analyze limiter: Per-user quota for scans.
 */
export const scannerAnalyzeLimiter = createEndpointLimiter({
  windowMs: 60_000,
  limit: 15,
  message: 'Scan limit reached. Try again in a minute.',
  code: 'SCANNER_RATE_LIMIT_EXCEEDED',
});

/**
 * Scanner read limiter: Generous read limit for fetching history and findings.
 */
export const scannerReadLimiter = createEndpointLimiter({
  windowMs: 15 * 60_000,
  limit: 180,
  message: 'Scan history request limit reached. Try again later.',
  code: 'SCANNER_READ_LIMIT_EXCEEDED',
});

/**
 * AI Assistant message limiter: Per-user quota for chat messages.
 */
export const assistantMessageLimiter = createEndpointLimiter({
  windowMs: 60_000,
  limit: 10,
  message: 'Assistant request limit reached. Try again in a minute.',
  code: 'ASSISTANT_RATE_LIMIT_EXCEEDED',
});

/**
 * AI Assistant read limiter: Generous read limit for conversations and context.
 */
export const assistantReadLimiter = createEndpointLimiter({
  windowMs: 15 * 60_000,
  limit: 180,
  message: 'Assistant history request limit reached. Try again later.',
  code: 'ASSISTANT_READ_LIMIT_EXCEEDED',
});

/**
 * Academy AI Tutor limiter: Per-user quota for tutor queries.
 */
export const academyTutorLimiter = createEndpointLimiter({
  windowMs: 60_000,
  limit: 10,
  message: 'Tutor request limit reached. Try again in a minute.',
  code: 'TUTOR_RATE_LIMIT_EXCEEDED',
});

/**
 * Academy read limiter: Generous read limit for browsing courses, lessons, quizzes.
 */
export const academyReadLimiter = createEndpointLimiter({
  windowMs: 15 * 60_000,
  limit: 240,
  message: 'Academy course request limit reached. Try again later.',
  code: 'ACADEMY_READ_LIMIT_EXCEEDED',
});

/**
 * Investigation write limiter: Per-user quota for creating/updating investigations & evidence.
 */
export const investigationWriteLimiter = createEndpointLimiter({
  windowMs: 60_000,
  limit: 15,
  message: 'Investigation updates limit reached. Try again in a minute.',
  code: 'INVESTIGATION_WRITE_LIMIT_EXCEEDED',
});

/**
 * Investigation read limiter: Generous read limit for viewing cases and notes.
 */
export const investigationReadLimiter = createEndpointLimiter({
  windowMs: 15 * 60_000,
  limit: 180,
  message: 'Investigation request limit reached. Try again later.',
  code: 'INVESTIGATION_READ_LIMIT_EXCEEDED',
});

/**
 * Security center threat check limiter: Respects external VirusTotal free tier (4-5 RPM).
 */
export const securityCenterThreatLimiter = createEndpointLimiter({
  windowMs: 60_000,
  limit: 5,
  message: 'Threat checks are limited to 5 requests per minute.',
  code: 'THREAT_CHECK_LIMIT_EXCEEDED',
});

/**
 * Security center push notification limiter.
 */
export const securityCenterPushLimiter = createEndpointLimiter({
  windowMs: 60_000,
  limit: 10,
  message: 'Notification preference updates limit reached. Try again in a minute.',
  code: 'PUSH_LIMIT_EXCEEDED',
});

/**
 * Nexconn session issuance limiter.
 */
export const nexconnSessionLimiter = createEndpointLimiter({
  windowMs: 60_000,
  limit: 10,
  message: 'Nexconn session limit reached. Try again in a minute.',
  code: 'NEXCONN_LIMIT_EXCEEDED',
});

/**
 * Fraud recovery read limiter: Generous read limit for viewing vectors, emergency contacts, and checklists.
 */
export const recoveryReadLimiter = createEndpointLimiter({
  windowMs: 15 * 60_000,
  limit: 300,
  message: 'Recovery guides request limit reached. Try again later.',
  code: 'RECOVERY_READ_LIMIT_EXCEEDED',
});

/**
 * Fraud recovery complaint drafting limiter: Per-user quota for generating customized FIR/complaint letters.
 */
export const recoveryDraftLimiter = createEndpointLimiter({
  windowMs: 60_000,
  limit: 20,
  message: 'Complaint drafting request limit reached. Try again in a minute.',
  code: 'RECOVERY_DRAFT_LIMIT_EXCEEDED',
});

/**
 * Mobile APK upload limiter: Protects CPU/memory during binary decompression.
 */
export const appScannerUploadLimiter = createEndpointLimiter({
  windowMs: 60_000,
  limit: 5,
  message: 'APK upload limit reached. You can upload up to 5 APKs per minute.',
  code: 'APK_UPLOAD_LIMIT_EXCEEDED',
});

/**
 * Mobile APK read limiter: Generous limit for viewing past scans.
 */
export const appScannerReadLimiter = createEndpointLimiter({
  windowMs: 15 * 60_000,
  limit: 180,
  message: 'App scan request limit reached. Try again later.',
  code: 'APP_SCAN_READ_LIMIT_EXCEEDED',
});

/**
 * Call scanner analysis limiter: Per-user quota for transcript and audio scam detection.
 */
export const callScannerAnalyzeLimiter = createEndpointLimiter({
  windowMs: 60_000,
  limit: 12,
  message: 'Call scan analysis limit reached. You can analyze up to 12 transcripts/recordings per minute.',
  code: 'CALL_SCAN_LIMIT_EXCEEDED',
});

/**
 * Call scanner read limiter: Limit for retrieving past call scan records.
 */
export const callScannerReadLimiter = createEndpointLimiter({
  windowMs: 15 * 60_000,
  limit: 180,
  message: 'Call scan history request limit reached. Try again later.',
  code: 'CALL_SCAN_READ_LIMIT_EXCEEDED',
});
