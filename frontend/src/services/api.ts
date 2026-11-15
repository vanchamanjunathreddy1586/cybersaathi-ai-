import { API_BASE_URL } from './apiBaseUrl.ts';
const REQUEST_TIMEOUT_MS = 8_000;

export interface HealthResponse {
  success: true;
  message: string;
  status: 'healthy';
}

export interface SupabaseHealthResponse {
  success: true;
  service: 'supabase';
  status: 'connected';
}

type ApiRequestErrorKind =
  | 'http'
  | 'network'
  | 'timeout'
  | 'invalid_response';

export class ApiRequestError extends Error {
  readonly status: number | undefined;
  readonly kind: ApiRequestErrorKind;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    message: string,
    kind: ApiRequestErrorKind,
    status?: number,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.kind = kind;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    response.success === true &&
    response.message === 'CyberSaathi AI backend is running' &&
    response.status === 'healthy'
  );
}

function isSupabaseHealthResponse(
  value: unknown,
): value is SupabaseHealthResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    response.success === true &&
    response.service === 'supabase' &&
    response.status === 'connected'
  );
}

async function fetchJson<T>(
  path: string,
  isExpectedResponse: (value: unknown) => value is T,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  try {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) {
        throw new ApiRequestError('The API request timed out', 'timeout');
      }

      if (controller.signal.aborted) {
        throw error;
      }

      throw new ApiRequestError('The API could not be reached', 'network');
    }

    if (!response.ok) {
      let retryAfterSeconds: number | undefined;
      const retryAfterHeader = response.headers.get('Retry-After');
      if (retryAfterHeader) {
        const parsed = parseInt(retryAfterHeader, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          retryAfterSeconds = parsed;
        }
      }

      const errorMessage = response.status === 429
        ? (retryAfterSeconds
            ? `Rate limit reached. Try again in ${retryAfterSeconds} seconds.`
            : 'Rate limit reached. Please wait before retrying.')
        : `The API request failed with status ${response.status}`;

      throw new ApiRequestError(
        errorMessage,
        'http',
        response.status,
        retryAfterSeconds,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (timedOut) {
        throw new ApiRequestError('The API request timed out', 'timeout');
      }

      if (controller.signal.aborted) {
        throw error;
      }

      throw new ApiRequestError(
        'The API returned an invalid response',
        'invalid_response',
        response.status,
      );
    }

    if (!isExpectedResponse(body)) {
      throw new ApiRequestError(
        'The API response did not confirm a healthy service',
        'invalid_response',
        response.status,
      );
    }

    return body;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

export function checkBackendHealth(
  signal?: AbortSignal,
): Promise<HealthResponse> {
  return fetchJson('/api/health', isHealthResponse, signal);
}

export function checkSupabaseHealth(
  signal?: AbortSignal,
): Promise<SupabaseHealthResponse> {
  return fetchJson('/api/health/supabase', isSupabaseHealthResponse, signal);
}
