import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  createNexconnSignature,
  deriveNexconnUserId,
} from '../src/services/nexconn/nexconn.service.js';

test('Nexconn user IDs are stable, opaque, and within the provider limit', () => {
  const first = deriveNexconnUserId('4a9872a4-8cf5-4a2c-9d8b-426214ed98a1');
  const second = deriveNexconnUserId('6d154855-cdda-4c93-b57a-d33e045497c3');

  assert.equal(first, deriveNexconnUserId('4a9872a4-8cf5-4a2c-9d8b-426214ed98a1'));
  assert.notEqual(first, second);
  assert.match(first, /^[a-zA-Z0-9]{64}$/);
  assert.notEqual(first, '4a9872a4-8cf5-4a2c-9d8b-426214ed98a1');
});

test('Nexconn API signatures follow the documented SHA-1 secret/nonce/timestamp format', () => {
  const expected = createHash('sha1')
    .update('private-app-secret12345678901700000000000')
    .digest('hex');
  assert.equal(
    createNexconnSignature('private-app-secret', '1234567890', '1700000000000'),
    expected,
  );
});
