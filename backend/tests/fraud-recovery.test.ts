import test from 'node:test';
import assert from 'node:assert/strict';
import { fraudRecoveryService } from '../src/services/recovery/fraud-recovery.service.js';
import { createApp } from '../src/app.js';
import type { Server } from 'node:http';

test('fraudRecoveryService lists all 9 supported Indian fraud vectors', () => {
  const vectors = fraudRecoveryService.listVectors();
  assert.equal(vectors.length, 9, 'Expected exactly 9 fraud vectors');

  const expectedIds = [
    'upi-fraud',
    'net-banking',
    'card-fraud',
    'investment-scams',
    'job-scams',
    'social-media-hacked',
    'identity-theft',
    'phishing-apk',
    'ecommerce-fraud',
  ];

  for (const id of expectedIds) {
    const found = vectors.find((v) => v.id === id);
    assert.ok(found, `Missing expected vector ID: ${id}`);
    assert.ok(found.title.length > 5, `Vector ${id} must have a descriptive title`);
    assert.ok(found.goldenHourMinutes > 0, `Vector ${id} must define golden hour window`);
    assert.ok(found.totalChecklistSteps >= 3, `Vector ${id} must have at least 3 checklist steps`);
  }
});

test('fraudRecoveryService retrieves full details for UPI fraud', () => {
  const upi = fraudRecoveryService.getVector('upi-fraud');
  assert.ok(upi, 'UPI vector must exist');
  assert.equal(upi.urgencyLevel, 'CRITICAL');
  assert.equal(upi.goldenHourMinutes, 120);

  // Verify Golden Hour checklist contains 1930 and bank notification
  const stepActions = upi.goldenHourChecklist.map((s) => s.action);
  assert.ok(stepActions.some((a) => a.includes('1930')), 'Must include 1930 helpline in checklist');
  assert.ok(stepActions.some((a) => a.toLowerCase().includes('bank')), 'Must include bank notification in checklist');

  // Verify legal sections include IT Act 66D and BNS 318(4)
  const legalCodes = upi.legalSections.map((s) => s.code);
  assert.ok(legalCodes.some((c) => c.includes('66D')), 'Must cite IT Act Section 66D');
  assert.ok(legalCodes.some((c) => c.includes('318(4)')), 'Must cite BNS Section 318(4)');

  // Verify official portals include cybercrime.gov.in and NPCI
  const portalUrls = upi.officialPortals.map((p) => p.url);
  assert.ok(portalUrls.some((u) => u.includes('cybercrime.gov.in')), 'Must include NCRP portal');
  assert.ok(portalUrls.some((u) => u.includes('npci.org.in')), 'Must include NPCI dispute link');
});

test('fraudRecoveryService retrieves emergency directory with 1930 and bank desks', () => {
  const directory = fraudRecoveryService.getEmergencyDirectory();
  assert.ok(directory.helplines.length >= 4, 'Must list major national helplines');
  assert.ok(directory.helplines.some((h) => h.number === '1930'), 'Must list 1930 National Cyber Fraud Helpline');
  assert.ok(directory.helplines.some((h) => h.number === '14448'), 'Must list 14448 RBI Ombudsman');

  assert.ok(directory.bankContacts.length >= 8, 'Must list major Indian banks');
  const bankNames = directory.bankContacts.map((b) => b.bankName);
  assert.ok(bankNames.some((b) => b.includes('State Bank of India')), 'Must include SBI');
  assert.ok(bankNames.some((b) => b.includes('HDFC Bank')), 'Must include HDFC');
  assert.ok(bankNames.some((b) => b.includes('ICICI Bank')), 'Must include ICICI');
});

test('fraudRecoveryService generates a structured legal complaint letter', () => {
  const draft = fraudRecoveryService.generateComplaintLetter({
    victimName: 'Ramesh Sharma',
    victimPhone: '+91 9876543210',
    victimEmail: 'ramesh.sharma@example.com',
    victimAddress: 'Flat 402, Sector 14, Rohini',
    cityState: 'New Delhi, Delhi',
    incidentDate: '12th November 2026',
    incidentTime: '02:30 PM',
    vectorId: 'upi-fraud',
    lossAmountInr: 45000,
    bankName: 'State Bank of India',
    accountNumberLast4: '5432',
    transactionIdUtr: '431892817261',
    accusedIdentifier: 'fraudster@fakeupi / +91 9123456789',
    cybercrimeAckNumber: 'NCRP20261112999',
    incidentChronology:
      'I received a call purporting to be from an electricity board officer demanding payment for unpaid electricity bill. I was instructed to scan a QR code to clear the bill, resulting in an unauthorized deduction of Rs. 45,000.',
    evidenceList: [
      'Bank debit SMS with UTR 431892817261',
      'Screenshot of UPI app transaction details showing recipient VPA',
      'WhatsApp call record and message history',
    ],
  });

  assert.ok(draft.subjectLine.includes('UPI'), 'Subject line must identify crime vector');
  assert.ok(draft.formattedText.includes('Ramesh Sharma'), 'Must contain complainant name');
  assert.ok(draft.formattedText.includes('45,000'), 'Must format loss amount in INR');
  assert.ok(draft.formattedText.includes('431892817261'), 'Must include UTR number');
  assert.ok(draft.formattedText.includes('Section 66D'), 'Must cite relevant IT Act section');
  assert.ok(draft.formattedText.includes('Section 106 of the Bharatiya Nagarik Suraksha Sanhita'), 'Must pray for BNSS debit freeze');
  assert.equal(draft.annexures.length, 3, 'Must list all 3 annexures');
});

test('fraudRecoveryService rejects malformed complaint input', () => {
  assert.throws(
    () => {
      fraudRecoveryService.generateComplaintLetter({
        victimName: 'A', // too short
        victimPhone: 'invalid',
        victimEmail: 'not-an-email',
        victimAddress: '',
        incidentDate: '',
        incidentTime: '',
        vectorId: '',
        cityState: '',
        incidentChronology: 'Too short',
        evidenceList: [],
      });
    },
    (err: unknown) => {
      return err instanceof Error;
    },
  );
});

test('HTTP API endpoints for fraud recovery serve valid responses', async () => {
  const app = createApp({ generalLimit: 100, healthLimit: 100 });
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Invalid address');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    // 1. GET /api/recovery/vectors
    const vectorsRes = await fetch(`${baseUrl}/api/recovery/vectors`);
    assert.equal(vectorsRes.status, 200);
    const vectorsJson = (await vectorsRes.json()) as { success: boolean; data: unknown[] };
    assert.equal(vectorsJson.success, true);
    assert.equal(vectorsJson.data.length, 9);

    // 2. GET /api/recovery/vectors/upi-fraud
    const vectorDetailRes = await fetch(`${baseUrl}/api/recovery/vectors/upi-fraud`);
    assert.equal(vectorDetailRes.status, 200);
    const vectorDetailJson = (await vectorDetailRes.json()) as { success: boolean; data: { id: string } };
    assert.equal(vectorDetailJson.data.id, 'upi-fraud');

    // 3. GET /api/recovery/vectors/non-existent
    const notFoundRes = await fetch(`${baseUrl}/api/recovery/vectors/unknown-fraud-type`);
    assert.equal(notFoundRes.status, 404);

    // 4. GET /api/recovery/contacts
    const contactsRes = await fetch(`${baseUrl}/api/recovery/contacts`);
    assert.equal(contactsRes.status, 200);
    const contactsJson = (await contactsRes.json()) as { success: boolean; data: { helplines: unknown[] } };
    assert.ok(contactsJson.data.helplines.length > 0);

    // 5. POST /api/recovery/draft-complaint
    const draftRes = await fetch(`${baseUrl}/api/recovery/draft-complaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        victimName: 'Ananya Verma',
        victimPhone: '+91 9988776655',
        victimEmail: 'ananya@example.com',
        victimAddress: '123 MG Road, Indiranagar',
        cityState: 'Bengaluru, Karnataka',
        incidentDate: '10th November 2026',
        incidentTime: '11:00 AM',
        vectorId: 'investment-scams',
        lossAmountInr: 120000,
        incidentChronology:
          'I was added to a Telegram investment group offering institutional stock tips and deposited funds into a fake trading platform.',
        evidenceList: ['Bank transaction receipt', 'Telegram chat export'],
      }),
    });
    assert.equal(draftRes.status, 200);
    const draftJson = (await draftRes.json()) as { success: boolean; data: { formattedText: string } };
    assert.ok(draftJson.data.formattedText.includes('Ananya Verma'));
    assert.ok(draftJson.data.formattedText.includes('1,20,000'));

    // 6. POST /api/recovery/investigation requires authentication
    const unauthBridgeRes = await fetch(`${baseUrl}/api/recovery/investigation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vectorId: 'upi-fraud',
        complaintText: 'Test complaint text',
      }),
    });
    assert.equal(unauthBridgeRes.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
