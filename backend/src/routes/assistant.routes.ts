import { Router, type Response } from 'express';
import { z } from 'zod';
import { getScannerAuth, scannerAuth } from '../middleware/scannerAuth.js';
import {
  createAssistantConversation,
  deleteAssistantConversation,
  getAssistantContextOptions,
  getAssistantConversation,
  listAssistantConversations,
  sendAssistantMessage,
} from '../services/ai/assistant.service.js';
import { logger } from '../utils/logger.js';
import {
  assistantMessageLimiter,
  assistantReadLimiter,
} from '../services/rate-limiting/rate-limiter.service.js';
import { assistantQueue } from '../services/resilience/resilience.service.js';
import {
  QueueCapacityError,
  QueueTimeoutError,
} from '../services/resilience/concurrency-queue.js';

export const assistantRouter = Router();

const languageSchema = z.enum(['en', 'te', 'hi']);
const idSchema = z.string().uuid();
const createConversationSchema = z.object({
  language: languageSchema,
}).strict();
const messageSchema = z.object({
  content: z.string().trim().min(1).max(4_100)
    .refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)),
  language: languageSchema,
  mode: z.enum(['chat', 'scan', 'learning', 'incident']),
  context: z.object({
    scanId: idSchema.optional(),
    investigationId: idSchema.optional(),
    lessonId: z.string().min(1).max(100).optional(),
  }).strict().default({}),
}).strict();

function authContext(response: Response) {
  return getScannerAuth(response.locals.scannerAuth);
}


function reportFailure(response: Response, action: string, error: unknown) {
  const reason = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  logger.warn(`Assistant ${action} failed`, {
    errorType: error instanceof Error ? error.name : 'UnknownError',
    reason: /^[A-Z0-9_]{1,80}$/.test(reason) ? reason : 'UNKNOWN_ERROR',
  });
  if (reason === 'ASSISTANT_AI_NOT_CONFIGURED') {
    response.status(503).json({
      success: false,
      message: 'CyberSaathi Assistant is unavailable because the AI provider is not configured on the backend.',
    });
    return;
  }
  if (reason.startsWith('ASSISTANT_AI_')) {
    response.status(503).json({
      success: false,
      message: 'The configured AI provider is temporarily unavailable or returned an unusable response. Your message was not saved.',
    });
    return;
  }
  if (reason.endsWith('_UNAVAILABLE')) {
    response.status(503).json({
      success: false,
      message: 'Assistant data could not be loaded. Check Supabase connectivity and confirm the assistant, Academy, scanner, and investigation migrations are applied.',
    });
    return;
  }
  if (reason === 'ASSISTANT_MESSAGE_SAVE_FAILED' ||
      reason === 'ASSISTANT_CONVERSATION_UPDATE_FAILED') {
    response.status(503).json({
      success: false,
      message: 'The assistant response could not be saved to your conversation. Please retry; this exchange was not saved.',
    });
    return;
  }
  if (reason === 'ASSISTANT_CONTEXT_NOT_FOUND' || reason === 'ASSISTANT_CONVERSATION_NOT_FOUND') {
    response.status(404).json({ success: false, message: 'The selected conversation or context was not found.' });
    return;
  }
  response.status(503).json({
    success: false,
    message: 'The assistant service is temporarily unavailable. Please try again later.',
  });
}

assistantRouter.use(scannerAuth);

assistantRouter.get('/conversations', assistantReadLimiter, async (_request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    response.status(200).json({
      success: true,
      conversations: await listAssistantConversations(auth.accessToken),
    });
  } catch (error) {
    reportFailure(response, 'conversation list', error);
  }
});

assistantRouter.post('/conversations', async (request, response) => {
  const parsed = createConversationSchema.safeParse(request.body);
  const auth = authContext(response);
  if (!parsed.success) {
    response.status(400).json({ success: false, message: 'Choose a supported conversation language.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const conversation = await createAssistantConversation(
      auth.accessToken,
      auth.userId,
      parsed.data.language,
    );
    response.status(201).json({ success: true, conversation });
  } catch (error) {
    reportFailure(response, 'conversation creation', error);
  }
});

assistantRouter.get('/context-options', assistantReadLimiter, async (_request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    response.status(200).json({
      success: true,
      options: await getAssistantContextOptions(auth.accessToken),
    });
  } catch (error) {
    reportFailure(response, 'context options', error);
  }
});

assistantRouter.get('/conversations/:id', assistantReadLimiter, async (request, response) => {
  const id = idSchema.safeParse(request.params.id);
  const auth = authContext(response);
  if (!id.success) {
    response.status(400).json({ success: false, message: 'Invalid conversation ID.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const conversation = await getAssistantConversation(auth.accessToken, id.data);
    if (!conversation) {
      response.status(404).json({ success: false, message: 'Conversation not found.' });
      return;
    }
    response.status(200).json({ success: true, ...conversation });
  } catch (error) {
    reportFailure(response, 'conversation loading', error);
  }
});

assistantRouter.post('/conversations/:id/messages', assistantMessageLimiter, async (request, response, next) => {
  const id = idSchema.safeParse(request.params.id);
  const parsed = messageSchema.safeParse(request.body);
  const auth = authContext(response);
  if (!id.success || !parsed.success) {
    response.status(400).json({
      success: false,
      message: 'Provide a valid message, supported language, and context selections.',
    });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const result = await assistantQueue.run(async () =>
      sendAssistantMessage({
        accessToken: auth.accessToken,
        userId: auth.userId,
        conversationId: id.data,
        ...parsed.data,
      }),
    );
    response.status(200).json({ success: true, ...result });
  } catch (error) {
    if (error instanceof QueueCapacityError || error instanceof QueueTimeoutError) {
      next(error);
      return;
    }
    reportFailure(response, 'message', error);
  }
});


assistantRouter.delete('/conversations/:id', async (request, response) => {
  const id = idSchema.safeParse(request.params.id);
  const auth = authContext(response);
  if (!id.success) {
    response.status(400).json({ success: false, message: 'Invalid conversation ID.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const deleted = await deleteAssistantConversation(auth.accessToken, id.data);
    if (!deleted) {
      response.status(404).json({ success: false, message: 'Conversation not found.' });
      return;
    }
    response.status(200).json({ success: true });
  } catch (error) {
    reportFailure(response, 'conversation deletion', error);
  }
});
