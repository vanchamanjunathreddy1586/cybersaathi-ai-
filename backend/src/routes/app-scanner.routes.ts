import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { z } from 'zod';
import { appScannerService } from '../services/app-scanner/app-scanner.service.js';
import {
  MAX_APK_FILE_SIZE_BYTES,
  ArchiveSecurityError,
} from '../services/app-scanner/safe-archive.validator.js';
import {
  appScannerUploadLimiter,
  appScannerReadLimiter,
} from '../services/rate-limiting/rate-limiter.service.js';
import { apkAnalysisQueue } from '../services/resilience/resilience.service.js';
import {
  QueueCapacityError,
  QueueTimeoutError,
} from '../services/resilience/concurrency-queue.js';
import { getScannerAuth, scannerAuth } from '../middleware/scannerAuth.js';
import { logger } from '../utils/logger.js';

export const appScannerRouter = Router();

// Ensure temporary upload directory exists
const tempUploadDir = path.join(os.tmpdir(), 'cybersaathi-apk-uploads');
void fs.mkdir(tempUploadDir, { recursive: true }).catch((err) => {
  logger.warn('Failed to ensure temp upload directory', { error: err.message });
});

// Configure bounded multer instance
const upload = multer({
  dest: tempUploadDir,
  limits: {
    fileSize: MAX_APK_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    // Only accept .apk file extensions
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.apk') {
      cb(new Error('INVALID_FILE_TYPE: Only Android application packages (.apk) are supported.'));
      return;
    }
    cb(null, true);
  },
});

/**
 * Optional authentication helper: If Bearer token is provided, extract it safely
 * without failing unauthenticated public users who want to run a quick scan.
 */
async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return scannerAuth(req, res, next);
  }
  next();
}

/**
 * POST /api/app-scanner/analyze
 * Uploads an APK file for static security, permission, component, and threat intelligence analysis.
 */
appScannerRouter.post(
  '/analyze',
  appScannerUploadLimiter,
  optionalAuth,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('apk')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            success: false,
            message: 'Uploaded APK file exceeds the 35 MB size limit.',
            code: 'FILE_TOO_LARGE',
          });
          return;
        }
        res.status(400).json({
          success: false,
          message: err.message || 'File upload failed.',
          code: 'UPLOAD_ERROR',
        });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({
        success: false,
        message: 'No APK file uploaded. Please attach an .apk file using multipart/form-data field "apk".',
        code: 'MISSING_FILE',
      });
      return;
    }

    const checkThreatIntel = req.body?.consentThreatIntel === 'true' || req.body?.consentThreatIntel === true;
    const auth = getScannerAuth(res.locals.scannerAuth);

    try {
      // Execute static analysis through bounded concurrency queue
      const report = await apkAnalysisQueue.run(async () => {
        return appScannerService.analyzeApk(file.path, file.originalname, {
          checkThreatIntel,
        });
      });

      // If user is authenticated, persist scan result to database history
      let scanId: string | undefined;
      if (auth) {
        try {
          scanId = await appScannerService.saveScanResult(auth.accessToken, auth.userId, report);
          report.scanId = scanId;
        } catch (dbErr) {
          logger.warn('Failed to save authenticated APK scan result to DB', {
            errorType: dbErr instanceof Error ? dbErr.name : 'UnknownError',
          });
        }
      }

      res.status(200).json({
        success: true,
        data: report,
      });
    } catch (analysisErr) {
      if (analysisErr instanceof ArchiveSecurityError) {
        res.status(400).json({
          success: false,
          message: analysisErr.message,
          code: analysisErr.code,
        });
        return;
      }

      if (analysisErr instanceof QueueCapacityError) {
        res.status(503).json({
          success: false,
          message: 'The APK analyzer is currently experiencing high load. Please try again shortly.',
          code: 'ANALYZER_QUEUE_FULL',
        });
        return;
      }

      if (analysisErr instanceof QueueTimeoutError) {
        res.status(504).json({
          success: false,
          message: 'The APK analysis timed out. The archive may be overly complex.',
          code: 'ANALYZER_TIMEOUT',
        });
        return;
      }

      logger.warn('APK security analysis failed', {
        errorType: analysisErr instanceof Error ? analysisErr.message : 'UnknownError',
      });

      res.status(400).json({
        success: false,
        message:
          analysisErr instanceof Error && analysisErr.message.startsWith('CORRUPT_')
            ? analysisErr.message
            : 'Unable to analyze the uploaded APK. Ensure the file is a valid, uncorrupted Android package.',
        code: 'ANALYSIS_FAILED',
      });
    } finally {
      // Guaranteed secure cleanup of uploaded binary
      void fs.unlink(file.path).catch(() => {});
    }
  },
);

/**
 * GET /api/app-scanner/history
 * Retrieves recent scan history for an authenticated user.
 */
appScannerRouter.get(
  '/history',
  scannerAuth,
  appScannerReadLimiter,
  async (_req: Request, res: Response) => {
    const auth = getScannerAuth(res.locals.scannerAuth);
    if (!auth) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    try {
      const scans = await appScannerService.listUserScans(auth.accessToken);
      res.status(200).json({
        success: true,
        data: scans,
      });
    } catch (err) {
      logger.warn('Failed to list user app scans', {
        errorType: err instanceof Error ? err.name : 'UnknownError',
      });
      res.status(500).json({
        success: false,
        message: 'Unable to retrieve app scan history.',
      });
    }
  },
);

/**
 * GET /api/app-scanner/scans/:id
 * Retrieves full details of a specific past scan.
 */
appScannerRouter.get(
  '/scans/:id',
  scannerAuth,
  appScannerReadLimiter,
  async (req: Request, res: Response) => {
    const auth = getScannerAuth(res.locals.scannerAuth);
    if (!auth) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const idSchema = z.string().uuid();
    const parsedId = idSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      res.status(400).json({ success: false, message: 'Invalid scan ID format.' });
      return;
    }

    try {
      const scan = await appScannerService.getScanById(auth.accessToken, parsedId.data);
      if (!scan) {
        res.status(404).json({ success: false, message: 'App scan not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        data: scan,
      });
    } catch (err) {
      logger.warn('Failed to retrieve scan detail', {
        errorType: err instanceof Error ? err.name : 'UnknownError',
      });
      res.status(500).json({
        success: false,
        message: 'Unable to retrieve app scan record.',
      });
    }
  },
);
