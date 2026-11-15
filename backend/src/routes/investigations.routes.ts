import { Router, type Response } from 'express';
import { z } from 'zod';
import { getScannerAuth, scannerAuth } from '../middleware/scannerAuth.js';
import { analyzeInvestigationContext } from '../services/investigations/investigation-analysis.service.js';
import {
  addInvestigationEvidence,
  addInvestigationNote,
  createInvestigation,
  deleteInvestigation,
  deleteInvestigationEvidence,
  getInvestigation,
  listInvestigations,
  updateInvestigation,
} from '../services/investigations/investigation.service.js';
import { logger } from '../utils/logger.js';
import { sendUserSecurityPush } from '../services/security-center/web-push.service.js';
import {
  investigationWriteLimiter,
  investigationReadLimiter,
} from '../services/rate-limiting/rate-limiter.service.js';
import { investigationQueue } from '../services/resilience/resilience.service.js';
import {
  QueueCapacityError,
  QueueTimeoutError,
} from '../services/resilience/concurrency-queue.js';

export const investigationsRouter = Router();

const idSchema = z.string().uuid();
const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2_000).default(''),
}).strict();
const updateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2_000).optional(),
  status: z.enum(['open', 'in_progress', 'resolved']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);
const noteSchema = z.object({ summary: z.string().trim().min(1).max(2_000) }).strict();
const evidenceSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
  objectPath: z.string().min(1).max(512),
  mimeType: z.enum([
    'application/json',
    'application/pdf',
    'message/rfc822',
    'text/csv',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();


function authContext(response: Response) {
  return getScannerAuth(response.locals.scannerAuth);
}

function reportFailure(response: Response, action: string, error: unknown) {
  logger.warn(`Investigation ${action} failed`, {
    errorType: error instanceof Error ? error.message : 'UnknownError',
  });
  response.status(503).json({
    success: false,
    message: 'The investigation service is unavailable. Check that the database migration and evidence bucket are configured.',
  });
}

investigationsRouter.use(scannerAuth);

investigationsRouter.get('/', investigationReadLimiter, async (_request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const investigations = await listInvestigations(auth.accessToken);
    response.status(200).json({ success: true, investigations });
  } catch (error) {
    reportFailure(response, 'list', error);
  }
});

investigationsRouter.post('/', async (request, response) => {
  const parsed = createSchema.safeParse(request.body);
  const auth = authContext(response);
  if (!parsed.success) {
    response.status(400).json({ success: false, message: 'Provide a title up to 120 characters and a description up to 2,000 characters.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const investigation = await createInvestigation(auth.accessToken, auth.userId, parsed.data);
    response.status(201).json({ success: true, investigation });
  } catch (error) {
    reportFailure(response, 'create', error);
  }
});

investigationsRouter.get('/:id', investigationReadLimiter, async (request, response) => {
  const id = idSchema.safeParse(request.params.id);

  const auth = authContext(response);
  if (!id.success) {
    response.status(400).json({ success: false, message: 'Invalid investigation ID.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const investigation = await getInvestigation(auth.accessToken, id.data);
    if (!investigation) {
      response.status(404).json({ success: false, message: 'Investigation not found.' });
      return;
    }
    response.status(200).json({ success: true, investigation });
  } catch (error) {
    reportFailure(response, 'detail', error);
  }
});

investigationsRouter.patch('/:id', async (request, response) => {
  const id = idSchema.safeParse(request.params.id);
  const parsed = updateSchema.safeParse(request.body);
  const auth = authContext(response);
  if (!id.success || !parsed.success) {
    response.status(400).json({ success: false, message: 'Provide a valid investigation ID and update.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const previous = parsed.data.status === undefined
      ? null
      : await getInvestigation(auth.accessToken, id.data);
    if (parsed.data.status !== undefined && !previous) {
      response.status(404).json({ success: false, message: 'Investigation not found.' });
      return;
    }
    const investigation = await updateInvestigation(auth.accessToken, id.data, parsed.data);
    if (!investigation) {
      response.status(404).json({ success: false, message: 'Investigation not found.' });
      return;
    }
    if (previous && previous.status !== investigation.status) {
      void sendUserSecurityPush(auth.accessToken, auth.userId, {
        sourceId: `${investigation.id}-${investigation.updated_at}`,
        category: 'investigation',
      }).catch((error: unknown) => {
        logger.warn('Investigation push notification could not be sent', {
          errorType: error instanceof Error ? error.name : 'UnknownError',
        });
      });
    }
    response.status(200).json({ success: true, investigation });
  } catch (error) {
    reportFailure(response, 'update', error);
  }
});

investigationsRouter.delete('/:id', async (request, response) => {
  const id = idSchema.safeParse(request.params.id);
  const auth = authContext(response);
  if (!id.success) {
    response.status(400).json({ success: false, message: 'Invalid investigation ID.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const deleted = await deleteInvestigation(auth.accessToken, id.data);
    if (!deleted) {
      response.status(404).json({ success: false, message: 'Investigation not found.' });
      return;
    }
    response.status(200).json({ success: true });
  } catch (error) {
    reportFailure(response, 'delete', error);
  }
});

investigationsRouter.post('/:id/notes', async (request, response) => {
  const id = idSchema.safeParse(request.params.id);
  const parsed = noteSchema.safeParse(request.body);
  const auth = authContext(response);
  if (!id.success || !parsed.success) {
    response.status(400).json({ success: false, message: 'Provide a valid investigation ID and note.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const event = await addInvestigationNote(auth.accessToken, auth.userId, id.data, parsed.data.summary);
    if (!event) {
      response.status(404).json({ success: false, message: 'Investigation not found.' });
      return;
    }
    response.status(201).json({ success: true, event });
  } catch (error) {
    reportFailure(response, 'note', error);
  }
});

investigationsRouter.post('/:id/evidence', async (request, response) => {
  const id = idSchema.safeParse(request.params.id);
  const parsed = evidenceSchema.safeParse(request.body);
  const auth = authContext(response);
  if (!id.success || !parsed.success) {
    response.status(400).json({ success: false, message: 'Evidence metadata is invalid.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const evidence = await addInvestigationEvidence(
      auth.accessToken,
      auth.userId,
      id.data,
      parsed.data,
    );
    if (!evidence) {
      response.status(404).json({ success: false, message: 'Investigation not found.' });
      return;
    }
    void sendUserSecurityPush(auth.accessToken, auth.userId, {
      sourceId: evidence.id,
      category: 'investigation',
    }).catch((error: unknown) => {
      logger.warn('Investigation evidence push notification could not be sent', {
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
    });
    response.status(201).json({ success: true, evidence });
  } catch (error) {
    reportFailure(response, 'evidence upload', error);
  }
});

investigationsRouter.delete('/:id/evidence/:evidenceId', async (request, response) => {
  const id = idSchema.safeParse(request.params.id);
  const evidenceId = idSchema.safeParse(request.params.evidenceId);
  const auth = authContext(response);
  if (!id.success || !evidenceId.success) {
    response.status(400).json({ success: false, message: 'Invalid evidence ID.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const deleted = await deleteInvestigationEvidence(
      auth.accessToken,
      id.data,
      evidenceId.data,
    );
    if (!deleted) {
      response.status(404).json({ success: false, message: 'Evidence not found.' });
      return;
    }
    response.status(200).json({ success: true });
  } catch (error) {
    reportFailure(response, 'evidence delete', error);
  }
});

investigationsRouter.post('/:id/analyze', investigationWriteLimiter, async (request, response, next) => {
  const id = idSchema.safeParse(request.params.id);
  const consent = z.object({ allowExternalAnalysis: z.literal(true) }).strict()
    .safeParse(request.body);
  const auth = authContext(response);
  if (!id.success || !consent.success) {
    response.status(400).json({
      success: false,
      message: 'Explicitly confirm that case notes and evidence metadata may be sent to the configured AI provider.',
    });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const investigation = await getInvestigation(auth.accessToken, id.data);
    if (!investigation) {
      response.status(404).json({ success: false, message: 'Investigation not found.' });
      return;
    }
    const analysis = await investigationQueue.run(async () =>
      analyzeInvestigationContext(investigation),
    );
    response.status(200).json({ success: true, analysis });
  } catch (error) {
    if (error instanceof QueueCapacityError || error instanceof QueueTimeoutError) {
      next(error);
      return;
    }
    reportFailure(response, 'analysis', error);
  }
});

