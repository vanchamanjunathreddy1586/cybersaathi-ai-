import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { SupabaseConfigurationError } from '../config/supabase.js';
import { verifyAccessToken } from '../services/scanner/scanner.repository.js';
import { logger } from '../utils/logger.js';

export interface ScannerAuthContext {
  accessToken: string;
  userId: string;
}

export const isTestEnvironment = (): boolean => {
  if (process.env.NODE_ENV === 'production' || env.nodeEnv === 'production') {
    return false;
  }
  return (
    process.env.NODE_ENV === 'test' ||
    env.nodeEnv === 'test' ||
    process.argv.some((arg) => arg.includes('test'))
  );
};

export const scannerAuth: RequestHandler = async (request, response, next) => {
  // Allow test fixtures to supply mock auth context ONLY strictly in test environments
  if (
    isTestEnvironment() &&
    response.locals.scannerAuth &&
    typeof response.locals.scannerAuth === 'object' &&
    'userId' in response.locals.scannerAuth &&
    'accessToken' in response.locals.scannerAuth
  ) {
    next();
    return;
  }

  // In non-test environments (production, staging, development), explicitly wipe any pre-existing locals to prevent spoofing
  response.locals.scannerAuth = undefined;

  const authorization = request.header('authorization') ?? '';
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
  const accessToken = match?.[1];
  if (!accessToken || accessToken.length > 8_192) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  try {
    const userId = await verifyAccessToken(accessToken);
    if (!userId) {
      response.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }
    response.locals.scannerAuth = { accessToken, userId } satisfies ScannerAuthContext;
    next();
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      logger.warn('Scanner authentication unavailable', {
        category: error.category,
      });
      response.status(503).json({
        success: false,
        message: 'Authentication service is not configured.',
      });
      return;
    }
    logger.warn('Scanner authentication could not be verified', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    response.status(503).json({
      success: false,
      message: 'Authentication service is temporarily unavailable.',
    });
  }
};

export function getScannerAuth(
  value: unknown,
): ScannerAuthContext | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('accessToken' in value) ||
    !('userId' in value) ||
    typeof value.accessToken !== 'string' ||
    typeof value.userId !== 'string'
  ) {
    return null;
  }
  return { accessToken: value.accessToken, userId: value.userId };
}
