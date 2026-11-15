import { z } from 'zod';
import { env } from '../../config/env.js';
import { readJsonLimited } from '../../utils/readJsonLimited.js';
import { geminiCircuitBreaker, geminiQuota } from '../resilience/resilience.service.js';

const completionResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string().max(20_000) }),
  })).min(1),
}).passthrough();

export type AiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AiCompletionFailure =
  | 'not_configured'
  | 'provider_error'
  | 'invalid_response'
  | 'unreachable';

export type AiCompletionResult =
  | { status: 'available'; content: string }
  | { status: 'unavailable'; reason: AiCompletionFailure };

function getChatCompletionsEndpoint(baseUrl: string): URL {
  const endpoint = new URL(baseUrl);
  const path = endpoint.pathname.replace(/\/+$/, '');
  if (path.endsWith('/chat/completions')) return endpoint;
  endpoint.pathname = path.endsWith('/openai') || path.endsWith('/v1')
    ? `${path}/chat/completions`
    : '/v1/chat/completions';
  return endpoint;
}

export async function requestAiChatCompletion(
  messages: AiChatMessage[],
  options: { jsonResponse?: boolean; timeoutMs?: number } = {},
): Promise<AiCompletionResult> {
  if (!env.aiApiBaseUrl || !env.aiApiKey || !env.aiModel) {
    return { status: 'unavailable', reason: 'not_configured' };
  }

  if (!geminiQuota.tryAcquire()) {
    return { status: 'unavailable', reason: 'provider_error' };
  }

  const endpoint = getChatCompletionsEndpoint(env.aiApiBaseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);

  try {
    return await geminiCircuitBreaker.execute(async () => {
      const response = await fetch(endpoint, {
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.aiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: env.aiModel,
          ...(options.jsonResponse ? { response_format: { type: 'json_object' } } : {}),
          messages,
        }),
      });

      if (!response.ok) return { status: 'unavailable', reason: 'provider_error' };

      const envelope = completionResponseSchema.safeParse(
        await readJsonLimited(response, 256_000),
      );
      const content = envelope.success ? envelope.data.choices[0]?.message.content.trim() : undefined;
      if (!content) return { status: 'unavailable', reason: 'invalid_response' };
      return { status: 'available', content };
    });
  } catch {
    return {
      status: 'unavailable',
      reason: 'unreachable',
    };
  } finally {
    clearTimeout(timeout);
  }
}

