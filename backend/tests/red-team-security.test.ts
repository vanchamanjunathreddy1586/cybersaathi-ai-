import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import express, { type Request, type Response, type NextFunction } from 'express';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';
import {
  validateApkArchive,
  ArchiveSecurityError,
} from '../src/services/app-scanner/safe-archive.validator.js';
import {
  familySafetyJoinLimiter,
  familySafetyAlertLimiter,
} from '../src/services/rate-limiting/rate-limiter.service.js';
import { familySafetyRouter } from '../src/routes/family-safety.routes.js';
import { scannerAuth } from '../src/middleware/scannerAuth.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

// CRC-32 helper for constructing synthetic test archives in memory
function crc32(buf: Buffer): number {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]!;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
    }
  }
  return (~crc) >>> 0;
}

function createZipBuffer(entries: Array<{ name: string; content: Buffer | string }>): Buffer {
  const parts: Buffer[] = [];
  const cdEntries: Buffer[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const dataBuf = Buffer.isBuffer(e.content) ? e.content : Buffer.from(e.content, 'utf8');
    const crc = crc32(dataBuf);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(0, 8); // stored
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(dataBuf.length, 18);
    lh.writeUInt32LE(dataBuf.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    parts.push(lh, nameBuf, dataBuf);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(dataBuf.length, 20);
    cd.writeUInt32LE(dataBuf.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    cdEntries.push(cd, nameBuf);
    offset += 30 + nameBuf.length + dataBuf.length;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const b of cdEntries) cdSize += b.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, ...cdEntries, eocd]);
}

test('Security Audit: Call scanner rejects extraneous payload fields via strict schema', async () => {
  const app = createApp();
  let server: Server;
  let baseUrl: string;

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });

  try {
    const res = await fetch(`${baseUrl!}/api/call-scanner/analyze-transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: 'This is a genuine inquiry about fraud protection.',
        maliciousInjectedField: '<script>alert(1)</script>',
        adminBypass: true,
      }),
    });

    assert.equal(res.status, 400, 'Payload with unknown fields must be rejected with 400');
    const body = (await res.json()) as { code: string; message: string };
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.ok(body.message.includes('Unrecognized keys'), 'Must specify unrecognized keys');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Security Audit: Archive validator rejects ZipSlip path traversal and malicious archives', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cs-sec-test-'));

  try {
    // 1. Path traversal archive
    const traversalZip = createZipBuffer([
      { name: '../../etc/shadow', content: 'root:x:0:0:root:/root:/bin/bash' },
      { name: 'AndroidManifest.xml', content: '<manifest></manifest>' },
    ]);
    const traversalPath = path.join(tmpDir, 'traversal.apk');
    await fs.writeFile(traversalPath, traversalZip);

    await assert.rejects(
      async () => validateApkArchive(traversalPath),
      (err: unknown) => {
        assert.ok(err instanceof ArchiveSecurityError);
        assert.equal(err.code, 'PATH_TRAVERSAL_DETECTED');
        return true;
      },
      'Must reject archive with directory traversal entries',
    );

    // 2. Archive without AndroidManifest.xml
    const noManifestZip = createZipBuffer([
      { name: 'classes.dex', content: 'dummy dex content' },
    ]);
    const noManifestPath = path.join(tmpDir, 'nomanifest.apk');
    await fs.writeFile(noManifestPath, noManifestZip);

    await assert.rejects(
      async () => validateApkArchive(noManifestPath),
      (err: unknown) => {
        assert.ok(err instanceof ArchiveSecurityError);
        assert.equal(err.code, 'MISSING_MANIFEST');
        return true;
      },
      'Must reject archive missing AndroidManifest.xml',
    );

    // 3. Corrupt header (not PK\x03\x04)
    const fakeHeaderPath = path.join(tmpDir, 'fake.apk');
    await fs.writeFile(fakeHeaderPath, Buffer.from('NOT_A_ZIP_HEADER_TOO_SHORT_OR_MALFORMED'));

    await assert.rejects(
      async () => validateApkArchive(fakeHeaderPath),
      (err: unknown) => {
        assert.ok(err instanceof ArchiveSecurityError);
        assert.equal(err.code, 'INVALID_ZIP_HEADER');
        return true;
      },
      'Must reject file with invalid magic bytes',
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('Security Audit: Family safety rate limiters enforce throttling on sensitive actions', async () => {
  const app = express();
  app.use(express.json());

  app.post('/test/join', familySafetyJoinLimiter, (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/test/alert', familySafetyAlertLimiter, (_req, res) => {
    res.json({ ok: true });
  });

  let server: Server;
  let baseUrl: string;

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });

  try {
    // 1. Join limiter triggers at 10 requests / min
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${baseUrl!}/test/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      assert.equal(res.status, 200);
    }

    const limitedJoin = await fetch(`${baseUrl!}/test/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(limitedJoin.status, 429);
    assert.ok(limitedJoin.headers.get('retry-after'));
    const joinBody = (await limitedJoin.json()) as { code: string };
    assert.equal(joinBody.code, 'JOIN_RATE_LIMIT_EXCEEDED');

    // 2. Alert limiter triggers at 6 requests / min
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`${baseUrl!}/test/alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      assert.equal(res.status, 200);
    }

    const limitedAlert = await fetch(`${baseUrl!}/test/alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(limitedAlert.status, 429);
    assert.ok(limitedAlert.headers.get('retry-after'));
    const alertBody = (await limitedAlert.json()) as { code: string };
    assert.equal(alertBody.code, 'ALERT_BROADCAST_LIMIT_EXCEEDED');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Security Audit: Family safety endpoints reject invalid non-UUID route parameters with 400', async () => {
  const app = express();
  app.use(express.json());

  // Mount with mock authentication context injected
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.locals.scannerAuth = {
      accessToken: 'test-token',
      userId: '11111111-1111-4111-a111-111111111111',
    };
    next();
  });
  app.use('/api/family-safety', familySafetyRouter);

  let server: Server;
  let baseUrl: string;

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });

  try {
    const maliciousIds = [
      'not-a-uuid',
      "' OR 1=1 --",
      '../path-traversal',
      '12345',
    ];

    for (const id of maliciousIds) {
      // 1. GET /circles/:id
      const resGet = await fetch(`${baseUrl!}/api/family-safety/circles/${encodeURIComponent(id)}`, {
        headers: { Authorization: 'Bearer valid-format-token' },
      });
      assert.equal(resGet.status, 400, `GET /circles/${id} must return 400`);
      const bodyGet = (await resGet.json()) as { success: boolean; message: string };
      assert.equal(bodyGet.success, false);
      assert.equal(bodyGet.message, 'Invalid family circle ID format.');

      // 2. POST /circles/:id/alerts
      const resPost = await fetch(`${baseUrl!}/api/family-safety/circles/${encodeURIComponent(id)}/alerts`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-format-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threatType: 'phishing',
          severity: 'high',
          summary: 'Scam call detected',
          advice: 'Do not send OTP',
        }),
      });
      assert.equal(resPost.status, 400, `POST /circles/${id}/alerts must return 400`);
      const bodyPost = (await resPost.json()) as { success: boolean; message: string };
      assert.equal(bodyPost.success, false);
      assert.equal(bodyPost.message, 'Invalid family circle ID format.');

      // 3. DELETE /circles/:id/leave
      const resDelete = await fetch(`${baseUrl!}/api/family-safety/circles/${encodeURIComponent(id)}/leave`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer valid-format-token' },
      });
      assert.equal(resDelete.status, 400, `DELETE /circles/${id}/leave must return 400`);
      const bodyDelete = (await resDelete.json()) as { success: boolean; message: string };
      assert.equal(bodyDelete.success, false);
      assert.equal(bodyDelete.message, 'Invalid family circle ID format.');
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Security Audit: RLS migration script specifies hardened SECURITY DEFINER search_path', async () => {
  const migrationPath = path.resolve('supabase/migrations/20261116000000_harden_family_safety_rls.sql');
  const sql = await fs.readFile(migrationPath, 'utf8');

  assert.ok(
    sql.includes("SET search_path = ''"),
    'Migration must specify SET search_path = \'\' on SECURITY DEFINER functions to prevent search path hijacking',
  );
  assert.ok(
    sql.includes('DROP POLICY IF EXISTS "Users can join circles with valid member row"'),
    'Migration must drop vulnerable membership insertion policy',
  );
  assert.ok(
    sql.includes('CREATE POLICY "Circle owners can add members directly"'),
    'Migration must restrict direct membership insertion to circle owners',
  );
  assert.ok(
    sql.includes('CREATE OR REPLACE FUNCTION public.join_family_circle_with_invite'),
    'Migration must introduce secure invite verification RPC',
  );
});

test('Security Audit: Production authentication rejects test-only authentication contexts', async () => {
  const originalEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';

    const req = {
      header: (_name: string) => undefined,
    } as unknown as Request;

    let nextCalled = false;
    let statusCode = 200;
    let jsonResponse: unknown = null;

    const res = {
      locals: {
        scannerAuth: {
          accessToken: 'spoofed-test-token',
          userId: '11111111-1111-4111-a111-111111111111',
        },
      },
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: unknown) {
        jsonResponse = data;
        return this;
      },
    } as unknown as Response;

    await scannerAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false, 'scannerAuth must NOT call next() in production when auth header is missing');
    assert.equal(statusCode, 401, 'scannerAuth must return 401');
    assert.equal(res.locals.scannerAuth, undefined, 'Pre-existing scannerAuth locals must be purged in production');
    assert.deepEqual(jsonResponse, { success: false, message: 'Authentication required.' });
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test('Security Audit: API error handler masks internal stack traces and secrets in production', async () => {
  const originalEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';

    const sensitiveError = new Error('Database connection failed: postgres://admin:super_secret_password@db.internal:5432/main');
    sensitiveError.stack = 'Error: Database connection failed\n    at internalQuery (c:/app/src/db.ts:42:15)';

    let statusCode = 200;
    let jsonResponse: any = null;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: unknown) {
        jsonResponse = data;
        return this;
      },
    } as unknown as Response;

    errorHandler(sensitiveError, {} as Request, res, () => {});

    assert.equal(statusCode, 500);
    assert.equal(jsonResponse.success, false);
    assert.equal(jsonResponse.message, 'Internal server error', 'Must mask internal message');
    assert.equal(jsonResponse.stack, undefined, 'Must never leak stack trace');
    assert.equal(JSON.stringify(jsonResponse).includes('super_secret_password'), false, 'Must never leak secrets');
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test('Security Audit: Family safety join route rejects invalid and malformed invite code formats with 400', async () => {
  const app = createApp();
  let server: Server;
  let baseUrl: string;

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });

  try {
    // 1. Unauthenticated join attempt must be rejected with 401
    const resUnauth = await fetch(`${baseUrl!}/api/family-safety/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: 'CS-ABC123' }),
    });
    assert.equal(resUnauth.status, 401);

    // 2. Authenticated test harness: verify validation of malformed codes (too short, too long)
    const testApp = express();
    testApp.use(express.json());
    testApp.use((_req, res, next) => {
      res.locals.scannerAuth = {
        accessToken: 'valid-test-token',
        userId: '11111111-1111-4111-a111-111111111111',
      };
      next();
    });
    testApp.use('/api/family-safety', familySafetyRouter);

    let testServer: Server;
    let testBaseUrl: string;
    await new Promise<void>((resolve) => {
      testServer = testApp.listen(0, '127.0.0.1', () => {
        const addr = testServer.address();
        if (addr && typeof addr === 'object') {
          testBaseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });

    try {
      const invalidCodes = ['', 'CS', 'A', '12345', 'EXCEEDINGLY_LONG_CODE_THAT_EXCEEDS_16_CHARS'];
      for (const code of invalidCodes) {
        const res = await fetch(`${testBaseUrl!}/api/family-safety/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteCode: code }),
        });
        assert.equal(res.status, 400, `Invite code "${code}" must return 400`);
        const body = (await res.json()) as { success: boolean; message: string };
        assert.equal(body.success, false);
        assert.equal(body.message, 'Provide a valid 6–16 character invite code.');
      }
    } finally {
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Security Audit: Database migrations enforce tenant isolation and RLS across private user tables', async () => {
  const migrationsDir = path.resolve('supabase/migrations');
  const files = await fs.readdir(migrationsDir);

  const scanResultsMigration = await fs.readFile(
    path.join(migrationsDir, files.find((f) => f.includes('create_scan_results'))!),
    'utf8',
  );
  assert.ok(
    scanResultsMigration.includes('auth.uid()'),
    'scan_results migration must enforce auth.uid() check',
  );

  const investigationsMigration = await fs.readFile(
    path.join(migrationsDir, files.find((f) => f.includes('create_investigations'))!),
    'utf8',
  );
  assert.ok(
    investigationsMigration.includes('auth.uid()'),
    'investigations migration must enforce auth.uid() check',
  );

  const familySafetyMigration = await fs.readFile(
    path.join(migrationsDir, files.find((f) => f.includes('create_family_safety'))!),
    'utf8',
  );
  assert.ok(
    familySafetyMigration.includes('is_circle_member(id)') && familySafetyMigration.includes('owner_user_id'),
    'family_circles must restrict viewing to owner or verified members',
  );
});

test('Security Audit: Member profile update endpoint rejects role escalation, circle transfer, and user transfer', async () => {
  const app = express();
  app.use(express.json());

  // Mount with mock authentication context injected
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.locals.scannerAuth = {
      accessToken: 'test-token',
      userId: '11111111-1111-4111-a111-111111111111',
    };
    next();
  });
  app.use('/api/family-safety', familySafetyRouter);

  let server: Server;
  let baseUrl: string;

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });

  try {
    const validCircleId = '11111111-1111-4111-a111-111111111111';

    // 1. Attempt role escalation: member -> guardian must fail with 400 VALIDATION_ERROR
    const resEscalate = await fetch(`${baseUrl!}/api/family-safety/circles/${validCircleId}/members/me`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'guardian' }),
    });
    assert.equal(resEscalate.status, 400, 'Attempt to modify role must return 400');
    const bodyEscalate = (await resEscalate.json()) as { code: string; message: string };
    assert.equal(bodyEscalate.code, 'VALIDATION_ERROR');
    assert.ok(
      bodyEscalate.message.includes('Unrecognized key') || bodyEscalate.message.includes('role'),
      'Must reject unauthorized role key',
    );

    // 2. Attempt circle transfer: changing circle_id must fail with 400 VALIDATION_ERROR
    const resCircleTransfer = await fetch(`${baseUrl!}/api/family-safety/circles/${validCircleId}/members/me`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ circle_id: '22222222-2222-4222-a222-222222222222' }),
    });
    assert.equal(resCircleTransfer.status, 400);
    const bodyCircleTransfer = (await resCircleTransfer.json()) as { code: string; message: string };
    assert.equal(bodyCircleTransfer.code, 'VALIDATION_ERROR');

    // 3. Attempt user transfer: changing user_id must fail with 400 VALIDATION_ERROR
    const resUserTransfer = await fetch(`${baseUrl!}/api/family-safety/circles/${validCircleId}/members/me`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: '33333333-3333-4333-a333-333333333333' }),
    });
    assert.equal(resUserTransfer.status, 400);
    const bodyUserTransfer = (await resUserTransfer.json()) as { code: string; message: string };
    assert.equal(bodyUserTransfer.code, 'VALIDATION_ERROR');

    // 4. Blank display name must fail validation
    const resBlankName = await fetch(`${baseUrl!}/api/family-safety/circles/${validCircleId}/members/me`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ displayName: '' }),
    });
    assert.equal(resBlankName.status, 400);

    // 5. Excessively long display name (> 64 chars) must fail validation
    const resLongName = await fetch(`${baseUrl!}/api/family-safety/circles/${validCircleId}/members/me`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ displayName: 'A'.repeat(65) }),
    });
    assert.equal(resLongName.status, 400);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Security Audit: Final SQL migration enforces column-level UPDATE privileges and owner role=member restriction', async () => {
  const migrationPath = path.resolve('../CYBERSAATHI_FAMILY_SAFETY_FINAL_MIGRATION.sql');
  const sql = await fs.readFile(migrationPath, 'utf8');

  // CRITICAL FIX 1 & BLOCKER 2: Column-level UPDATE privilege verification and non-recursive policy
  assert.ok(
    sql.includes('REVOKE UPDATE ON public.family_circle_members FROM PUBLIC, anon, authenticated;'),
    'Migration must revoke table-level UPDATE on family_circle_members',
  );
  assert.ok(
    sql.includes('GRANT UPDATE (display_name) ON public.family_circle_members TO authenticated;'),
    'Migration must grant UPDATE exclusively on display_name column',
  );
  assert.ok(
    sql.includes('CREATE POLICY "family_circle_members_update_policy"'),
    'Migration must establish non-recursive self-row update policy',
  );
  assert.equal(
    sql.includes('SELECT m.role FROM public.family_circle_members m'),
    false,
    'Update policy must not contain recursive self-referencing subquery',
  );

  // CRITICAL FIX 2: Owner direct INSERT restriction
  assert.ok(
    sql.includes("role = 'member'"),
    'Owner direct INSERT policy must enforce role = member to prevent privilege escalation',
  );
  assert.ok(
    sql.includes('tr_family_circles_add_guardian'),
    'Automatic guardian trigger must be registered on family_circles',
  );

  // BLOCKER 1: Migration execution order - column addition precedes data validation
  const addColumnsPos = sql.indexOf('Step 3A: Add missing required columns');
  const validateDataPos = sql.indexOf('Step 3B: Validate existing data');
  const addConstraintsPos = sql.indexOf('Step 3C: Add constraints only after validation');
  assert.ok(addColumnsPos > 0, 'Step 3A must be defined');
  assert.ok(validateDataPos > 0, 'Step 3B must be defined');
  assert.ok(addConstraintsPos > 0, 'Step 3C must be defined');
  assert.ok(addColumnsPos < validateDataPos, 'Adding columns (3A) must execute before validating data (3B)');
  assert.ok(validateDataPos < addConstraintsPos, 'Validating data (3B) must execute before adding constraints (3C)');

  // BLOCKER 3: Dynamic audit and purge of existing/legacy RLS policies
  assert.ok(
    sql.includes('FOR pol IN'),
    'Migration must dynamically loop over existing policies',
  );
  assert.ok(
    sql.includes('DROP POLICY IF EXISTS %I ON %I.%I;'),
    'Migration must drop any legacy or differently named policy on family tables',
  );

  // BLOCKER 4: Trigger isolation and RPC defense
  assert.ok(
    sql.includes("IF TG_OP IS NULL OR TG_OP != 'INSERT' THEN"),
    'Trigger function must protect against direct execution outside trigger context',
  );
  assert.ok(
    sql.includes('REVOKE ALL ON FUNCTION public.handle_new_family_circle() FROM PUBLIC, anon, authenticated;'),
    'Trigger function must have execute revoked from all clients including authenticated',
  );

  // BLOCKER 5: Alert workflow immutability
  assert.ok(
    sql.includes('REVOKE UPDATE, DELETE ON public.family_circle_alerts FROM PUBLIC, anon, authenticated;'),
    'Alert table must have UPDATE and DELETE revoked from all clients',
  );
  assert.equal(
    sql.includes('CREATE POLICY "family_circle_alerts_update_policy"'),
    false,
    'Alert table must never have an UPDATE policy',
  );
  assert.equal(
    sql.includes('CREATE POLICY "family_circle_alerts_delete_policy"'),
    false,
    'Alert table must never have a DELETE policy',
  );

  // BLOCKER 6: Safe conrelid constraint checks and search_path enforcement
  assert.ok(
    sql.includes("conrelid = 'public.family_circles'::regclass"),
    'Constraints must be verified against correct table via conrelid',
  );
  assert.ok(
    sql.includes("SET search_path = ''"),
    'All SECURITY DEFINER functions must enforce empty search_path',
  );
  assert.ok(
    sql.includes('REVOKE ALL ON public.family_circles FROM PUBLIC, anon;'),
    'All family tables must revoke access from PUBLIC and anon',
  );
});

test('Security Audit: Final SQL verification suite includes 10-gate audit without destructive queries', async () => {
  const verifyPath = path.resolve('../CYBERSAATHI_FAMILY_SAFETY_VERIFY.sql');
  const sql = await fs.readFile(verifyPath, 'utf8');

  // Must be strictly read-only
  const destructiveKeywords = ['DROP TABLE', 'DELETE FROM', 'TRUNCATE', 'ALTER TABLE', 'DROP POLICY'];
  for (const kw of destructiveKeywords) {
    assert.equal(sql.includes(kw), false, `Verification script must never contain "${kw}"`);
  }

  // Must verify column-level privileges
  assert.ok(
    sql.includes('information_schema.column_privileges'),
    'Verification script must check column_privileges for UPDATE isolation',
  );

  // Must verify non-recursive update policy
  assert.ok(
    sql.includes('8. Non-Recursive Member UPDATE Policy'),
    'Verification script must verify non-recursive member UPDATE policy',
  );

  // Must verify 10 gates in final audit check
  assert.ok(
    sql.includes('10. Performance & Lookup Indexes'),
    'Verification script must evaluate all 10 security readiness gates',
  );
});

test('Security Audit: Invite code is not disclosed in join RPC response or fallback queries', async () => {
  const migrationPath = path.resolve('../CYBERSAATHI_FAMILY_SAFETY_FINAL_MIGRATION.sql');
  const sql = await fs.readFile(migrationPath, 'utf8');

  // Find join_family_circle_with_invite return block
  const rpcStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.join_family_circle_with_invite');
  const rpcEnd = sql.indexOf('$$;', rpcStart);
  const rpcBody = sql.substring(rpcStart, rpcEnd);

  // Ensure 'invite_code' is not inside the return jsonb_build_object
  const returnBlock = rpcBody.substring(rpcBody.indexOf('RETURN jsonb_build_object'));
  assert.equal(
    returnBlock.includes("'invite_code'"),
    false,
    'join RPC return JSON must not contain invite_code',
  );
  assert.equal(
    returnBlock.includes("'owner_user_id'"),
    false,
    'join RPC return JSON must not contain owner_user_id',
  );

  // Ensure backend fallback does not select invite_code
  const servicePath = path.resolve('src/services/family-safety/family-safety.service.ts');
  const serviceCode = await fs.readFile(servicePath, 'utf8');
  assert.ok(
    serviceCode.includes(".select('id, name, created_at')"),
    'Fallback query must only select non-sensitive circle metadata',
  );
});




