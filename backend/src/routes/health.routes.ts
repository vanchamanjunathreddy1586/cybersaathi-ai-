import { Router } from 'express';
import {
  SupabaseConfigurationError,
  type SupabaseDiagnosticCategory,
  verifySupabaseConnectivity,
} from '../config/supabase.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../services/resilience/metrics.service.js';

export const healthRouter = Router();

healthRouter.get('/', (_request, response) => {
  response.status(200).json({
    success: true,
    message: 'CyberSaathi AI backend is running',
    status: 'healthy',
  });
});

healthRouter.get('/metrics', (_request, response) => {
  response.status(200).json({
    success: true,
    metrics: metrics.getMetricsSnapshot(),
  });
});


healthRouter.get('/supabase', async (_request, response) => {
  try {
    const result = await verifySupabaseConnectivity();

    if (!result.connected) {
      logger.warn('Supabase database health query did not succeed', {
        category: result.category,
        errorCode: result.errorCode,
        ...(result.httpStatus === undefined
          ? {}
          : { httpStatus: result.httpStatus }),
      });
    }

    response.status(result.connected ? 200 : 503).json({
      success: result.connected,
      service: 'supabase',
      status: result.connected ? 'connected' : 'disconnected',
      ...(!result.connected && env.nodeEnv !== 'production'
        ? {
            diagnostic: {
              category: result.category,
              errorCode: result.errorCode,
              ...(result.httpStatus === undefined
                ? {}
                : { httpStatus: result.httpStatus }),
            },
          }
        : {}),
    });
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      logger.warn('Supabase database check configuration is incomplete', {
        category: error.category,
        missingVariables: error.missingVariables.join(', '),
      });
      response.status(503).json({
        success: false,
        service: 'supabase',
        status: 'disconnected',
        ...(env.nodeEnv !== 'production'
          ? { diagnostic: { category: error.category } }
          : {}),
      });
      return;
    }

    const errorType = error instanceof Error ? error.name : 'UnknownError';
    const category: SupabaseDiagnosticCategory =
      errorType === 'AbortError' || errorType === 'TimeoutError'
        ? 'timeout'
        : errorType === 'TypeError'
          ? 'network_error'
          : 'unknown';
    logger.warn('Supabase database health query failed before a response', {
      category,
      errorType,
    });
    response.status(503).json({
      success: false,
      service: 'supabase',
      status: 'disconnected',
      ...(env.nodeEnv !== 'production'
        ? { diagnostic: { category, errorCode: 'NO_HTTP_RESPONSE' } }
        : {}),
    });
  }
});
