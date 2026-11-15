import test from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';
import { getSocOverview } from '../src/services/security-center/soc-overview.service.js';

test('getSocOverview returns provider health, telemetry, and queue metrics', async () => {
  const soc = await getSocOverview();

  assert.ok(soc.timestamp, 'Must include timestamp');
  assert.ok(['HEALTHY', 'DEGRADED', 'ATTENTION_REQUIRED'].includes(soc.overallStatus));

  assert.ok(Array.isArray(soc.providers), 'Must return provider list');
  assert.ok(soc.providers.some((p) => p.id === 'supabase_db'), 'Must track Supabase DB');
  assert.ok(soc.providers.some((p) => p.id === 'google_safe_browsing'), 'Must track Google Safe Browsing');
  assert.ok(soc.providers.some((p) => p.id === 'virustotal'), 'Must track VirusTotal');
  assert.ok(soc.providers.some((p) => p.id === 'web_push'), 'Must track Web Push');
  assert.ok(soc.providers.some((p) => p.id === 'gemini_ai'), 'Must track Gemini AI');

  assert.ok(Array.isArray(soc.threatTelemetry), 'Must return India threat telemetry');
  assert.ok(soc.threatTelemetry.length >= 4, 'Must track at least 4 active Indian scam vectors');
  assert.ok(soc.threatTelemetry.some((t) => t.id === 'digital_arrest'), 'Must track Digital Arrest threat');
  assert.ok(soc.threatTelemetry.some((t) => t.id === 'fedex_narcotics'), 'Must track FedEx Narcotics threat');
  assert.ok(soc.threatTelemetry.some((t) => t.id === 'upi_qr_reverse'), 'Must track UPI reverse scam');

  assert.ok(soc.systemMetrics, 'Must provide system resilience metrics');
  assert.ok(Array.isArray(soc.systemMetrics.activeQueues), 'Must list active queues');
});

test('Safety score & SOC HTTP endpoints require authentication', async () => {
  const app = createApp();
  let server: Server;
  let baseUrl: string;

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });

  try {
    const unauthScore = await fetch(`${baseUrl!}/api/security-center/safety-score`);
    assert.equal(unauthScore.status, 401);
    const scoreBody = (await unauthScore.json()) as { success: boolean; message: string };
    assert.equal(scoreBody.success, false);
    assert.ok(scoreBody.message.includes('Authentication required'));

    const unauthSoc = await fetch(`${baseUrl!}/api/security-center/soc-overview`);
    assert.equal(unauthSoc.status, 401);
    const socBody = (await unauthSoc.json()) as { success: boolean; message: string };
    assert.equal(socBody.success, false);
    assert.ok(socBody.message.includes('Authentication required'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
