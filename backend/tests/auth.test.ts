import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { scannerAuth, getScannerAuth } from '../src/middleware/scannerAuth.js';

interface MockResponse {
  statusCode: number;
  jsonData: unknown;
  status: (code: number) => MockResponse;
  json: (data: unknown) => MockResponse;
  locals: Record<string, unknown>;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    jsonData: null,
    locals: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.jsonData = data;
      return this;
    },
  };
  return res;
}

test('scannerAuth middleware rejects requests with missing authorization header', async () => {
  const req = {
    header: (_name: string) => undefined,
  } as unknown as Request;
  const res = createMockResponse();
  let nextCalled = false;

  await scannerAuth(req, res as unknown as Response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonData, { success: false, message: 'Authentication required.' });
});

test('scannerAuth middleware rejects non-Bearer authorization schemes', async () => {
  const req = {
    header: (name: string) => (name.toLowerCase() === 'authorization' ? 'Basic dXNlcjpwYXNz' : undefined),
  } as unknown as Request;
  const res = createMockResponse();
  let nextCalled = false;

  await scannerAuth(req, res as unknown as Response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonData, { success: false, message: 'Authentication required.' });
});

test('scannerAuth middleware rejects oversized tokens exceeding 8192 bytes', async () => {
  const oversized = 'a'.repeat(8193);
  const req = {
    header: (name: string) => (name.toLowerCase() === 'authorization' ? `Bearer ${oversized}` : undefined),
  } as unknown as Request;
  const res = createMockResponse();
  let nextCalled = false;

  await scannerAuth(req, res as unknown as Response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonData, { success: false, message: 'Authentication required.' });
});

test('getScannerAuth validates structure and extracts context safely', () => {
  assert.equal(getScannerAuth(null), null);
  assert.equal(getScannerAuth(undefined), null);
  assert.equal(getScannerAuth('invalid'), null);
  assert.equal(getScannerAuth({ accessToken: 123, userId: 'abc' }), null);

  const valid = { accessToken: 'valid-token', userId: 'user-uuid' };
  const extracted = getScannerAuth(valid);
  assert.notEqual(extracted, null);
  assert.equal(extracted?.accessToken, 'valid-token');
  assert.equal(extracted?.userId, 'user-uuid');
});
