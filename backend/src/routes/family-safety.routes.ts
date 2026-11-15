import { Router, type Response } from 'express';
import { z } from 'zod';
import { getScannerAuth, scannerAuth } from '../middleware/scannerAuth.js';
import { familySafetyService } from '../services/family-safety/family-safety.service.js';
import { logger } from '../utils/logger.js';

export const familySafetyRouter = Router();

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

function authContext(response: Response) {
  return getScannerAuth(response.locals.scannerAuth);
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
    response.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create family circle.',
    });
  }
});

// Join an existing circle using an invite code
familySafetyRouter.post('/join', async (request, response) => {
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
    response.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to join family circle.',
    });
  }
});

// List circles the user belongs to
familySafetyRouter.get('/circles', async (_request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  try {
    const circles = await familySafetyService.listUserCircles(auth.accessToken, auth.userId);
    response.status(200).json({ success: true, data: circles });
  } catch (error) {
    response.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to list family safety circles.',
    });
  }
});

// Get details of a specific circle
familySafetyRouter.get('/circles/:id', async (request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  const circleId = request.params.id;
  try {
    const details = await familySafetyService.getCircleDetails(auth.accessToken, circleId);
    response.status(200).json({ success: true, data: details });
  } catch (error) {
    response.status(404).json({
      success: false,
      message: error instanceof Error ? error.message : 'Circle not found or access denied.',
    });
  }
});

// Broadcast an emergency threat alert to the circle
familySafetyRouter.post('/circles/:id/alerts', async (request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  const parsed = alertBroadcastSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, message: 'Provide valid threat alert details.' });
    return;
  }

  const circleId = request.params.id;
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
    response.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to broadcast threat alert.',
    });
  }
});

// Leave a circle
familySafetyRouter.delete('/circles/:id/leave', async (request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  const circleId = request.params.id;
  try {
    await familySafetyService.leaveCircle(auth.accessToken, circleId, auth.userId);
    response.status(200).json({ success: true });
  } catch (error) {
    response.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to leave circle.',
    });
  }
});
