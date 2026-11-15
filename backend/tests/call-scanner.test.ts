import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Server } from 'node:http';
import { callScannerService } from '../src/services/call-scanner/call-scanner.service.js';
import { detectCallLanguage } from '../src/services/call-scanner/scam-patterns.js';
import { createApp } from '../src/app.js';

test('detectCallLanguage identifies English, Hindi, and Telugu scripts accurately', () => {
  assert.equal(detectCallLanguage('Hello, I am calling regarding your recent bank transaction.'), 'en');
  assert.equal(detectCallLanguage('सीबीआई अधिकारी बोल रहा हूं, आपके नाम पर गैरकानूनी पार्सल मिला है।'), 'hi');
  assert.equal(detectCallLanguage('పార్సిల్ లో డ్రగ్స్ దొరికాయి, కస్టమ్స్ డిపార్ట్మెంట్ నుంచి మాట్లాడుతున్నాం.'), 'te');
  assert.equal(detectCallLanguage('Aapke aadhar par fake sim issue hua hai, 2 ghante me sim band ho jayega.'), 'hi');
  assert.equal(detectCallLanguage('Current bill kattaledu, 2 hours lo current cut aipotundi.'), 'te');
});

test('callScannerService detects Digital Arrest extortion in English', async () => {
  const englishDigitalArrest = `
    This is Inspector Sharma from Crime Branch Cyber Cell. An arrest warrant has been issued
    against your Aadhaar card for money laundering. You are currently under digital arrest.
    Stay on this Skype video call and do not disconnect. You must transfer your funds
    to the RBI verification account immediately to clear your name.
  `;

  const report = await callScannerService.analyzeTranscript(englishDigitalArrest);

  assert.equal(report.verdict, 'Likely Scam');
  assert.equal(report.riskLevel, 'Critical Risk');
  assert.ok(report.riskScore >= 85, `Expected score >= 85, got ${report.riskScore}`);
  assert.ok(report.matchedCategories.includes('DIGITAL_ARREST_LAW_ENFORCEMENT'));
  assert.ok(report.impersonationTarget?.includes('Police / CBI'));
  assert.ok(report.recommendedActions.some((a) => a.includes('DO NOT TRANSFER MONEY')));
  assert.ok(report.recommendedActions.some((a) => a.includes('1930')));
});

test('callScannerService detects CBI impersonation and extortion in Hindi', async () => {
  const hindiScam = `
    सीबीआई मुख्यालय से जांच अधिकारी बात कर रहे हैं। आपके आधार नंबर से ताइवान भेजे गए
    पार्सल में नशीली दवाएं और ड्रग्स पकड़े गए हैं। सुप्रीम कोर्ट का वारंट है।
    कैमरा बंद मत करना और किसी को मत बताना। सरकारी सुरक्षित खाते में वेरिफिकेशन के लिए पैसे भेजो।
  `;

  const report = await callScannerService.analyzeTranscript(hindiScam);

  assert.equal(report.detectedLanguage, 'hi');
  assert.equal(report.verdict, 'Likely Scam');
  assert.equal(report.riskLevel, 'Critical Risk');
  assert.ok(report.riskScore >= 85);
  assert.ok(report.matchedCategories.includes('DIGITAL_ARREST_LAW_ENFORCEMENT'));
});

test('callScannerService detects FedEx Customs narcotics parcel scam in Telugu', async () => {
  const teluguScam = `
    ఫెడెక్స్ కొరియర్ కస్టమ్స్ డిపార్ట్మెంట్ నుంచి మాట్లాడుతున్నాం. మీ ఆధార్ కార్డ్ పేరుతో తైవాన్ వెళ్తున్న
    పార్సిల్ లో డ్రగ్స్ మరియు నార్కోటిక్స్ దొరికాయి. పోలీస్ కేసు ఫైల్ అయింది.
    అరెస్ట్ కాకుండా ఉండాలంటే వెంటనే ఆర్బీఐ వెరిఫికేషన్ అకౌంట్ కి సెక్యూరిటీ డిపాజిట్ ట్రాన్స్ఫర్ చేయండి.
  `;

  const report = await callScannerService.analyzeTranscript(teluguScam);

  assert.equal(report.detectedLanguage, 'te');
  assert.equal(report.verdict, 'Likely Scam');
  assert.ok(report.riskScore >= 75);
  assert.ok(
    report.matchedCategories.includes('COURIER_NARCOTICS_CUSTOMS') ||
    report.matchedCategories.includes('DIGITAL_ARREST_LAW_ENFORCEMENT'),
  );
});

test('callScannerService detects urgent Electricity power disconnection scam', async () => {
  const electricityScam = `
    Dear consumer your electricity power supply will be disconnected tonight at 9:30 pm
    from the electricity office because previous month bill was not updated.
    Contact our electricity power officer immediately at 9876543210.
  `;

  const report = await callScannerService.analyzeTranscript(electricityScam);

  assert.equal(report.verdict, 'Likely Scam');
  assert.ok(report.riskScore >= 60);
  assert.ok(report.matchedCategories.includes('ELECTRICITY_POWER_DISCONNECTION'));
  assert.ok(report.impersonationTarget?.includes('Electricity'));
});

test('callScannerService detects Remote Access Tool (AnyDesk) coercion', async () => {
  const ratScam = `
    Hello sir from bank support. Your KYC is expired. To verify your phone immediately,
    please install AnyDesk and share your 9-digit code or dial *401*9876543210# on your keypad.
  `;

  const report = await callScannerService.analyzeTranscript(ratScam);

  assert.equal(report.verdict, 'Likely Scam');
  assert.ok(report.riskScore >= 75);
  assert.ok(report.matchedCategories.includes('REMOTE_ACCESS_TOOL_COERCION'));
  assert.ok(report.recommendedActions.some((a) => a.includes('AnyDesk')));
});

test('callScannerService classifies legitimate service and delivery calls as Likely Safe with low score', async () => {
  const legitimateCall = `
    Hello, good afternoon! I am calling from BlueDart courier regarding your Amazon order delivery.
    I am at your building gate. Could you please confirm if you are home to collect the parcel?
    Thank you.
  `;

  const report = await callScannerService.analyzeTranscript(legitimateCall);

  assert.equal(report.verdict, 'Likely Safe');
  assert.equal(report.riskLevel, 'Low Risk');
  assert.ok(report.riskScore < 25, `Expected score < 25, got ${report.riskScore}`);
  assert.equal(report.impersonationTarget, null);
});

test('callScannerService rejects unsupported audio formats', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'call-test-'));
  const testFile = path.join(tmpDir, 'test.exe');
  try {
    await fs.writeFile(testFile, Buffer.from('fake binary'));
    await assert.rejects(
      async () => callScannerService.analyzeAudio(testFile, 'test.exe', 1024),
      /Unsupported audio format/i,
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('call scanner HTTP endpoints validate input and protect authenticated history', async () => {
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. POST /analyze-transcript with empty payload returns 400 VALIDATION_ERROR
    const resShort = await fetch(`${baseUrl}/api/call-scanner/analyze-transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: 'hi' }),
    });
    assert.equal(resShort.status, 400);
    const bodyShort = (await resShort.json()) as any;
    assert.equal(bodyShort.code, 'VALIDATION_ERROR');

    // 2. POST /analyze-transcript with valid transcript returns 200
    const resValid = await fetch(`${baseUrl}/api/call-scanner/analyze-transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: 'Police digital arrest scam where you must transfer money to RBI account.',
      }),
    });
    assert.equal(resValid.status, 200);
    const bodyValid = (await resValid.json()) as any;
    assert.equal(bodyValid.success, true);
    assert.ok(bodyValid.data.riskScore >= 70);

    // 3. GET /history unauthenticated returns 401
    const resHistory = await fetch(`${baseUrl}/api/call-scanner/history`, {
      method: 'GET',
    });
    assert.equal(resHistory.status, 401);
    const bodyHistory = (await resHistory.json()) as any;
    assert.equal(bodyHistory.success, false);

    // 4. GET /scans/:id unauthenticated returns 401
    const resScan = await fetch(`${baseUrl}/api/call-scanner/scans/123e4567-e89b-12d3-a456-426614174000`, {
      method: 'GET',
    });
    assert.equal(resScan.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
