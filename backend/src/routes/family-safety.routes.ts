import { Router, type Response } from 'express';
import { z } from 'zod';
import { getScannerAuth, scannerAuth } from '../middleware/scannerAuth.js';
import {
  familySafetyService,
  DatabaseMigrationPendingError,
  isMissingTableError,
} from '../services/family-safety/family-safety.service.js';
import {
  familySafetyAlertLimiter,
  familySafetyJoinLimiter,
  familySafetyReadLimiter,
} from '../services/rate-limiting/rate-limiter.service.js';
import { logger } from '../utils/logger.js';

export const familySafetyRouter = Router();

const circleIdParamSchema = z.string().uuid();

const createCircleSchema = z.object({
  name: z.string().trim().min(2).max(64),
  displayName: z.string().trim().max(64).optional(),
}).strict();

const joinCircleSchema = z.object({
  inviteCode: z.string().trim().min(6).max(16),
  displayName: z.string().trim().max(64).optional(),
}).strict();

const alertBroadcastSchema = z.object({
  threatType: z.string().trim().min(2).max(64),
  severity: z.enum(['high', 'critical']),
  summary: z.string().trim().min(5).max(500),
  advice: z.string().trim().min(5).max(500),
}).strict();

const updateMemberProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(64),
}).strict();

function authContext(response: Response) {
  return getScannerAuth(response.locals.scannerAuth);
}

function handleFamilyRouteError(
  response: Response,
  error: unknown,
  fallbackMessage: string,
  defaultStatus = 500,
) {
  if (error instanceof DatabaseMigrationPendingError || isMissingTableError(error)) {
    response.status(503).json({
      success: false,
      code: 'DATABASE_SETUP_PENDING',
      message: 'Family Safety database setup is pending. The database migration has not been applied yet.',
    });
    return;
  }
  const message = error instanceof Error ? error.message : fallbackMessage;
  response.status(defaultStatus).json({
    success: false,
    message,
  });
}

familySafetyRouter.use(scannerAuth);

// Create a new family safety circle
familySafetyRouter.post('/circles', async (request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  const parsed = createCircleSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, message: 'Provide a valid circle name (2–64 characters).' });
    return;
  }

  try {
    const circle = await familySafetyService.createCircle(
      auth.accessToken,
      auth.userId,
      parsed.data.name,
      parsed.data.displayName,
    );
    response.status(201).json({ success: true, data: circle });
  } catch (error) {
    logger.warn('Failed to create family circle', { error: String(error) });
    handleFamilyRouteError(response, error, 'Failed to create family circle.', 500);
  }
});

// Join an existing circle using an invite code
familySafetyRouter.post('/join', familySafetyJoinLimiter, async (request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  const parsed = joinCircleSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, message: 'Provide a valid 6–16 character invite code.' });
    return;
  }

  try {
    const result = await familySafetyService.joinCircleWithInvite(
      auth.accessToken,
      auth.userId,
      parsed.data.inviteCode,
      parsed.data.displayName,
    );
    response.status(200).json({ success: true, data: result });
  } catch (error) {
    handleFamilyRouteError(response, error, 'Failed to join family circle.', 400);
  }
});

// List circles the user belongs to
familySafetyRouter.get('/circles', familySafetyReadLimiter, async (_request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  try {
    const circles = await familySafetyService.listUserCircles(auth.accessToken, auth.userId);
    response.status(200).json({ success: true, data: circles });
  } catch (error) {
    handleFamilyRouteError(response, error, 'Failed to list family safety circles.', 500);
  }
});

// Get details of a specific circle
familySafetyRouter.get('/circles/:id', familySafetyReadLimiter, async (request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  const parsedId = circleIdParamSchema.safeParse(request.params.id);
  if (!parsedId.success) {
    response.status(400).json({ success: false, message: 'Invalid family circle ID format.' });
    return;
  }

  const circleId = parsedId.data;
  try {
    const details = await familySafetyService.getCircleDetails(auth.accessToken, circleId);
    response.status(200).json({ success: true, data: details });
  } catch (error) {
    handleFamilyRouteError(response, error, 'Circle not found or access denied.', 404);
  }
});

// Broadcast an emergency threat alert to the circle
familySafetyRouter.post('/circles/:id/alerts', familySafetyAlertLimiter, async (request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  const parsedId = circleIdParamSchema.safeParse(request.params.id);
  if (!parsedId.success) {
    response.status(400).json({ success: false, message: 'Invalid family circle ID format.' });
    return;
  }

  const parsed = alertBroadcastSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, message: 'Provide valid threat alert details.' });
    return;
  }

  const circleId = parsedId.data;
  try {
    const alert = await familySafetyService.broadcastCircleAlert(
      auth.accessToken,
      circleId,
      auth.userId,
      parsed.data.threatType,
      parsed.data.severity,
      parsed.data.summary,
      parsed.data.advice,
    );
    response.status(201).json({ success: true, data: alert });
  } catch (error) {
    handleFamilyRouteError(response, error, 'Failed to broadcast threat alert.', 400);
  }
});

// Leave a circle
familySafetyRouter.delete('/circles/:id/leave', async (request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  const parsedId = circleIdParamSchema.safeParse(request.params.id);
  if (!parsedId.success) {
    response.status(400).json({ success: false, message: 'Invalid family circle ID format.' });
    return;
  }

  const circleId = parsedId.data;
  try {
    await familySafetyService.leaveCircle(auth.accessToken, circleId, auth.userId);
    response.status(200).json({ success: true });
  } catch (error) {
    handleFamilyRouteError(response, error, 'Failed to leave circle.', 400);
  }
});

// Update authenticated member profile (e.g. display name)
familySafetyRouter.patch('/circles/:id/members/me', async (request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  const parsedId = circleIdParamSchema.safeParse(request.params.id);
  if (!parsedId.success) {
    response.status(400).json({ success: false, message: 'Invalid family circle ID format.' });
    return;
  }

  const parsed = updateMemberProfileSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: parsed.error.issues.map((i) => i.message).join(', ') || 'Invalid update payload.',
    });
    return;
  }

  const circleId = parsedId.data;
  try {
    const member = await familySafetyService.updateMemberProfile(
      auth.accessToken,
      circleId,
      auth.userId,
      parsed.data,
    );
    response.status(200).json({ success: true, data: member });
  } catch (error) {
    handleFamilyRouteError(response, error, 'Failed to update member profile.', 400);
  }
});

