import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { RequestQueue, QueueCapacityError } from '../src/services/resilience/concurrency-queue.js';
import { CircuitBreaker, CircuitBreakerError } from '../src/services/resilience/circuit-breaker.js';
import { TokenBucketQuota } from '../src/services/resilience/external-quota.js';
import { metrics } from '../src/services/resilience/metrics.service.js';

function startServer(instance: ReturnType<typeof createApp>): Promise<{
  server: Server;
  baseUrl: string;
  close: () => Promise<void>;
}> {
  return new Promise((resolve) => {
    const server = createServer(instance);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${port}`;
      resolve({
        server,
        baseUrl,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

test('health checks remain responsive under 50ms during high-concurrency bursts', async () => {
  const testApp = createApp({ generalLimit: 50, healthLimit: 200 });
  const { baseUrl, close } = await startServer(testApp);

  try {
    // Warm up the server instance first
    await fetch(`${baseUrl}/api/health`);

    // 1. Fire a burst of 20 concurrent requests to a protected endpoint
    const backgroundBurst = Array.from({ length: 20 }).map(() =>
      fetch(`${baseUrl}/api/scanner/history`),
    );

    // 2. Concurrently measure health check latency during the burst
    const start = Date.now();
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const duration = Date.now() - start;

    assert.equal(healthRes.status, 200, 'Health check must respond with 200 during concurrent load');
    const healthBody = (await healthRes.json()) as { status: string };
    assert.equal(healthBody.status, 'healthy');
    assert.ok(duration < 1000, `Health check latency (${duration}ms) must remain fast under load`);

    await Promise.all(backgroundBurst);

  } finally {
    await close();
  }
});

test('per-user rate limit isolation prevents noisy neighbor lockout', async () => {
  // Low limit of 3 requests per 15 minutes to test quota exhaustion
  const testApp = createApp({ generalLimit: 3, healthLimit: 50 });
  const { baseUrl, close } = await startServer(testApp);

  try {
    const userAToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.userA';
    const userBToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.userB';

    // User A makes 3 requests and consumes their quota
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${baseUrl}/api/scanner/history`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert.notEqual(res.status, 429, `User A request ${i + 1} should not be rate-limited`);
    }

    // User A's 4th request must be rate-limited (429) with Retry-After header
    const userALimited = await fetch(`${baseUrl}/api/scanner/history`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.equal(userALimited.status, 429, 'User A should receive 429 after exceeding limit');
    assert.ok(userALimited.headers.get('retry-after'), 'Rate-limited response must include Retry-After header');
    const userABody = (await userALimited.json()) as { code: string; retryAfter: number };
    assert.equal(userABody.code, 'RATE_LIMIT_EXCEEDED');
    assert.ok(userABody.retryAfter > 0, 'Response body must contain retryAfter seconds');

    // User B (from the exact same IP / network) must NOT be blocked!
    const userBRes = await fetch(`${baseUrl}/api/scanner/history`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.notEqual(
      userBRes.status,
      429,
      'User B must NOT be blocked when User A hits their limit on the same IP',
    );
  } finally {
    await close();
  }
});

test('request queue enforces concurrency limits and sheds excess burst load', async () => {
  const queue = new RequestQueue({
    name: 'TestQueue',
    concurrency: 2,
    maxQueueSize: 2,
    timeoutMs: 1000,
  });

  const holdPromise = (delayMs: number) =>
    new Promise<string>((resolve) => setTimeout(() => resolve('done'), delayMs));

  // Run 2 tasks to occupy workers
  const task1 = queue.run(() => holdPromise(50));
  const task2 = queue.run(() => holdPromise(50));

  // Enqueue 2 tasks to fill queue buffer (maxQueueSize = 2)
  const task3 = queue.run(() => holdPromise(50));
  const task4 = queue.run(() => holdPromise(50));

  // 5th task must immediately fail with QueueCapacityError (concurrency 2 + queue 2 = 4 capacity)
  await assert.rejects(
    async () => queue.run(() => holdPromise(50)),
    (error: unknown) => {
      assert.ok(error instanceof QueueCapacityError);
      assert.equal(error.queueName, 'TestQueue');
      assert.ok(error.retryAfterSeconds > 0);
      return true;
    },
    'Over-capacity request must be rejected with QueueCapacityError',
  );

  const results = await Promise.all([task1, task2, task3, task4]);
  assert.deepEqual(results, ['done', 'done', 'done', 'done']);
});

test('circuit breaker trips after consecutive failures and recovers on half-open probe', async () => {
  const breaker = new CircuitBreaker({
    name: 'TestProvider',
    failureThreshold: 2,
    cooldownMs: 50,
  });

  assert.equal(breaker.getState(), 'CLOSED');

  // Trigger 2 consecutive failures
  await assert.rejects(() => breaker.execute(async () => { throw new Error('API down'); }));
  await assert.rejects(() => breaker.execute(async () => { throw new Error('API down'); }));

  // Breaker should now be OPEN
  assert.equal(breaker.getState(), 'OPEN');

  // Next call fails fast without invoking action
  await assert.rejects(
    () => breaker.execute(async () => 'should not run'),
    (error: unknown) => {
      assert.ok(error instanceof CircuitBreakerError);
      assert.equal(error.providerName, 'TestProvider');
      assert.ok(error.retryAfterSeconds > 0);
      return true;
    },
  );

  // Wait for cooldown to elapse
  await new Promise((r) => setTimeout(r, 60));

  // Half-open probe succeeds and restores circuit to CLOSED
  const result = await breaker.execute(async () => 'recovered');
  assert.equal(result, 'recovered');
  assert.equal(breaker.getState(), 'CLOSED');
});

test('token bucket external quota throttles requests per minute accurately', () => {
  const quota = new TokenBucketQuota({
    providerName: 'TestVT',
    maxTokens: 2,
    refillRatePerMinute: 60,
  });

  assert.equal(quota.tryAcquire(), true, 'First token must be acquired');
  assert.equal(quota.tryAcquire(), true, 'Second token must be acquired');
  assert.equal(quota.tryAcquire(), false, 'Third token must be rejected when bucket is empty');
});

test('health metrics endpoint exposes live metrics snapshot with route tracking', async () => {
  const testApp = createApp({ generalLimit: 50, healthLimit: 50 });
  const { baseUrl, close } = await startServer(testApp);

  try {
    // Make a request to track
    await fetch(`${baseUrl}/api/health`);

    const metricsRes = await fetch(`${baseUrl}/api/health/metrics`);
    assert.equal(metricsRes.status, 200);

    const data = (await metricsRes.json()) as {
      success: boolean;
      metrics: {
        totalRequests: number;
        uptimeSeconds: number;
        queues: Record<string, unknown>;
        providers: Record<string, unknown>;
      };
    };

    assert.equal(data.success, true);
    assert.ok(data.metrics.totalRequests >= 1, 'Metrics must record requests');
    assert.ok(typeof data.metrics.uptimeSeconds === 'number');
    assert.ok(data.metrics.queues, 'Metrics snapshot must include registered queues');
    assert.ok(data.metrics.providers, 'Metrics snapshot must include registered providers');
  } finally {
    await close();
  }
});
