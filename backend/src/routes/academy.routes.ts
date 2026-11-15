import { Router, type Response } from 'express';
import { z } from 'zod';
import { getScannerAuth, scannerAuth } from '../middleware/scannerAuth.js';
import {
  completeAcademyLesson,
  getAcademyProgress,
  getAcademyQuiz,
  issueAcademyCertificate,
  listAcademyCourses,
  submitAcademyQuiz,
} from '../services/academy/academy.service.js';
import { askAcademyTutor } from '../services/academy/academy-tutor.service.js';
import { logger } from '../utils/logger.js';
import {
  academyTutorLimiter,
  academyReadLimiter,
} from '../services/rate-limiting/rate-limiter.service.js';
import { tutorQueue } from '../services/resilience/resilience.service.js';
import {
  QueueCapacityError,
  QueueTimeoutError,
} from '../services/resilience/concurrency-queue.js';

export const academyRouter = Router();

const slugSchema = z.string().regex(/^[a-z0-9-]{1,80}$/);
const lessonCompletionSchema = z.object({
  timeSpentSeconds: z.number().int().min(0).max(7200),
}).strict();
const quizSubmissionSchema = z.object({
  answers: z.record(z.string(), z.array(z.string().min(1).max(20)).min(1).max(5)),
}).strict();
const tutorRequestSchema = z.object({
  question: z.string().trim().min(1).max(2_000),
  language: z.enum(['en', 'te', 'hi']),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  intent: z.enum(['explain', 'practice', 'mistakes', 'recommend']),
  lessonContext: z.string().max(5_000).default(''),
}).strict();

function authContext(response: Response) {
  return getScannerAuth(response.locals.scannerAuth);
}


function reportFailure(response: Response, action: string, error: unknown) {
  logger.warn(`Academy ${action} failed`, {
    errorType: error instanceof Error ? error.name : 'UnknownError',
  });
  response.status(503).json({
    success: false,
    message: 'The academy service is temporarily unavailable. Please try again later.',
  });
}

academyRouter.use(scannerAuth);

academyRouter.get('/courses', academyReadLimiter, async (_request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    response.status(200).json({ success: true, courses: await listAcademyCourses(auth.accessToken) });
  } catch (error) {
    reportFailure(response, 'course list', error);
  }
});

academyRouter.get('/progress', academyReadLimiter, async (_request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  try {
    response.status(200).json({ success: true, progress: await getAcademyProgress(auth.accessToken) });
  } catch (error) {
    reportFailure(response, 'progress', error);
  }
});

academyRouter.get('/courses/:courseId/quiz', async (request, response) => {
  const courseId = slugSchema.safeParse(request.params.courseId);
  const auth = authContext(response);
  if (!courseId.success) {
    response.status(400).json({ success: false, message: 'Invalid course.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    response.status(200).json({ success: true, questions: await getAcademyQuiz(auth.accessToken, courseId.data) });
  } catch (error) {
    reportFailure(response, 'quiz loading', error);
  }
});

academyRouter.post('/lessons/:lessonId/complete', async (request, response) => {
  const lessonId = slugSchema.safeParse(request.params.lessonId);
  const parsed = lessonCompletionSchema.safeParse(request.body);
  const auth = authContext(response);
  if (!lessonId.success || !parsed.success) {
    response.status(400).json({ success: false, message: 'Provide a valid lesson and time spent.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const result = await completeAcademyLesson(auth.accessToken, lessonId.data, parsed.data.timeSpentSeconds);
    response.status(200).json({ success: true, result });
  } catch (error) {
    reportFailure(response, 'lesson completion', error);
  }
});

academyRouter.post('/courses/:courseId/quiz-attempts', async (request, response) => {
  const courseId = slugSchema.safeParse(request.params.courseId);
  const parsed = quizSubmissionSchema.safeParse(request.body);
  const auth = authContext(response);
  if (!courseId.success || !parsed.success) {
    response.status(400).json({ success: false, message: 'Provide valid answers for the quiz.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const result = await submitAcademyQuiz(auth.accessToken, courseId.data, parsed.data.answers);
    response.status(201).json({ success: true, result });
  } catch (error) {
    reportFailure(response, 'quiz submission', error);
  }
});

academyRouter.post('/courses/:courseId/certificate', async (request, response) => {
  const courseId = slugSchema.safeParse(request.params.courseId);
  const auth = authContext(response);
  if (!courseId.success) {
    response.status(400).json({ success: false, message: 'Invalid course.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const certificate = await issueAcademyCertificate(auth.accessToken, courseId.data);
    response.status(200).json({ success: true, certificate });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'ACADEMY_CERTIFICATE_NOT_ELIGIBLE') {
      response.status(403).json({
        success: false,
        message: 'Complete every lesson and pass the course quiz with at least 80% to earn this certificate.',
      });
      return;
    }
    reportFailure(response, 'certificate', error);
  }
});

academyRouter.post('/tutor', academyTutorLimiter, async (request, response, next) => {
  const parsed = tutorRequestSchema.safeParse(request.body);
  const auth = authContext(response);
  if (!parsed.success) {
    response.status(400).json({ success: false, message: 'Provide a question, supported language, and learning level.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const result = await tutorQueue.run(async () => askAcademyTutor(parsed.data));
    if (result.status === 'unavailable') {
      response.status(503).json({ success: false, message: result.reason });
      return;
    }
    response.status(200).json({ success: true, answer: result.answer, questions: result.questions });
  } catch (error) {
    if (error instanceof QueueCapacityError || error instanceof QueueTimeoutError) {
      next(error);
      return;
    }
    reportFailure(response, 'tutor', error);
  }
});

