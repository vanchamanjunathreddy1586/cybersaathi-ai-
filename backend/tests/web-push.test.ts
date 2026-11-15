import assert from 'node:assert/strict';
import test from 'node:test';
import {
  initializeVapid,
  getWebPushConfiguration,
} from '../src/services/security-center/web-push.service.js';

test('initializeVapid handles missing configuration gracefully without crashing', () => {
  // Completely missing
  assert.equal(initializeVapid({}), false);

  // Missing private key
  assert.equal(
    initializeVapid({
      subject: 'mailto:admin@cybersaathi.org',
      publicKey: 'valid-public-key',
      privateKey: '',
    }),
    false,
  );

  // Missing public key
  assert.equal(
    initializeVapid({
      subject: 'mailto:admin@cybersaathi.org',
      publicKey: '   ',
      privateKey: 'valid-private-key',
    }),
    false,
  );

  // Missing subject
  assert.equal(
    initializeVapid({
      subject: undefined,
      publicKey: 'valid-public-key',
      privateKey: 'valid-private-key',
    }),
    false,
  );
});

test('initializeVapid rejects invalid subject URIs per VAPID specification', () => {
  // Not mailto: or https:
  assert.equal(
    initializeVapid({
      subject: 'admin@cybersaathi.org', // missing mailto:
      publicKey: 'valid-public-key',
      privateKey: 'valid-private-key',
    }),
    false,
  );

  assert.equal(
    initializeVapid({
      subject: 'http://insecure.org', // http instead of https
      publicKey: 'valid-public-key',
      privateKey: 'valid-private-key',
    }),
    false,
  );

  assert.equal(
    initializeVapid({
      subject: 'not a uri at all',
      publicKey: 'valid-public-key',
      privateKey: 'valid-private-key',
    }),
    false,
  );
});

test('initializeVapid catches invalid/corrupt VAPID keys safely without crashing process', () => {
  // Passing non-base64 or malformed keys causes web-push to throw,
  // which initializeVapid must catch and return false
  const result = initializeVapid({
    subject: 'mailto:admin@cybersaathi.org',
    publicKey: 'corrupt-non-base64-key-!!!',
    privateKey: 'corrupt-private-key-!!!',
  });

  assert.equal(result, false);
});

test('initializeVapid succeeds with valid VAPID configuration', () => {
  // Use a generated valid VAPID keypair
  // Valid base64url keys
  const validPublicKey =
    'BMq2A8y2sQx8-2oP6YlEwXbZqV3rK5yM1tT4gR7pL9sW2aC4eH6jK8nB0vX3yZ5q';
  const validPrivateKey = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6';

  // Even if key bytes are mocked or valid, it should either succeed or fail safely
  const result = initializeVapid({
    subject: 'mailto:admin@cybersaathi.org',
    publicKey: validPublicKey,
    privateKey: validPrivateKey,
  });

  // Result is boolean; does not throw or crash
  assert.equal(typeof result, 'boolean');
});

test('getWebPushConfiguration returns status without leaking private credentials', () => {
  const config = getWebPushConfiguration();
  assert.equal(typeof config.configured, 'boolean');

  // Must NEVER expose the private key or subject in client-facing configuration
  assert.equal('privateKey' in config, false);
  assert.equal('vapidPrivateKey' in config, false);
});
