import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

const backendEnvPath = resolve(__dirname, '..', '..', '.env');
dotenv.config({ path: backendEnvPath });

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().trim().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_URL: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() !== '' ? value : 'https://cybersaathiai.netlify.app'),
    z.string().url(),
  ),
  ALLOWED_ORIGINS: z
    .string()
    .default('')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean))
    .pipe(z.array(z.string().url())),
  SUPABASE_URL: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() !== '' ? value : (process.env.VITE_SUPABASE_URL || 'https://jksiqoaonnfysqkhavgf.supabase.co')),
    z.string().trim().url().refine(
      (value) => !value.includes('your-project-ref'),
      'Replace the Supabase URL example with a project URL.',
    ),
  ),
  SUPABASE_PUBLISHABLE_KEY: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() !== '' ? value : (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_nv66ynZ_CxXDww-4DdZkAA_diHYbIbj')),
    z.string().trim().min(1).refine(
      (value) => !/^(your[-_]|replace[-_]|<.*>|changeme|example)/i.test(value),
      'Replace the Supabase key example with a publishable key.',
    ),
  ),
  GOOGLE_SAFE_BROWSING_API_KEY: z.string().trim().optional(),
  VIRUSTOTAL_API_KEY: z.string().trim().optional(),
  AI_API_BASE_URL: z.preprocess(
    (value) => typeof value === 'string' && value.trim() !== '' ? value : (process.env.AI_API_KEY ? 'https://generativelanguage.googleapis.com/v1beta/openai' : undefined),
    z.string().url().refine((value) => new URL(value).protocol === 'https:').optional(),
  ),
  AI_API_KEY: z.string().trim().optional(),
  AI_MODEL: z.preprocess(
    (value) => typeof value === 'string' && value.trim() !== '' ? value : (process.env.AI_API_KEY ? 'gemini-3-flash-preview' : undefined),
    z.string().trim().optional(),
  ),
  NEXCONN_APP_KEY: z.string().trim().optional(),
  NEXCONN_APP_SECRET: z.string().trim().optional(),
  NEXCONN_API_REGION: z.preprocess(
    (value) => typeof value === 'string' && value.trim() !== '' ? value : (process.env.NEXCONN_APP_KEY ? 'sg' : undefined),
    z.enum(['sg', 'us']).optional(),
  ),
  NEXCONN_CALLS_ENABLED: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.enum(['true', 'false']).default('false'),
  ).transform((value) => value === 'true'),
  VAPID_PUBLIC_KEY: z.string().trim().optional(),
  VAPID_PRIVATE_KEY: z.string().trim().optional(),
  VAPID_SUBJECT: z.string().trim().optional(),
  REDIS_URL: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().url().optional(),
  ),
}).superRefine((value, context) => {
  const supabaseUrl = new URL(value.SUPABASE_URL);
  const isLocalSupabase =
    ['localhost', '127.0.0.1'].includes(supabaseUrl.hostname);
  if (
    supabaseUrl.username ||
    supabaseUrl.password ||
    (supabaseUrl.protocol !== 'https:' &&
      !(value.NODE_ENV !== 'production' && supabaseUrl.protocol === 'http:' && isLocalSupabase))
  ) {
    context.addIssue({
      code: 'custom',
      path: ['SUPABASE_URL'],
      message: 'SUPABASE_URL must use HTTPS (HTTP is allowed only for local development).',
    });
  }

  const frontendUrl = new URL(value.FRONTEND_URL);
  if (
    frontendUrl.username ||
    frontendUrl.password ||
    (value.NODE_ENV === 'production' && frontendUrl.protocol !== 'https:')
  ) {
    context.addIssue({
      code: 'custom',
      path: ['FRONTEND_URL'],
      message: 'FRONTEND_URL must use HTTPS in production and must not contain credentials.',
    });
  }

  if (value.NODE_ENV === 'production' && value.ALLOWED_ORIGINS.some((origin) => {
    const parsedOrigin = new URL(origin);
    const isLocal = ['localhost', '127.0.0.1'].includes(parsedOrigin.hostname);
    return (!isLocal && parsedOrigin.protocol !== 'https:') ||
      parsedOrigin.username.length > 0 ||
      parsedOrigin.password.length > 0;
  })) {
    context.addIssue({
      code: 'custom',
      path: ['ALLOWED_ORIGINS'],
      message: 'ALLOWED_ORIGINS must contain only HTTPS origins or localhost in production.',
    });
  }

  const aiValues = [value.AI_API_BASE_URL, value.AI_API_KEY, value.AI_MODEL];
  if (aiValues.some(Boolean) && !aiValues.every(Boolean)) {
    context.addIssue({
      code: 'custom',
      path: ['AI_API_BASE_URL'],
      message: 'Configure AI_API_BASE_URL, AI_API_KEY, and AI_MODEL together.',
    });
  }

  const nexconnValues = [
    value.NEXCONN_APP_KEY,
    value.NEXCONN_APP_SECRET,
    value.NEXCONN_API_REGION,
  ];
  if (nexconnValues.some(Boolean) && !nexconnValues.every(Boolean)) {
    context.addIssue({
      code: 'custom',
      path: ['NEXCONN_APP_KEY'],
      message: 'Configure NEXCONN_APP_KEY, NEXCONN_APP_SECRET, and NEXCONN_API_REGION together.',
    });
  }
  if (value.NEXCONN_CALLS_ENABLED && !nexconnValues.every(Boolean)) {
    context.addIssue({
      code: 'custom',
      path: ['NEXCONN_CALLS_ENABLED'],
      message: 'NEXCONN_CALLS_ENABLED=true requires the complete Nexconn configuration.',
    });
  }

  const vapidValues = [
    value.VAPID_PUBLIC_KEY,
    value.VAPID_PRIVATE_KEY,
    value.VAPID_SUBJECT,
  ];
  if (vapidValues.some(Boolean) && !vapidValues.every(Boolean)) {
    context.addIssue({
      code: 'custom',
      path: ['VAPID_PUBLIC_KEY'],
      message: 'Configure VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT together.',
    });
  }
  if (
    value.VAPID_SUBJECT &&
    !/^(mailto:.+|https:\/\/.+)$/.test(value.VAPID_SUBJECT)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['VAPID_SUBJECT'],
      message: 'VAPID_SUBJECT must be a mailto: address or HTTPS URL.',
    });
  }
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const invalidVariables = [
    ...new Set(
      parsedEnvironment.error.issues.map((issue) => issue.path.join('.')),
    ),
  ];
  throw new Error(
    `Invalid environment configuration. Check: ${invalidVariables.join(', ')}`,
  );
}

const localDevelopmentOrigins = (() => {
  const configuredOrigin = parsedEnvironment.data.FRONTEND_URL;
  const configuredUrl = new URL(configuredOrigin);
  if (
    parsedEnvironment.data.NODE_ENV === 'production' ||
    (configuredUrl.hostname !== 'localhost' && configuredUrl.hostname !== '127.0.0.1')
  ) {
    return [];
  }
  configuredUrl.hostname = configuredUrl.hostname === 'localhost'
    ? '127.0.0.1'
    : 'localhost';
  return [configuredUrl.origin];
})();

export const env = {
  port: parsedEnvironment.data.PORT,
  host: parsedEnvironment.data.HOST,
  nodeEnv: parsedEnvironment.data.NODE_ENV,
  frontendUrl: parsedEnvironment.data.FRONTEND_URL,
  allowedOrigins: [
    ...new Set([
      parsedEnvironment.data.FRONTEND_URL,
      ...parsedEnvironment.data.ALLOWED_ORIGINS,
      'https://cybersaathiai.netlify.app',
      ...localDevelopmentOrigins,
    ]),
  ],
  supabaseUrl: parsedEnvironment.data.SUPABASE_URL,
  supabasePublishableKey: parsedEnvironment.data.SUPABASE_PUBLISHABLE_KEY,
  googleSafeBrowsingApiKey: parsedEnvironment.data.GOOGLE_SAFE_BROWSING_API_KEY,
  virusTotalApiKey: parsedEnvironment.data.VIRUSTOTAL_API_KEY,
  aiApiBaseUrl: parsedEnvironment.data.AI_API_BASE_URL,
  aiApiKey: parsedEnvironment.data.AI_API_KEY,
  aiModel: parsedEnvironment.data.AI_MODEL,
  nexconnAppKey: parsedEnvironment.data.NEXCONN_APP_KEY,
  nexconnAppSecret: parsedEnvironment.data.NEXCONN_APP_SECRET,
  nexconnApiRegion: parsedEnvironment.data.NEXCONN_API_REGION,
  nexconnCallsEnabled: parsedEnvironment.data.NEXCONN_CALLS_ENABLED,
  vapidPublicKey: parsedEnvironment.data.VAPID_PUBLIC_KEY,
  vapidPrivateKey: parsedEnvironment.data.VAPID_PRIVATE_KEY,
  vapidSubject: parsedEnvironment.data.VAPID_SUBJECT,
  redisUrl: parsedEnvironment.data.REDIS_URL,
};
