import test from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';
import {
  generateInviteCode,
  isMissingTableError,
  DatabaseMigrationPendingError,
} from '../src/services/family-safety/family-safety.service.js';

test('generateInviteCode creates formatted 9-char uppercase pairing tokens', () => {
  const code = generateInviteCode();
  assert.equal(code.startsWith('CS-'), true, 'Code must start with CS- prefix');
  assert.equal(code.length, 9, 'Code must be exactly 9 characters (CS- + 6 chars)');
  assert.match(code, /^CS-[A-Z0-9]{6}$/, 'Must contain only uppercase alphanumeric characters');

  // Ensure randomness across multiple generations
  const code2 = generateInviteCode();
  assert.notEqual(code, code2, 'Subsequent invite codes must be unique');
});

test('isMissingTableError accurately detects uninitialized database schema errors', () => {
  // Schema cache error
  assert.equal(
    isMissingTableError(new Error("Could not find the table 'public.family_circle_members' in the schema cache")),
    true,
  );
  // PostgREST 205
  assert.equal(isMissingTableError({ code: 'PGRST205', message: 'Table not found' }), true);
  // Postgres 42P01
  assert.equal(isMissingTableError({ code: '42P01', message: 'relation does not exist' }), true);
  // Relation does not exist text
  assert.equal(isMissingTableError(new Error('relation "family_circles" does not exist')), true);
  // Unrelated error returns false
  assert.equal(isMissingTableError(new Error('Invalid credentials')), false);
  assert.equal(isMissingTableError(null), false);
  assert.equal(isMissingTableError(undefined), false);
});

test('DatabaseMigrationPendingError carries DATABASE_SETUP_PENDING code', () => {
  const err = new DatabaseMigrationPendingError();
  assert.equal(err.code, 'DATABASE_SETUP_PENDING');
  assert.match(err.message, /not yet initialized/);
});

test('Family safety HTTP endpoints enforce authentication', async () => {
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
    // 1. POST /circles unauthenticated returns 401
    const resCreate = await fetch(`${baseUrl!}/api/family-safety/circles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sharma Family' }),
    });
    assert.equal(resCreate.status, 401);
    const bodyCreate = (await resCreate.json()) as { success: boolean; message: string };
    assert.equal(bodyCreate.success, false);

    // 2. POST /join unauthenticated returns 401
    const resJoin = await fetch(`${baseUrl!}/api/family-safety/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: 'CS-ABC123' }),
    });
    assert.equal(resJoin.status, 401);

    // 3. GET /circles unauthenticated returns 401
    const resList = await fetch(`${baseUrl!}/api/family-safety/circles`);
    assert.equal(resList.status, 401);

    // 4. GET /circles/:id unauthenticated returns 401
    const resGet = await fetch(`${baseUrl!}/api/family-safety/circles/123e4567-e89b-12d3-a456-426614174000`);
    assert.equal(resGet.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
