import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { z } from 'zod';
import { callScannerService } from '../services/call-scanner/call-scanner.service.js';
import {
  callScannerAnalyzeLimiter,
  callScannerReadLimiter,
} from '../services/rate-limiting/rate-limiter.service.js';
import { callAnalysisQueue } from '../services/resilience/resilience.service.js';
import {
  QueueCapacityError,
  QueueTimeoutError,
} from '../services/resilience/concurrency-queue.js';
import { getScannerAuth, scannerAuth } from '../middleware/scannerAuth.js';
import { logger } from '../utils/logger.js';

export const callScannerRouter = Router();

// Ensure temporary audio upload directory exists
const tempAudioDir = path.join(os.tmpdir(), 'cybersaathi-call-uploads');
void fs.mkdir(tempAudioDir, { recursive: true }).catch((err) => {
  logger.warn('Failed to ensure temp audio upload directory', { error: err.message });
});

// Configure bounded multer for call audio
const audioUpload = multer({
  dest: tempAudioDir,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.wav', '.mp3', '.m4a', '.ogg', '.webm', '.aac'];
    if (!allowed.includes(ext)) {
      cb(new Error(`INVALID_FILE_TYPE: Unsupported audio format "${ext}". Supported: WAV, MP3, M4A, OGG, WEBM, AAC.`));
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

const transcriptSchema = z.object({
  transcript: z.string().trim().min(5, 'Transcript must contain at least 5 characters.').max(100_000, 'Transcript is too long.'),
  languageHint: z.enum(['en', 'hi', 'te', 'mixed']).optional(),
});

/**
 * POST /api/call-scanner/analyze-transcript
 * Analyzes call text transcripts across English, Hindi, and Telugu fraud patterns.
 */
callScannerRouter.post(
  '/analyze-transcript',
  callScannerAnalyzeLimiter,
  optionalAuth,
  async (req: Request, res: Response) => {
    const parsed = transcriptSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || 'Invalid transcript payload.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const auth = getScannerAuth(res.locals.scannerAuth);

    try {
      const report = await callAnalysisQueue.run(async () => {
        return callScannerService.analyzeTranscript(parsed.data.transcript, {
          languageHint: parsed.data.languageHint,
        });
      });

      if (auth) {
        try {
          const scanId = await callScannerService.saveCallScan(auth.accessToken, auth.userId, report);
          report.scanId = scanId;
        } catch (dbErr) {
          logger.warn('Failed to save call scan result to database', {
            errorType: dbErr instanceof Error ? dbErr.name : 'UnknownError',
          });
        }
      }

      res.status(200).json({
        success: true,
        data: report,
      });
    } catch (err) {
      if (err instanceof QueueCapacityError) {
        res.status(503).json({
          success: false,
          message: 'Call scanner is currently handling high volume. Please retry in a few moments.',
          code: 'QUEUE_CAPACITY_EXCEEDED',
        });
        return;
      }
      if (err instanceof QueueTimeoutError) {
        res.status(504).json({
          success: false,
          message: 'Analysis timed out under heavy load. Please retry.',
          code: 'ANALYSIS_TIMEOUT',
        });
        return;
      }

      logger.warn('Call transcript analysis failed', {
        errorType: err instanceof Error ? err.name : 'UnknownError',
      });
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred while analyzing the call transcript.',
        code: 'ANALYSIS_FAILED',
      });
    }
  },
);

/**
 * POST /api/call-scanner/analyze-audio
 * Accepts audio recording upload and executes speech & fraud pattern audit.
 */
callScannerRouter.post(
  '/analyze-audio',
  callScannerAnalyzeLimiter,
  optionalAuth,
  (req: Request, res: Response, next: NextFunction) => {
    audioUpload.single('audio')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            success: false,
            message: 'Uploaded audio file exceeds the 15 MB size limit.',
            code: 'FILE_TOO_LARGE',
          });
          return;
        }
        res.status(400).json({
          success: false,
          message: err.message || 'Audio upload failed.',
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
        message: 'No audio file uploaded. Please attach an audio file using multipart/form-data field "audio".',
        code: 'MISSING_FILE',
      });
      return;
    }

    const auth = getScannerAuth(res.locals.scannerAuth);
    const languageHint = typeof req.body?.languageHint === 'string' ? req.body.languageHint : undefined;
    const context = typeof req.body?.context === 'string' ? req.body.context : undefined;

    try {
      const report = await callAnalysisQueue.run(async () => {
        return callScannerService.analyzeAudio(file.path, file.originalname, file.size, {
          languageHint,
          context,
        });
      });

      if (auth) {
        try {
          const scanId = await callScannerService.saveCallScan(auth.accessToken, auth.userId, report);
          report.scanId = scanId;
        } catch (dbErr) {
          logger.warn('Failed to save audio scan result to DB', {
            errorType: dbErr instanceof Error ? dbErr.name : 'UnknownError',
          });
        }
      }

      res.status(200).json({
        success: true,
        data: report,
      });
    } catch (analysisErr) {
      if (analysisErr instanceof QueueCapacityError) {
        res.status(503).json({
          success: false,
          message: 'Audio analysis is experiencing heavy traffic. Please retry in a few moments.',
          code: 'QUEUE_CAPACITY_EXCEEDED',
        });
        return;
      }
      if (analysisErr instanceof QueueTimeoutError) {
        res.status(504).json({
          success: false,
          message: 'Audio analysis timed out under load. Please retry.',
          code: 'ANALYSIS_TIMEOUT',
        });
        return;
      }

      logger.warn('Audio call analysis failed', {
        errorType: analysisErr instanceof Error ? analysisErr.name : 'UnknownError',
      });
      res.status(400).json({
        success: false,
        message: analysisErr instanceof Error ? analysisErr.message : 'Audio analysis failed.',
        code: 'AUDIO_ANALYSIS_FAILED',
      });
    } finally {
      // Guaranteed cleanup of uploaded temporary file
      await fs.unlink(file.path).catch((cleanupErr) => {
        logger.warn('Failed to clean up temp audio upload', { error: cleanupErr.message });
      });
    }
  },
);

/**
 * GET /api/call-scanner/history
 * Lists historical call scans for an authenticated user.
 */
callScannerRouter.get(
  '/history',
  scannerAuth,
  callScannerReadLimiter,
  async (_req: Request, res: Response) => {
    const auth = getScannerAuth(res.locals.scannerAuth);
    if (!auth) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    try {
      const scans = await callScannerService.listUserCallScans(auth.accessToken);
      res.status(200).json({
        success: true,
        data: scans,
      });
    } catch (err) {
      logger.warn('Failed to list user call scans', {
        errorType: err instanceof Error ? err.name : 'UnknownError',
      });
      res.status(500).json({
        success: false,
        message: 'Unable to retrieve call scan history.',
      });
    }
  },
);

/**
 * GET /api/call-scanner/scans/:id
 * Retrieves full details of a specific past call scan.
 */
callScannerRouter.get(
  '/scans/:id',
  scannerAuth,
  callScannerReadLimiter,
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
      const scan = await callScannerService.getCallScanById(auth.accessToken, parsedId.data);
      if (!scan) {
        res.status(404).json({ success: false, message: 'Call scan record not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        data: scan,
      });
    } catch (err) {
      logger.warn('Failed to retrieve call scan detail', {
        errorType: err instanceof Error ? err.name : 'UnknownError',
      });
      res.status(500).json({
        success: false,
        message: 'Unable to retrieve call scan record.',
      });
    }
  },
);
