import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { app, createApp } from '../src/app.js';

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

test('health endpoints remain accessible when general API rate limit is exhausted', async () => {
  // Configure low generalLimit of 3 to exhaust it quickly, and generous healthLimit
  const testApp = createApp({ generalLimit: 3, healthLimit: 50 });
  const { baseUrl, close } = await startServer(testApp);

  try {
    // 1. Consume all 3 general API tokens on a protected endpoint
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${baseUrl}/api/scanner/history`);
      // Status will be 401 (unauthorized) or 404, but counts against generalApiLimiter
      assert.notEqual(res.status, 429, `Initial request ${i + 1} must not be rate limited`);
    }

    // 2. The 4th request to a protected endpoint must be rate-limited (HTTP 429)
    const rateLimitedRes = await fetch(`${baseUrl}/api/scanner/history`);
    assert.equal(rateLimitedRes.status, 429, 'Protected endpoint must return 429 after limit is reached');
    const rateLimitedBody = (await rateLimitedRes.json()) as { message?: string };
    assert.match(rateLimitedBody.message ?? '', /Too many requests/i);

    // 3. Health endpoints must STILL return 200 and NOT be blocked by the general limiter
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200, 'GET /api/health must succeed even when general rate limit is exhausted');
    const healthBody = (await healthRes.json()) as { status?: string };
    assert.equal(healthBody.status, 'healthy');

    // 4. Supabase health check must also NOT be blocked by the general 429 limiter
    const supabaseHealthRes = await fetch(`${baseUrl}/api/health/supabase`);
    assert.notEqual(
      supabaseHealthRes.status,
      429,
      'GET /api/health/supabase must not be blocked with 429 by general limiter',
    );
  } finally {
    await close();
  }
});

test('health endpoints enforce a dedicated rate limiter to prevent unbounded flooding', async () => {
  // Configure healthLimit of 3
  const testApp = createApp({ generalLimit: 50, healthLimit: 3, healthWindowMs: 60_000 });
  const { baseUrl, close } = await startServer(testApp);

  try {
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.equal(res.status, 200, `Health request ${i + 1} must succeed`);
    }

    // 4th health check request must return 429 from healthLimiter
    const healthLimitedRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthLimitedRes.status, 429, 'Excessive health check requests must return 429');
    const body = (await healthLimitedRes.json()) as { message?: string };
    assert.match(body.message ?? '', /Health check request limit exceeded/i);
  } finally {
    await close();
  }
});

test('production app instance uses independent health limiter policy and isolates health endpoints', async () => {
  const { baseUrl, close } = await startServer(app);

  try {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);

    const healthPolicy = healthRes.headers.get('ratelimit-policy');
    assert.ok(healthPolicy, 'Health endpoint must include RateLimit-Policy header');
    assert.match(healthPolicy, /"120-in-1min"/i, 'Health check policy must reflect dedicated 120-in-1min limiter');

    // Verify protected endpoint has the standard 100-in-15m policy
    const apiRes = await fetch(`${baseUrl}/api/scanner/history`);
    const apiPolicy = apiRes.headers.get('ratelimit-policy');
    assert.ok(apiPolicy, 'Protected endpoint must include RateLimit-Policy header');
    assert.match(apiPolicy, /"100-in-15min"/i, 'General API policy must reflect standard 100-in-15min limiter');
  } finally {
    await close();
  }
});
