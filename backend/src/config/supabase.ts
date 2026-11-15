import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

export type SupabaseDiagnosticCategory =
  | 'missing_environment'
  | 'invalid_configuration'
  | 'unauthorized'
  | 'forbidden'
  | 'missing_table'
  | 'network_error'
  | 'timeout'
  | 'unknown';

export class SupabaseConfigurationError extends Error {
  constructor(
    readonly category: 'missing_environment' | 'invalid_configuration',
    readonly missingVariables: string[] = [],
  ) {
    super(`Missing Supabase environment variables: ${missingVariables.join(', ')}`);
    this.name = 'SupabaseConfigurationError';
  }
}

function getSupabaseConfiguration(): {
  url: string;
  publishableKey: string;
} {
  const url = env.supabaseUrl;
  const publishableKey = env.supabasePublishableKey;
  const missingVariables = [
    ...(url?.trim() ? [] : ['SUPABASE_URL']),
    ...(publishableKey?.trim() ? [] : ['SUPABASE_PUBLISHABLE_KEY']),
  ];

  if (missingVariables.length > 0) {
    throw new SupabaseConfigurationError('missing_environment', missingVariables);
  }

  if (!url || !publishableKey) {
    throw new SupabaseConfigurationError('missing_environment', missingVariables);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new SupabaseConfigurationError('invalid_configuration');
  }

  if (
    parsedUrl.protocol !== 'https:' ||
    !parsedUrl.hostname ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new SupabaseConfigurationError('invalid_configuration');
  }

  return { url: parsedUrl.origin, publishableKey };
}

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const { url, publishableKey } = getSupabaseConfiguration();
    client = createClient(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return client;
}

export function getUserSupabaseClient(accessToken: string): SupabaseClient {
  const { url, publishableKey } = getSupabaseConfiguration();
  return createClient(url, publishableKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export type SupabaseConnectivityResult =
  | { connected: true }
  | {
      connected: false;
      category: SupabaseDiagnosticCategory;
      httpStatus?: number;
      errorCode: string;
    };

function getSafeErrorCode(code: string): string {
  return /^[A-Z0-9_-]{1,32}$/i.test(code) ? code : 'UNKNOWN';
}

function getErrorCategory(
  status: number,
  errorCode: string,
): SupabaseDiagnosticCategory {
  if (errorCode === 'PGRST205' || errorCode === '42P01') {
    return 'missing_table';
  }

  if (status === 401) {
    return 'unauthorized';
  }

  if (status === 403 || errorCode === '42501') {
    return 'forbidden';
  }

  return 'unknown';
}

function queryHealthCheck() {
  return getSupabaseClient()
    .from('health_check')
    .select('id')
    .eq('id', 1)
    .single();
}

export async function verifySupabaseConnectivity(): Promise<SupabaseConnectivityResult> {
  getSupabaseConfiguration();

  let result: Awaited<ReturnType<typeof queryHealthCheck>>;
  try {
    result = await queryHealthCheck();
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    const category: SupabaseDiagnosticCategory =
      name === 'AbortError' || name === 'TimeoutError'
        ? 'timeout'
        : name === 'TypeError'
          ? 'network_error'
          : 'unknown';

    return { connected: false, category, errorCode: 'NO_HTTP_RESPONSE' };
  }

  if (result.error) {
    const errorCode = getSafeErrorCode(result.error.code);
    return {
      connected: false,
      category: getErrorCategory(result.status, errorCode),
      ...(Number.isInteger(result.status) && result.status >= 100 && result.status <= 599
        ? { httpStatus: result.status }
        : {}),
      errorCode,
    };
  }

  if (result.data?.id !== 1) {
    return {
      connected: false,
      category: 'unknown',
      ...(Number.isInteger(result.status) && result.status >= 100 && result.status <= 599
        ? { httpStatus: result.status }
        : {}),
      errorCode: 'HEALTH_ROW_NOT_FOUND',
    };
  }

  return { connected: true };
}
