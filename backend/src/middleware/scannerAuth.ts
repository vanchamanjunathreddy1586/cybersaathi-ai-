import type { RequestHandler } from 'express';
import { SupabaseConfigurationError } from '../config/supabase.js';
import { verifyAccessToken } from '../services/scanner/scanner.repository.js';
import { logger } from '../utils/logger.js';

export interface ScannerAuthContext {
  accessToken: string;
  userId: string;
}

export const scannerAuth: RequestHandler = async (request, response, next) => {
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
