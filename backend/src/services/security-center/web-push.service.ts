import * as webpushModule from 'web-push';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { getUserSupabaseClient } from '../../config/supabase.js';
import { logger } from '../../utils/logger.js';

// Robust interop for web-push across CommonJS and ESM runtimes:
const webpush =
  (webpushModule as unknown as { default?: typeof webpushModule }).default &&
  typeof (webpushModule as unknown as { default?: typeof webpushModule }).default?.setVapidDetails === 'function'
    ? (webpushModule as unknown as { default: typeof webpushModule }).default
    : webpushModule;

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }).strict(),
}).strict();

const storedSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string(),
  auth: z.string(),
}).strict();

const notificationPreferencesSchema = z.object({
  critical_alerts: z.boolean(),
  high_risk_alerts: z.boolean(),
  investigation_updates: z.boolean(),
}).strict();

export type PushCategory = 'critical' | 'high_risk' | 'investigation';

export function initializeVapid(config: {
  subject?: string | undefined;
  publicKey?: string | undefined;
  privateKey?: string | undefined;
} = {
  subject: env.vapidSubject,
  publicKey: env.vapidPublicKey,
  privateKey: env.vapidPrivateKey,
}): boolean {
  const subject = config.subject?.trim();
  const publicKey = config.publicKey?.trim();
  const privateKey = config.privateKey?.trim();

  if (!subject || !publicKey || !privateKey) {
    logger.info('Web Push VAPID is not fully configured; push notifications disabled.');
    return false;
  }

  const isMailto = /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(subject);
  let isHttps = false;
  try {
    const url = new URL(subject);
    isHttps = url.protocol === 'https:';
  } catch {
    isHttps = false;
  }

  if (!isMailto && !isHttps) {
    logger.warn('Web Push VAPID subject must be a valid mailto: or https: URI; push notifications disabled.', {
      subject,
    });
    return false;
  }

  try {
    if (typeof webpush.setVapidDetails !== 'function') {
      logger.warn('Web Push setVapidDetails is unavailable in runtime; push notifications disabled.');
      return false;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    logger.info('Web Push VAPID initialized successfully.');
    return true;
  } catch (error) {
    logger.warn('Web Push VAPID initialization failed; push notifications disabled.', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

const vapidConfigured = initializeVapid();

function isSupportedPushEndpoint(endpoint: string) {
  const url = new URL(endpoint);
  const host = url.hostname.toLowerCase();
  return url.protocol === 'https:' && (
    host === 'fcm.googleapis.com' ||
    host.endsWith('.push.services.mozilla.com') ||
    host === 'web.push.apple.com' ||
    host === 'notify.windows.com' ||
    /^wns\d+-[a-z0-9-]+\.notify\.windows\.com$/.test(host)
  );
}

export function getWebPushConfiguration() {
  return {
    configured: vapidConfigured,
    publicKey: vapidConfigured ? env.vapidPublicKey ?? null : null,
  };
}

export async function saveWebPushSubscription(
  accessToken: string,
  userId: string,
  input: unknown,
) {
  if (!vapidConfigured) throw new Error('WEB_PUSH_NOT_CONFIGURED');
  const subscription = subscriptionSchema.parse(input);
  if (!isSupportedPushEndpoint(subscription.endpoint)) {
    throw new Error('WEB_PUSH_ENDPOINT_UNSUPPORTED');
  }
  const client = getUserSupabaseClient(accessToken);
  const { error } = await client.from('web_push_subscriptions').insert({
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  });
  if (!error) return;
  if (error.code === '23505') {
    const { data, error: lookupError } = await client.from('web_push_subscriptions')
      .select('id')
      .eq('endpoint', subscription.endpoint)
      .eq('user_id', userId)
      .maybeSingle();
    if (!lookupError && data) return;
    if (!lookupError) throw new Error('WEB_PUSH_SUBSCRIPTION_IN_USE');
  }
  throw new Error('WEB_PUSH_SUBSCRIPTION_SAVE_FAILED');
}

export async function removeWebPushSubscription(
  accessToken: string,
  userId: string,
  endpoint: string,
) {
  const parsedEndpoint = z.string().url().max(2048).safeParse(endpoint);
  if (!parsedEndpoint.success || !isSupportedPushEndpoint(parsedEndpoint.data)) {
    throw new Error('WEB_PUSH_ENDPOINT_UNSUPPORTED');
  }
  const client = getUserSupabaseClient(accessToken);
  const { error } = await client.from('web_push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', parsedEndpoint.data);
  if (error) throw new Error('WEB_PUSH_SUBSCRIPTION_REMOVE_FAILED');
}

export async function sendUserSecurityPush(
  accessToken: string,
  userId: string,
  input: {
    sourceId: string;
    category: PushCategory;
  },
) {
  if (!vapidConfigured) return;
  const client = getUserSupabaseClient(accessToken);
  const [subscriptionsResult, preferencesResult] = await Promise.all([
    client.from('web_push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId),
    client.from('user_notification_preferences')
      .select('critical_alerts, high_risk_alerts, investigation_updates')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);
  if (subscriptionsResult.error || preferencesResult.error) {
    throw new Error('WEB_PUSH_SETTINGS_UNAVAILABLE');
  }
  const preferences = preferencesResult.data
    ? notificationPreferencesSchema.parse(preferencesResult.data)
    : { critical_alerts: true, high_risk_alerts: true, investigation_updates: true };
  const enabled = input.category === 'critical'
    ? preferences.critical_alerts
    : input.category === 'high_risk'
      ? preferences.high_risk_alerts
      : preferences.investigation_updates;
  if (!enabled) return;

  const subscriptions = z.array(storedSubscriptionSchema).parse(subscriptionsResult.data);
  const payload = JSON.stringify({
    title: input.category === 'investigation'
      ? 'Investigation updated'
      : input.category === 'critical'
        ? 'Critical security alert'
        : 'High-risk scan alert',
    body: input.category === 'investigation'
      ? 'An investigation has a new update. Open CyberSaathi to review it.'
      : 'A saved scan needs your attention. Open CyberSaathi to review it.',
    tag: `cybersaathi-${input.sourceId}`,
  });
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, payload, { TTL: 60 });
    } catch (error) {
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
        ? error.statusCode
        : undefined;
      if (statusCode === 404 || statusCode === 410) {
        const { error: deleteError } = await client.from('web_push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', subscription.endpoint);
        if (deleteError) {
          logger.warn('Invalid web push subscription could not be removed', {
            userId,
            errorType: deleteError.code ?? 'DatabaseError',
          });
        }
        return;
      }
      logger.warn('Security web push delivery failed', {
        userId,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }));
}
