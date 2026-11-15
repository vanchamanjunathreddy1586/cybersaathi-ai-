import { Router, type Response } from 'express';
import { z } from 'zod';
import { getScannerAuth, scannerAuth } from '../middleware/scannerAuth.js';
import {
  deleteSecurityAlert,
  getNotificationPreferences,
  getProviderConfiguration,
  getSecurityDashboard,
  listSecurityAlerts,
  markAllSecurityAlertsRead,
  markSecurityAlertRead,
  saveNotificationPreferences,
} from '../services/security-center/security-center.service.js';
import { checkThreatReputation } from '../services/security-center/threat-intelligence.service.js';
import {
  getWebPushConfiguration,
  removeWebPushSubscription,
  saveWebPushSubscription,
} from '../services/security-center/web-push.service.js';
import { logger } from '../utils/logger.js';
import { calculateUserSafetyScore } from '../services/security-center/safety-score.service.js';
import { getSocOverview } from '../services/security-center/soc-overview.service.js';
import {
  securityCenterThreatLimiter,
  securityCenterPushLimiter,
} from '../services/rate-limiting/rate-limiter.service.js';

export const securityCenterRouter = Router();

const dashboardQuerySchema = z.object({
  days: z.coerce.number().int().refine((value) => [7, 30, 90, 365].includes(value)).default(30),
}).strict();
const severityQuerySchema = z.object({
  severity: z.enum(['all', 'medium', 'high', 'critical']).default('all'),
}).strict();
const alertIdSchema = z.string().uuid();
const preferencesSchema = z.object({
  critical_alerts: z.boolean(),
  high_risk_alerts: z.boolean(),
  investigation_updates: z.boolean(),
  community_notifications: z.boolean(),
  learning_reminders: z.boolean(),
  browser_notifications: z.boolean(),
}).strict();
const threatCheckSchema = z.object({
  type: z.enum(['url', 'domain', 'hash']),
  indicator: z.string().trim().min(1).max(2048),
  shareWithProviders: z.literal(true),
}).strict();

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }).strict(),
}).strict();
const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
}).strict();

function authContext(response: Response) {
  return getScannerAuth(response.locals.scannerAuth);
}

function reportFailure(response: Response, action: string, error: unknown) {
  logger.warn(`Security center ${action} failed`, {
    errorType: error instanceof Error ? error.name : 'UnknownError',
  });
  response.status(503).json({
    success: false,
    message: 'The security center service is temporarily unavailable. Please try again later.',
  });
}

securityCenterRouter.use(scannerAuth);

securityCenterRouter.get('/dashboard', async (request, response) => {
  const parsed = dashboardQuerySchema.safeParse(request.query);
  const auth = authContext(response);
  if (!parsed.success) {
    response.status(400).json({ success: false, message: 'Choose a supported activity period.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    response.status(200).json({
      success: true,
      dashboard: await getSecurityDashboard(auth.accessToken, parsed.data.days),
    });
  } catch (error) {
    reportFailure(response, 'dashboard load', error);
  }
});

securityCenterRouter.get('/safety-score', async (_request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const safetyScore = await calculateUserSafetyScore(auth.accessToken, auth.userId);
    response.status(200).json({ success: true, data: safetyScore });
  } catch (error) {
    reportFailure(response, 'safety score calculation', error);
  }
});

securityCenterRouter.get('/soc-overview', async (_request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const socData = await getSocOverview();
    response.status(200).json({ success: true, data: socData });
  } catch (error) {
    reportFailure(response, 'SOC overview load', error);
  }
});

securityCenterRouter.get('/alerts', async (request, response) => {
  const parsed = severityQuerySchema.safeParse(request.query);
  const auth = authContext(response);
  if (!parsed.success) {
    response.status(400).json({ success: false, message: 'Choose a supported alert severity.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    response.status(200).json({
      success: true,
      alerts: await listSecurityAlerts(auth.accessToken, parsed.data.severity),
    });
  } catch (error) {
    reportFailure(response, 'alert list', error);
  }
});

securityCenterRouter.post('/alerts/read-all', async (_request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    await markAllSecurityAlertsRead(auth.accessToken);
    response.status(200).json({ success: true });
  } catch (error) {
    reportFailure(response, 'mark all alerts read', error);
  }
});

securityCenterRouter.post('/alerts/:id/read', async (request, response) => {
  const id = alertIdSchema.safeParse(request.params.id);
  const auth = authContext(response);
  if (!id.success) {
    response.status(400).json({ success: false, message: 'Invalid alert ID.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const updated = await markSecurityAlertRead(auth.accessToken, id.data);
    if (!updated) {
      response.status(404).json({ success: false, message: 'Alert not found or already read.' });
      return;
    }
    response.status(200).json({ success: true });
  } catch (error) {
    reportFailure(response, 'mark alert read', error);
  }
});

securityCenterRouter.delete('/alerts/:id', async (request, response) => {
  const id = alertIdSchema.safeParse(request.params.id);
  const auth = authContext(response);
  if (!id.success) {
    response.status(400).json({ success: false, message: 'Invalid alert ID.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const deleted = await deleteSecurityAlert(auth.accessToken, id.data);
    if (!deleted) {
      response.status(404).json({ success: false, message: 'Alert not found.' });
      return;
    }
    response.status(200).json({ success: true });
  } catch (error) {
    reportFailure(response, 'delete alert', error);
  }
});

securityCenterRouter.get('/notification-preferences', async (_request, response) => {
  const auth = authContext(response);
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    response.status(200).json({
      success: true,
      preferences: await getNotificationPreferences(auth.accessToken, auth.userId),
    });
  } catch (error) {
    reportFailure(response, 'load notification preferences', error);
  }
});

securityCenterRouter.put('/notification-preferences', async (request, response) => {
  const parsed = preferencesSchema.safeParse(request.body);
  const auth = authContext(response);
  if (!parsed.success) {
    response.status(400).json({ success: false, message: 'Provide valid notification preferences.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    const preferences = await saveNotificationPreferences(
      auth.accessToken,
      auth.userId,
      parsed.data,
    );
    response.status(200).json({ success: true, preferences });
  } catch (error) {
    reportFailure(response, 'save notification preferences', error);
  }
});

securityCenterRouter.get('/threat-intelligence/providers', (_request, response) => {
  response.status(200).json({ success: true, providers: getProviderConfiguration() });
});

securityCenterRouter.get('/push/configuration', (_request, response) => {
  response.status(200).json({ success: true, push: getWebPushConfiguration() });
});

securityCenterRouter.put('/push/subscription', securityCenterPushLimiter, async (request, response) => {
  const parsed = pushSubscriptionSchema.safeParse(request.body);

  const auth = authContext(response);
  if (!parsed.success) {
    response.status(400).json({ success: false, message: 'Provide a valid browser push subscription.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  if (!getWebPushConfiguration().configured) {
    response.status(503).json({
      success: false,
      message: 'Web Push is unavailable. Configure VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT on the backend.',
    });
    return;
  }
  try {
    await saveWebPushSubscription(auth.accessToken, auth.userId, parsed.data);
    response.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'WEB_PUSH_SUBSCRIPTION_IN_USE') {
      response.status(409).json({
        success: false,
        message: 'This browser subscription belongs to another account. Unsubscribe that account first.',
      });
      return;
    }
    if (error instanceof Error && error.message === 'WEB_PUSH_ENDPOINT_UNSUPPORTED') {
      response.status(400).json({ success: false, message: 'This browser push provider is not supported.' });
      return;
    }
    reportFailure(response, 'push subscription save', error);
  }
});

securityCenterRouter.delete('/push/subscription', securityCenterPushLimiter, async (request, response) => {
  const parsed = pushUnsubscribeSchema.safeParse(request.body);
  const auth = authContext(response);
  if (!parsed.success) {
    response.status(400).json({ success: false, message: 'Provide a valid browser push endpoint.' });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  try {
    await removeWebPushSubscription(auth.accessToken, auth.userId, parsed.data.endpoint);
    response.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'WEB_PUSH_ENDPOINT_UNSUPPORTED') {
      response.status(400).json({ success: false, message: 'This browser push provider is not supported.' });
      return;
    }
    reportFailure(response, 'push subscription removal', error);
  }
});

securityCenterRouter.post('/threat-intelligence/check', securityCenterThreatLimiter, async (request, response) => {
  const parsed = threatCheckSchema.safeParse(request.body);

  const auth = authContext(response);
  if (!parsed.success) {
    response.status(400).json({
      success: false,
      message: 'Provide a URL, domain, or supported file hash and explicitly confirm sharing it with configured providers.',
    });
    return;
  }
  if (!auth) {
    response.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  if (
    parsed.data.type === 'domain' &&
    (/[\/?#:@\s]/.test(parsed.data.indicator) || parsed.data.indicator.length > 253)
  ) {
    response.status(400).json({ success: false, message: 'Provide a hostname only, without a path or credentials.' });
    return;
  }
  if (
    parsed.data.type === 'hash' &&
    !/^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})$/i.test(parsed.data.indicator)
  ) {
    response.status(400).json({
      success: false,
      message: 'Provide a valid MD5, SHA-1, or SHA-256 file hash.',
    });
    return;
  }
  try {
    response.status(200).json({
      success: true,
      result: await checkThreatReputation(parsed.data.type, parsed.data.indicator),
    });
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('complete URL') ||
      error.message.includes('credential-free') ||
      error.message.includes('IP-address')
    )) {
      response.status(400).json({ success: false, message: error.message });
      return;
    }
    reportFailure(response, 'threat check', error);
  }
});
