import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeMessage } from '../src/services/scanner/message-scanner.service.js';
import { assessRisk } from '../src/services/scanner/risk-engine.service.js';
import { analyzeScan } from '../src/services/scanner/scanner.service.js';
import type { ScanFinding } from '../src/services/scanner/scanner.schema.js';
import { analyzeUrl } from '../src/services/scanner/url-scanner.service.js';
import { checkUrlReputation } from '../src/services/scanner/threat-intelligence.service.js';

test('URL scanner accepts complete HTTP and HTTPS URLs', () => {
  const https = analyzeUrl('https://example.com/account');
  assert.equal(https.hostname, 'example.com');
  assert.equal(https.protocol, 'https:');
  assert.equal(https.ipLiteral, false);

  const http = analyzeUrl('http://example.com');
  assert.ok(http.findings.some((finding) => finding.id === 'url-no-https'));
});

test('URL scanner rejects malformed, credentialed, and unsupported URLs', () => {
  assert.throws(() => analyzeUrl('not a URL'), /complete URL/);
  assert.throws(() => analyzeUrl('ftp://example.com'), /HTTP and HTTPS/);
  assert.throws(() => analyzeUrl('https://user:secret@example.com'), /HTTP and HTTPS/);
});

test('URL scanner flags IP literal, private range, shortener, and punycode patterns', () => {
  const local = analyzeUrl('http://192.168.1.20/login');
  assert.ok(local.findings.some((finding) => finding.id === 'url-ip-literal'));
  assert.ok(local.findings.some((finding) => finding.id === 'url-private-address'));

  assert.ok(analyzeUrl('https://bit.ly/abc').findings.some((finding) => finding.id === 'url-shortener'));
  assert.ok(analyzeUrl('https://xn--e1afmkfd.example').findings.some((finding) => finding.id === 'url-punycode'));
});

test('SMS scanner distinguishes ordinary messages and common scam indicators', () => {
  const ordinary = analyzeMessage({
    type: 'sms',
    content: 'Your appointment is confirmed for tomorrow at 10 AM.',
  });
  assert.equal(ordinary.findings.length, 0);

  const bankAlert = analyzeMessage({
    type: 'sms',
    content: 'Your bank account will be blocked immediately. Update KYC at https://bit.ly/example',
  });
  assert.ok(bankAlert.findings.some((finding) => finding.id === 'message-urgent-account-threat'));
  assert.ok(bankAlert.findings.some((finding) => finding.id === 'message-kyc'));
  assert.ok(bankAlert.findings.some((finding) => finding.id === 'message-payment-link'));
  assert.ok(bankAlert.extractedUrls.length > 0);
});

test('SMS scanner identifies UPI, OTP, prize, delivery, and remote-access language', () => {
  const content = [
    'Share your OTP with support.',
    'Approve the UPI collect request to receive your refund.',
    'You won a prize, pay a fee to claim it.',
    'Pay a parcel delivery fee using this link.',
    'Install AnyDesk for support.',
  ].join(' ');
  const result = analyzeMessage({ type: 'sms', content });
  const ids = new Set(result.findings.map((finding) => finding.id));
  assert.ok(ids.has('message-otp-request'));
  assert.ok(ids.has('message-upi-collect'));
  assert.ok(ids.has('message-prize'));
  assert.ok(ids.has('message-delivery-fee'));
  assert.ok(ids.has('message-remote-access'));
});

test('email scanner reports sender mismatch and only uses supplied header evidence', () => {
  const noHeaders = analyzeMessage({
    type: 'email',
    content: 'Hello, your meeting starts at noon.',
    metadata: { sender: 'security@company.example' },
  });
  assert.equal(noHeaders.emailAuthentication?.supplied, false);
  assert.ok(noHeaders.emailAuthentication?.note.includes('not assessed'));

  const withHeaders = analyzeMessage({
    type: 'email',
    content: 'Please review this account notice.',
    metadata: {
      sender: 'security@company.example',
      replyTo: 'attacker@other.example',
      headers: 'Authentication-Results: mx.example; spf=fail; dkim=pass; dmarc=pass',
    },
  });
  assert.ok(withHeaders.findings.some((finding) => finding.id === 'email-reply-to-domain-mismatch'));
  assert.equal(withHeaders.findings.filter((finding) => finding.id.startsWith('email-auth-')).length, 3);
  assert.ok(withHeaders.findings.filter((finding) => finding.id.startsWith('email-auth-')).every((finding) => !finding.verified));
});

test('risk scoring maps all score bands and separates risk from confidence', () => {
  const finding = (points: number): ScanFinding => ({
    id: `test-${points}`,
    title: 'Test evidence',
    detail: 'Deterministic test evidence.',
    severity: 'medium',
    source: 'Test',
    verified: false,
    points,
  });
  assert.equal(assessRisk([finding(29)], 0).level, 'Low Risk');
  assert.equal(assessRisk([finding(30)], 0).level, 'Medium Risk');
  assert.equal(assessRisk([finding(59)], 0).level, 'Medium Risk');
  assert.equal(assessRisk([finding(60)], 0).level, 'High Risk');
  assert.equal(assessRisk([finding(79)], 0).level, 'High Risk');
  assert.equal(assessRisk([finding(80)], 0).level, 'Critical Risk');
  assert.notEqual(assessRisk([finding(30)], 0).confidence, 30);
});

test('unknown checks produce an inconclusive verdict rather than a safe result', () => {
  const result = assessRisk([], 0);
  assert.equal(result.score, 0);
  assert.equal(result.verdict, 'Inconclusive');
  assert.equal(result.confidenceLevel, 'Low');
});

test('threat-intelligence checks are explicitly skipped without user consent', async () => {
  const result = await checkUrlReputation('https://example.com', false);
  assert.deepEqual(result.checksPerformed, []);
  assert.equal(result.cleanProviderCount, 0);
  assert.ok(result.checksUnavailable[0]?.includes('consent'));
});

test('URL scan does not fetch the submitted destination', async () => {
  const report = await analyzeScan({
    type: 'url',
    content: 'https://example.com',
    allowExternalChecks: false,
  });
  assert.ok(report.checksUnavailable.some((check) => check.includes('Destination fetching')));
  assert.equal(report.verdict, 'Inconclusive');
  assert.equal(report.aiSummary.status, 'not_applicable');
  assert.equal(report.submittedContentRedacted, '[URL redacted]');
});

test('QR scans analyze decoded URLs without opening or retaining them', async () => {
  const report = await analyzeScan({
    type: 'qr',
    content: 'https://example.com/account?token=private',
    allowExternalChecks: false,
  });
  assert.equal(report.scanType, 'qr');
  assert.equal(report.urlInfo[0]?.hostname, 'example.com');
  assert.deepEqual(report.extractedUrls, ['https://example.com/[path redacted]']);
  assert.equal(report.submittedContentRedacted, '[URL redacted]');
});
