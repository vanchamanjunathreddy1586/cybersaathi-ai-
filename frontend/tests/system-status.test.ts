import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeBackoffDelay,
  MAX_BACKOFF_MS,
  BACKOFF_STEPS_MS,
} from '../src/hooks/useSystemStatus.ts';
import { ApiRequestError } from '../src/services/api.ts';

test('ApiRequestError captures status, kind, and retryAfterSeconds', () => {
  const err = new ApiRequestError(
    'Rate limit reached. Try again in 60 seconds.',
    'http',
    429,
    60,
  );
  assert.equal(err.status, 429);
  assert.equal(err.kind, 'http');
  assert.equal(err.retryAfterSeconds, 60);
  assert.equal(err.message, 'Rate limit reached. Try again in 60 seconds.');
});

test('computeBackoffDelay respects 429 Retry-After header with buffer', () => {
  const rejectedWith429: PromiseSettledResult<unknown> = {
    status: 'rejected',
    reason: new ApiRequestError('Rate limited', 'http', 429, 45),
  };
  const fulfilled: PromiseSettledResult<unknown> = {
    status: 'fulfilled',
    value: { success: true },
  };

  const delay = computeBackoffDelay(rejectedWith429, fulfilled, 1);
  // 45 seconds + 1s buffer = 46,000ms
  assert.equal(delay, 46_000);
});

test('computeBackoffDelay caps excessively long Retry-After at MAX_BACKOFF_MS', () => {
  const rejectedWithLongWait: PromiseSettledResult<unknown> = {
    status: 'rejected',
    reason: new ApiRequestError('Rate limited', 'http', 429, 337),
  };
  const fulfilled: PromiseSettledResult<unknown> = {
    status: 'fulfilled',
    value: { success: true },
  };

  const delay = computeBackoffDelay(rejectedWithLongWait, fulfilled, 1);
  assert.equal(delay, MAX_BACKOFF_MS, 'Excessive Retry-After must be capped at 5 minutes');
});

test('computeBackoffDelay enforces stepped exponential backoff on consecutive failures', () => {
  const rejectedNetwork: PromiseSettledResult<unknown> = {
    status: 'rejected',
    reason: new ApiRequestError('Network error', 'network'),
  };
  const fulfilled: PromiseSettledResult<unknown> = {
    status: 'fulfilled',
    value: { success: true },
  };

  // 1st failure: 30s
  assert.equal(computeBackoffDelay(rejectedNetwork, fulfilled, 1), BACKOFF_STEPS_MS[0]);
  // 2nd failure: 60s
  assert.equal(computeBackoffDelay(rejectedNetwork, fulfilled, 2), BACKOFF_STEPS_MS[1]);
  // 3rd failure: 120s
  assert.equal(computeBackoffDelay(rejectedNetwork, fulfilled, 3), BACKOFF_STEPS_MS[2]);
  // 4th+ failure: 300s (max)
  assert.equal(computeBackoffDelay(rejectedNetwork, fulfilled, 4), BACKOFF_STEPS_MS[3]);
  assert.equal(computeBackoffDelay(rejectedNetwork, fulfilled, 10), MAX_BACKOFF_MS);
});
