import { Router } from 'express';
import { getScannerAuth, scannerAuth } from '../middleware/scannerAuth.js';
import {
  getNexconnConfiguration,
  issueNexconnSession,
} from '../services/nexconn/nexconn.service.js';
import { logger } from '../utils/logger.js';
import { nexconnSessionLimiter } from '../services/rate-limiting/rate-limiter.service.js';

export const nexconnRouter = Router();


nexconnRouter.use(scannerAuth);

nexconnRouter.get('/configuration', (_request, response) => {
  response.status(200).json({ success: true, ...getNexconnConfiguration() });
});

nexconnRouter.post('/session', nexconnSessionLimiter, async (_request, response) => {
  const auth = getScannerAuth(response.locals.scannerAuth);

  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  if (!getNexconnConfiguration().configured) {
    response.status(503).json({
      success: false,
      message: 'Nexconn is not configured. Add the App Key, App Secret, and data center region to the backend environment.',
    });
    return;
  }

  try {
    const session = await issueNexconnSession(auth.userId);
    response.setHeader('Cache-Control', 'no-store');
    response.status(200).json({ success: true, session });
  } catch (error) {
    logger.warn('Nexconn session issuance failed', {
      errorType: error instanceof Error ? error.message : 'UnknownError',
    });
    response.status(503).json({
      success: false,
      message: 'Nexconn could not issue a session. Check the App Key, secret, data center, and service status.',
    });
  }
});
