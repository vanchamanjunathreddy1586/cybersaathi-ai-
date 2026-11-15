import { Router, type Response, type Request } from 'express';
import { z } from 'zod';
import { getScannerAuth, scannerAuth } from '../middleware/scannerAuth.js';
import { fraudRecoveryService } from '../services/recovery/fraud-recovery.service.js';
import {
  recoveryReadLimiter,
  recoveryDraftLimiter,
  investigationWriteLimiter,
} from '../services/rate-limiting/rate-limiter.service.js';
import { logger } from '../utils/logger.js';

export const recoveryRouter = Router();

const bridgeInvestigationSchema = z.object({
  vectorId: z.string().trim().min(1).max(50),
  lossAmountInr: z.number().nonnegative().optional(),
  complaintText: z.string().trim().min(20).max(10_000),
  transactionIdUtr: z.string().trim().max(100).optional(),
  evidenceCount: z.number().int().nonnegative().max(100).default(0),
});

/**
   * GET /api/recovery/vectors
   * Returns list of all 9 Indian fraud vectors with summary info.
   */
recoveryRouter.get('/vectors', recoveryReadLimiter, (_request: Request, response: Response) => {
  const vectors = fraudRecoveryService.listVectors();
  response.json({
    success: true,
    data: vectors,
  });
});

/**
   * GET /api/recovery/vectors/:id
   * Returns comprehensive guidance, checklists, and legal sections for a specific vector.
   */
recoveryRouter.get('/vectors/:id', recoveryReadLimiter, (request: Request, response: Response) => {
  const id = typeof request.params.id === 'string' ? request.params.id : '';
  const vector = fraudRecoveryService.getVector(id);
  if (!vector) {
    response.status(404).json({
      success: false,
      message: 'Fraud vector not found. Please select a valid category.',
    });
    return;
  }

  response.json({
    success: true,
    data: vector,
  });
});

/**
   * GET /api/recovery/contacts
   * Returns emergency national helplines and bank 24x7 fraud blocking directories.
   */
recoveryRouter.get('/contacts', recoveryReadLimiter, (_request: Request, response: Response) => {
  const directory = fraudRecoveryService.getEmergencyDirectory();
  response.json({
    success: true,
    data: directory,
  });
});

/**
   * POST /api/recovery/draft-complaint
   * Generates a formal, printable FIR / Cyber Crime Complaint representation.
   */
recoveryRouter.post('/draft-complaint', recoveryDraftLimiter, (request: Request, response: Response) => {
  try {
    const result = fraudRecoveryService.generateComplaintLetter(request.body);
    response.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(400).json({
        success: false,
        message: 'Invalid complaint input details. Please review required fields.',
        details: error.flatten().fieldErrors,
      });
      return;
    }

    logger.warn('Failed to draft legal complaint', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    response.status(500).json({
      success: false,
      message: 'Unable to generate complaint letter. Please check input parameters.',
    });
  }
});

/**
   * POST /api/recovery/investigation
   * Authenticated: Bridges the recovery plan & complaint into an Investigation case.
   */
recoveryRouter.post(
  '/investigation',
  scannerAuth,
  investigationWriteLimiter,
  async (request: Request, response: Response) => {
    const auth = getScannerAuth(response.locals.scannerAuth);
    if (!auth) {
      response.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const parseResult = bridgeInvestigationSchema.safeParse(request.body);
    if (!parseResult.success) {
      response.status(400).json({
        success: false,
        message: 'Invalid investigation bridging parameters.',
        details: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const investigation = await fraudRecoveryService.bridgeToInvestigation(
        auth.accessToken,
        auth.userId,
        parseResult.data,
      );

      response.status(201).json({
        success: true,
        data: investigation,
      });
    } catch (error) {
      logger.warn('Failed to bridge recovery to investigation', {
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
      response.status(500).json({
        success: false,
        message: 'Unable to create investigation case from recovery record.',
      });
    }
  },
);
