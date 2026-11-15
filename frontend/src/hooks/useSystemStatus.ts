import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiRequestError,
  checkBackendHealth,
  checkSupabaseHealth,
} from '../services/api.ts';

type ServiceStatus = 'checking' | 'connected' | 'disconnected' | 'error';
export const BASE_INTERVAL_MS = 30_000;
export const MAX_BACKOFF_MS = 300_000;
export const BACKOFF_STEPS_MS = [30_000, 60_000, 120_000, 300_000];

export interface SystemStatus {
  backend: ServiceStatus;
  supabase: ServiceStatus;
  loading: boolean;
  lastSuccessfulCheckTime: Date | null;
  error: string | null;
  retry: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  return 'One or more health checks could not be completed.';
}

export function computeBackoffDelay(
  backendResult: PromiseSettledResult<unknown>,
  supabaseResult: PromiseSettledResult<unknown>,
  failureCount: number,
): number {
  let retryAfterSeconds: number | undefined;

  if (
    backendResult.status === 'rejected' &&
    backendResult.reason instanceof ApiRequestError &&
    backendResult.reason.retryAfterSeconds
  ) {
    retryAfterSeconds = backendResult.reason.retryAfterSeconds;
  }

  if (
    supabaseResult.status === 'rejected' &&
    supabaseResult.reason instanceof ApiRequestError &&
    supabaseResult.reason.retryAfterSeconds
  ) {
    retryAfterSeconds = Math.max(
      retryAfterSeconds ?? 0,
      supabaseResult.reason.retryAfterSeconds,
    );
  }

  if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
    // Wait for the full Retry-After period plus a 1-second margin, capped at MAX_BACKOFF_MS
    return Math.min(
      Math.max((retryAfterSeconds + 1) * 1000, BASE_INTERVAL_MS),
      MAX_BACKOFF_MS,
    );
  }

  // Stepped exponential backoff for consecutive errors: 30s -> 60s -> 120s -> 300s
  const stepIndex = Math.min(
    Math.max(failureCount - 1, 0),
    BACKOFF_STEPS_MS.length - 1,
  );
  return BACKOFF_STEPS_MS[stepIndex] ?? BASE_INTERVAL_MS;
}

export function useSystemStatus(): SystemStatus {
  const [backend, setBackend] = useState<ServiceStatus>('checking');
  const [supabase, setSupabase] = useState<ServiceStatus>('checking');
  const [loading, setLoading] = useState(true);
  const [lastSuccessfulCheckTime, setLastSuccessfulCheckTime] =
    useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeRequest = useRef<AbortController | null>(null);
  const consecutiveFailures = useRef<number>(0);
  const nextCheckTimeout = useRef<number | null>(null);
  const isMounted = useRef<boolean>(true);
  const lastCheckTimestamp = useRef<number>(0);
  const scheduleRef = useRef<() => void>(() => {});

  const retry = useCallback(async () => {
    if (!isMounted.current) return;
    if (activeRequest.current && !activeRequest.current.signal.aborted) {
      return;
    }

    if (nextCheckTimeout.current !== null) {
      window.clearTimeout(nextCheckTimeout.current);
      nextCheckTimeout.current = null;
    }

    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError(null);

    let nextDelay = BASE_INTERVAL_MS;

    try {
      lastCheckTimestamp.current = Date.now();
      const [backendResult, supabaseResult] = await Promise.allSettled([
        checkBackendHealth(controller.signal),
        checkSupabaseHealth(controller.signal),
      ]);

      if (controller.signal.aborted || !isMounted.current) {
        return;
      }

      const backendHealthy = backendResult.status === 'fulfilled';
      const supabaseConnected = supabaseResult.status === 'fulfilled';

      const getFailureStatus = (
        result: PromiseSettledResult<unknown>,
      ): ServiceStatus => {
        if (result.status === 'fulfilled') {
          return 'connected';
        }

        return result.reason instanceof ApiRequestError &&
          result.reason.kind === 'http'
          ? 'disconnected'
          : 'error';
      };

      setBackend(getFailureStatus(backendResult));
      setSupabase(getFailureStatus(supabaseResult));

      if (backendHealthy && supabaseConnected) {
        consecutiveFailures.current = 0;
        setError(null);
        setLastSuccessfulCheckTime(new Date());
        nextDelay = BASE_INTERVAL_MS;
      } else {
        consecutiveFailures.current += 1;
        setError(
          getErrorMessage(
            backendResult.status === 'rejected'
              ? backendResult.reason
              : supabaseResult.status === 'rejected'
                ? supabaseResult.reason
                : null,
          ),
        );
        nextDelay = computeBackoffDelay(
          backendResult,
          supabaseResult,
          consecutiveFailures.current,
        );
      }
    } finally {
      if (isMounted.current && !controller.signal.aborted) {
        setLoading(false);
      }
      if (activeRequest.current === controller) {
        activeRequest.current = null;
      }

      // Schedule the next check only if the tab is visible and component is mounted
      if (isMounted.current && !controller.signal.aborted) {
        if (typeof document === 'undefined' || !document.hidden) {
          nextCheckTimeout.current = window.setTimeout(() => {
            if (
              isMounted.current &&
              (typeof document === 'undefined' || !document.hidden)
            ) {
              scheduleRef.current();
            }
          }, nextDelay);
        }
      }
    }
  }, []);

  useEffect(() => {
    scheduleRef.current = () => {
      void retry();
    };
  }, [retry]);

  useEffect(() => {
    isMounted.current = true;

    // Initial check on mount
    void retry();

    // Listen to visibilitychange to avoid polling in the background and resume immediately on tab focus
    const handleVisibilityChange = () => {
      if (typeof document === 'undefined' || !isMounted.current) return;

      if (!document.hidden) {
        const elapsedSinceLastCheck = Date.now() - lastCheckTimestamp.current;
        // If the tab was hidden and either more than BASE_INTERVAL_MS has passed or previous check failed, check now
        if (
          elapsedSinceLastCheck >= BASE_INTERVAL_MS ||
          consecutiveFailures.current > 0
        ) {
          if (nextCheckTimeout.current !== null) {
            window.clearTimeout(nextCheckTimeout.current);
            nextCheckTimeout.current = null;
          }
          void retry();
        } else if (nextCheckTimeout.current === null) {
          // Re-arm for remaining interval
          const remaining = Math.max(0, BASE_INTERVAL_MS - elapsedSinceLastCheck);
          nextCheckTimeout.current = window.setTimeout(() => {
            if (isMounted.current && !document.hidden) {
              void retry();
            }
          }, remaining);
        }
      } else {
        // Tab became hidden: pause polling timer to conserve bandwidth and prevent background request exhaustion
        if (nextCheckTimeout.current !== null) {
          window.clearTimeout(nextCheckTimeout.current);
          nextCheckTimeout.current = null;
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      isMounted.current = false;
      if (nextCheckTimeout.current !== null) {
        window.clearTimeout(nextCheckTimeout.current);
        nextCheckTimeout.current = null;
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener(
          'visibilitychange',
          handleVisibilityChange,
        );
      }
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [retry]);

  return {
    backend,
    supabase,
    loading,
    lastSuccessfulCheckTime,
    error,
    retry: () => {
      consecutiveFailures.current = 0;
      void retry();
    },
  };
}
