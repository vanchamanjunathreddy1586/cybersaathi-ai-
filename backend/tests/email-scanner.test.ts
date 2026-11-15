import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeMessage,
  extractDomain,
  extractEmailAddress,
  extractDisplayName,
} from '../src/services/scanner/message-scanner.service.js';
import { assessRisk } from '../src/services/scanner/risk-engine.service.js';

test('simulated phishing email receives high risk score, likely malicious verdict, and multiple indicators', () => {
  const phishing = analyzeMessage({
    type: 'email',
    content: [
      'Your account will be suspended within 24 hours due to non-compliance.',
      'Mandatory identity verification is required immediately.',
      'Please reply to this notice to provide your account details and password to restore access.',
    ].join('\n'),
    metadata: {
      sender: 'Account Support <notice@service-alerts.example>',
      replyTo: 'support@service-alerts.example',
      subject: 'URGENT: Your account will be suspended within 24 hours',
    },
  });

  const ids = phishing.findings.map((f) => f.id);
  assert.ok(ids.includes('message-urgent-account-threat'), 'Must detect account suspension threat');
  assert.ok(ids.includes('message-verification-pressure'), 'Must detect identity verification pressure');
  assert.ok(ids.includes('message-credential-harvesting'), 'Must detect credential harvesting');

  // Verify finding detail includes evidence and explains why it matters
  for (const finding of phishing.findings) {
    assert.ok(finding.detail.includes('Evidence detected:'), `Finding ${finding.id} must include evidence`);
    assert.ok(finding.detail.includes('Why it matters:'), `Finding ${finding.id} must explain why it matters`);
  }

  const assessment = assessRisk(phishing.findings, 0);
  assert.ok(assessment.score >= 60, `Score must be >= 60, got ${assessment.score}`);
  assert.equal(assessment.verdict, 'Likely Malicious');
  assert.ok(assessment.confidence >= 50, 'Confidence must be medium or high');
  assert.notEqual(assessment.confidence, assessment.score, 'Confidence must be distinct from score');
});

test('email scanner parses RFC 5322 headers and flags domain mismatch, free webmail reply-to, and display spoofing', () => {
  assert.equal(extractEmailAddress('"Security Team" <security@bank.example>'), 'security@bank.example');
  assert.equal(extractDomain('"Security Team" <security@bank.example>'), 'bank.example');
  assert.equal(extractDisplayName('"Security Team" <security@bank.example>'), 'Security Team');

  const spoofed = analyzeMessage({
    type: 'email',
    content: 'Please review your account immediately.',
    metadata: {
      sender: '"Bank Customer Support" <attacker@gmail.com>',
      replyTo: 'harvester@yahoo.com',
    },
  });

  const ids = spoofed.findings.map((f) => f.id);
  assert.ok(ids.includes('email-display-name-spoofing'), 'Must flag display name brand spoofing');
  assert.ok(ids.includes('email-reply-to-domain-mismatch'), 'Must flag domain mismatch between gmail and yahoo');

  const orgWithFreeMailReply = analyzeMessage({
    type: 'email',
    content: 'Official invoice notice.',
    metadata: {
      sender: 'billing@corporate.example',
      replyTo: 'executive@gmail.com',
    },
  });

  const orgIds = orgWithFreeMailReply.findings.map((f) => f.id);
  assert.ok(orgIds.includes('email-reply-to-domain-mismatch'));
  assert.ok(orgIds.includes('email-reply-to-freemail'), 'Must flag free webmail reply-to for corporate sender');
});

test('email scanner distinguishes legitimate appointment notifications from phishing', () => {
  const appointment = analyzeMessage({
    type: 'email',
    content: 'Your appointment is confirmed for tomorrow at 10 AM with Dr. Gupta. Location: Suite 402, Medical Center.',
    metadata: {
      sender: 'appointments@clinic.example',
      subject: 'Appointment Confirmation: Dr. Gupta',
    },
  });

  assert.equal(appointment.findings.length, 0);
  const assessment = assessRisk(appointment.findings, 0);
  assert.equal(assessment.score, 0);
  assert.notEqual(assessment.verdict, 'Likely Malicious');
  assert.notEqual(assessment.verdict, 'Suspicious');
});

test('email scanner does not automatically classify benign or informational KYC emails as malicious', () => {
  const benignNotice = analyzeMessage({
    type: 'email',
    content: 'Your KYC verification has been completed successfully. Thank you for your cooperation.',
    metadata: {
      sender: 'kyc-desk@bank.example',
      subject: 'KYC Verification Completed',
    },
  });

  assert.equal(benignNotice.findings.length, 0);

  const informationalKyc = analyzeMessage({
    type: 'email',
    content: 'Annual KYC Notice: As per banking guidelines, please periodically verify your KYC information through your official account portal when convenient.',
    metadata: {
      sender: 'notifications@bank.example',
      subject: 'Annual KYC Information',
    },
  });

  const assessment = assessRisk(informationalKyc.findings, 0);
  assert.ok(assessment.score < 30, 'Informational KYC must remain in low risk band');
  assert.notEqual(assessment.verdict, 'Likely Malicious');
});

test('email scanner keeps missing SPF/DKIM/DMARC headers explicitly unverified with zero penalty', () => {
  const noHeaders = analyzeMessage({
    type: 'email',
    content: 'Important updates regarding our service terms.',
    metadata: {
      sender: 'updates@service.example',
    },
  });

  assert.equal(noHeaders.emailAuthentication?.supplied, false);
  assert.ok(noHeaders.emailAuthentication?.note.includes('not assessed'));
  assert.equal(noHeaders.findings.filter((f) => f.id.startsWith('email-auth-')).length, 0);
  const assessment = assessRisk(noHeaders.findings, 0);
  assert.equal(assessment.score, 0);
});

test('security disclaimers and educational notices do not trigger credential harvesting false positives', () => {
  const disclaimerMessage = analyzeMessage({
    type: 'email',
    content: 'Security reminder: CyberSaathi will never ask you for your password or PIN. Never share your OTP with anyone.',
    metadata: {
      sender: 'security@cybersaathi.org',
      subject: 'Security Best Practices',
    },
  });

  const ids = disclaimerMessage.findings.map((f) => f.id);
  assert.ok(!ids.includes('message-credential-harvesting'), 'Must not flag security disclaimer as harvesting');
  assert.ok(!ids.includes('message-otp-request'), 'Must not flag OTP warning as an OTP request');
  assert.equal(disclaimerMessage.findings.length, 0);
});
