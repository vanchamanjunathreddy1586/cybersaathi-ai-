import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { getScannerAuth, scannerAuth } from '../middleware/scannerAuth.js';
import { analyzeScan } from '../services/scanner/scanner.service.js';
import {
  deleteScan,
  getScan,
  listScans,
  saveScan,
} from '../services/scanner/scanner.repository.js';
import {
  historyQuerySchema,
  scanRequestSchema,
} from '../services/scanner/scanner.schema.js';
import { logger } from '../utils/logger.js';
import { sendUserSecurityPush } from '../services/security-center/web-push.service.js';
import {
  scannerAnalyzeLimiter,
  scannerReadLimiter,
} from '../services/rate-limiting/rate-limiter.service.js';
import { scannerQueue } from '../services/resilience/resilience.service.js';
import {
  QueueCapacityError,
  QueueTimeoutError,
} from '../services/resilience/concurrency-queue.js';

export const scannerRouter = Router();

const scanIdSchema = z.string().uuid();

scannerRouter.use(scannerAuth);

scannerRouter.post('/analyze', scannerAnalyzeLimiter, async (request, response, next) => {
  const parsed = scanRequestSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({
      success: false,
      message: 'Provide a valid scan type and content.',
      requestId: randomUUID(),
    });
    return;
  }

  const auth = getScannerAuth(response.locals.scannerAuth);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  let report;
  try {
    report = await scannerQueue.run(async () => analyzeScan(parsed.data));
  } catch (error) {
    if (error instanceof QueueCapacityError || error instanceof QueueTimeoutError) {
      next(error);
      return;
    }
    if (error instanceof Error && error.message.includes('complete URL')) {
      response.status(400).json({ success: false, message: error.message });
      return;
    }
    logger.error('Scan analysis failed', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
      scanType: parsed.data.type,
    });
    response.status(503).json({
      success: false,
      message: 'The scan could not be completed. Please try again.',
    });
    return;
  }

  const persistence = await saveScan(auth.accessToken, auth.userId, report);
  if (!persistence.saved) {
    logger.warn('Scan completed but could not be saved to history', {
      scanId: report.scanId,
      errorCode: persistence.errorCode,
    });
  } else {
    logger.info('Scan completed', {
      scanId: report.scanId,
      scanType: report.scanType,
      riskScore: report.riskScore,
    });
    if (report.riskScore >= 60) {
      void sendUserSecurityPush(auth.accessToken, auth.userId, {
        sourceId: report.scanId,
        category: report.riskScore >= 80 ? 'critical' : 'high_risk',
      }).catch((error: unknown) => {
        logger.warn('Scan push notification could not be sent', {
          errorType: error instanceof Error ? error.name : 'UnknownError',
        });
      });
    }
  }

  response.status(200).json({
    success: true,
    report,
    historySaved: persistence.saved,
    ...(!persistence.saved ? { persistenceErrorCode: persistence.errorCode } : {}),
  });
});

scannerRouter.get('/history', scannerReadLimiter, async (request, response) => {
  const parsed = historyQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    response.status(400).json({ success: false, message: 'Invalid history filters.' });
    return;
  }
  const auth = getScannerAuth(response.locals.scannerAuth);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  try {
    const records = await listScans(auth.accessToken, {
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
    });
    response.status(200).json({ success: true, records });
  } catch (error) {
    logger.warn('Scan history could not be loaded', {
      errorType: error instanceof Error ? error.message : 'UnknownError',
    });
    response.status(503).json({
      success: false,
      message: 'Scan history is unavailable. Check that the database migration has been applied.',
    });
  }
});

scannerRouter.get('/history/:id', async (request, response) => {
  const id = scanIdSchema.safeParse(request.params.id);
  if (!id.success) {
    response.status(400).json({ success: false, message: 'Invalid scan ID.' });
    return;
  }
  const auth = getScannerAuth(response.locals.scannerAuth);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  try {
    const record = await getScan(auth.accessToken, id.data);
    if (!record) {
      response.status(404).json({ success: false, message: 'Scan not found.' });
      return;
    }
    response.status(200).json({ success: true, record });
  } catch (error) {
    logger.warn('Scan detail could not be loaded', {
      errorType: error instanceof Error ? error.message : 'UnknownError',
    });
    response.status(503).json({ success: false, message: 'Scan detail is unavailable.' });
  }
});

scannerRouter.delete('/history/:id', async (request, response) => {
  const id = scanIdSchema.safeParse(request.params.id);
  if (!id.success) {
    response.status(400).json({ success: false, message: 'Invalid scan ID.' });
    return;
  }
  const auth = getScannerAuth(response.locals.scannerAuth);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  try {
    const deleted = await deleteScan(auth.accessToken, id.data);
    if (!deleted) {
      response.status(404).json({ success: false, message: 'Scan not found.' });
      return;
    }
    response.status(200).json({ success: true });
  } catch (error) {
    logger.warn('Scan record could not be deleted', {
      errorType: error instanceof Error ? error.message : 'UnknownError',
    });
    response.status(503).json({ success: false, message: 'Scan could not be deleted.' });
  }
});
