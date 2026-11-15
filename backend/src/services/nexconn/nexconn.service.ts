import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { readJsonLimited } from '../../utils/readJsonLimited.js';

const regionHosts = {
  sg: 'api.sg-light-api.com',
  us: 'api.us-light-api.com',
} as const;

const tokenResponseSchema = z.object({
  code: z.literal(0),
  result: z.object({
    userId: z.string().min(1).max(64),
    accessToken: z.string().min(1).max(256),
  }),
}).strict();

export type NexconnRegion = keyof typeof regionHosts;

export interface NexconnSession {
  appKey: string;
  region: NexconnRegion;
  userId: string;
  token: string;
  callsEnabled: boolean;
}

export function getNexconnConfiguration() {
  const configured = Boolean(
    env.nexconnAppKey && env.nexconnAppSecret && env.nexconnApiRegion,
  );
  return {
    configured,
    callsEnabled: configured && env.nexconnCallsEnabled,
    ...(env.nexconnAppKey ? { appKey: env.nexconnAppKey } : {}),
    ...(env.nexconnApiRegion ? { region: env.nexconnApiRegion } : {}),
  };
}

export function deriveNexconnUserId(supabaseUserId: string): string {
  const digest = createHash('sha256')
    .update(`cybersaathi:nexconn:v1:${supabaseUserId}`)
    .digest('hex');
  return `cs${digest.slice(0, 62)}`;
}

export function createNexconnSignature(
  appSecret: string,
  nonce: string,
  timestamp: string,
): string {
  return createHash('sha1')
    .update(`${appSecret}${nonce}${timestamp}`)
    .digest('hex');
}

export async function issueNexconnSession(
  supabaseUserId: string,
): Promise<NexconnSession> {
  const { nexconnAppKey, nexconnAppSecret, nexconnApiRegion } = env;
  if (!nexconnAppKey || !nexconnAppSecret || !nexconnApiRegion) {
    throw new Error('NEXCONN_NOT_CONFIGURED');
  }

  const userId = deriveNexconnUserId(supabaseUserId);
  const nonce = randomBytes(9).toString('hex');
  const timestamp = Date.now().toString();
  const endpoint = new URL(
    '/v4/auth/access-token/issue',
    `https://${regionHosts[nexconnApiRegion]}`,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        'App-Key': nexconnAppKey,
        Nonce: nonce,
        Timestamp: timestamp,
        Signature: createNexconnSignature(nexconnAppSecret, nonce, timestamp),
        'X-Request-ID': randomUUID(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, name: 'CyberSaathi member' }),
    });
    if (!response.ok) throw new Error('NEXCONN_TOKEN_REQUEST_FAILED');

    const parsed = tokenResponseSchema.safeParse(
      await readJsonLimited(response, 32_000),
    );
    if (!parsed.success || parsed.data.result.userId !== userId) {
      throw new Error('NEXCONN_TOKEN_RESPONSE_INVALID');
    }

    return {
      appKey: nexconnAppKey,
      region: nexconnApiRegion,
      userId,
      token: parsed.data.result.accessToken,
      callsEnabled: env.nexconnCallsEnabled,
    };
  } finally {
    clearTimeout(timeout);
  }
}
