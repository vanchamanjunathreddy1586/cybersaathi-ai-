import type { ErrorRequestHandler } from 'express';
import { logger } from '../utils/logger.js';
import { CircuitBreakerError } from '../services/resilience/circuit-breaker.js';
import { QueueCapacityError, QueueTimeoutError } from '../services/resilience/concurrency-queue.js';
import { ProviderQuotaError } from '../services/resilience/external-quota.js';

function getClientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return undefined;
  }

  const { status } = error;
  return typeof status === 'number' && status >= 400 && status < 500
    ? status
    : undefined;
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  // Handle resilience & quota errors gracefully with Retry-After headers
  if (error instanceof QueueCapacityError) {
    logger.warn('Queue capacity exceeded', { queue: error.queueName, retryAfter: error.retryAfterSeconds });
    response.setHeader('Retry-After', String(error.retryAfterSeconds));
    response.status(429).json({
      success: false,
      message: error.message,
      code: 'QUEUE_CAPACITY_EXCEEDED',
      retryAfter: error.retryAfterSeconds,
    });
    return;
  }

  if (error instanceof ProviderQuotaError) {
    logger.warn('External provider quota exceeded', { provider: error.providerName, retryAfter: error.retryAfterSeconds });
    response.setHeader('Retry-After', String(error.retryAfterSeconds));
    response.status(429).json({
      success: false,
      message: error.message,
      code: 'PROVIDER_QUOTA_EXCEEDED',
      retryAfter: error.retryAfterSeconds,
    });
    return;
  }

  if (error instanceof CircuitBreakerError) {
    logger.warn('Circuit breaker open', { provider: error.providerName, retryAfter: error.retryAfterSeconds });
    response.setHeader('Retry-After', String(error.retryAfterSeconds));
    response.status(503).json({
      success: false,
      message: error.message,
      code: 'PROVIDER_UNAVAILABLE',
      retryAfter: error.retryAfterSeconds,
    });
    return;
  }

  if (error instanceof QueueTimeoutError) {
    logger.warn('Queue wait timed out', { queue: error.queueName, retryAfter: error.retryAfterSeconds });
    response.setHeader('Retry-After', String(error.retryAfterSeconds));
    response.status(504).json({
      success: false,
      message: error.message,
      code: 'QUEUE_TIMEOUT',
      retryAfter: error.retryAfterSeconds,
    });
    return;
  }

  const status = getClientErrorStatus(error);
  const isProduction = process.env.NODE_ENV === 'production';

  logger.error('Request failed', {
    errorType: error instanceof Error ? error.name : 'UnknownError',
    status: status ?? 500,
  });

  response.status(status ?? 500).json({
    success: false,
    message: status === 400
      ? 'Invalid request'
      : isProduction
        ? 'Internal server error'
        : error instanceof Error
          ? error.message
          : 'Internal server error',
  });
};

