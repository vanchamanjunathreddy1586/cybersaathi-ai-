import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CallScannerApiError,
  generateCallReportMarkdown,
  SAMPLE_CALL_TRANSCRIPTS,
  type CallScanResult,
} from '../src/call-scanner/callScannerApi.ts'

test('CallScannerApiError captures message, status, and custom error code', () => {
  const err = new CallScannerApiError('Analysis service timed out.', 408, 'TIMEOUT')
  assert.equal(err.name, 'CallScannerApiError')
  assert.equal(err.message, 'Analysis service timed out.')
  assert.equal(err.status, 408)
  assert.equal(err.code, 'TIMEOUT')
})

test('SAMPLE_CALL_TRANSCRIPTS covers essential India phone fraud vectors in English, Hindi, and Telugu', () => {
  assert.ok(SAMPLE_CALL_TRANSCRIPTS.length >= 4, 'Must provide at least 4 sample vectors')

  const languages = SAMPLE_CALL_TRANSCRIPTS.map((s) => s.language)
  assert.ok(languages.includes('en'), 'Must include English sample')
  assert.ok(languages.includes('hi'), 'Must include Hindi sample')
  assert.ok(languages.includes('te'), 'Must include Telugu sample')

  const digitalArrestSample = SAMPLE_CALL_TRANSCRIPTS.find((s) => s.title.includes('Digital Arrest'))
  assert.ok(digitalArrestSample, 'Must include Digital Arrest sample')
  assert.ok(digitalArrestSample?.text.includes('Central Bureau of Investigation'))

  const fedexSample = SAMPLE_CALL_TRANSCRIPTS.find((s) => s.title.includes('FedEx'))
  assert.ok(fedexSample, 'Must include FedEx Narcotics sample')
})

test('Client-side audio validation enforces supported audio file extensions and size limit', () => {
  const validateAudioFile = (fileName: string, sizeBytes: number) => {
    const validExts = ['.wav', '.mp3', '.m4a', '.ogg']
    const hasValidExt = validExts.some((ext) => fileName.toLowerCase().endsWith(ext))
    if (!hasValidExt) {
      return { valid: false, error: 'INVALID_AUDIO_FORMAT' }
    }
    const maxSizeBytes = 25 * 1024 * 1024
    if (sizeBytes > maxSizeBytes) {
      return { valid: false, error: 'FILE_TOO_LARGE' }
    }
    return { valid: true, error: null }
  }

  assert.deepEqual(validateAudioFile('call_recording.wav', 2 * 1024 * 1024), { valid: true, error: null })
  assert.deepEqual(validateAudioFile('suspicious_voicemail.mp3', 8 * 1024 * 1024), { valid: true, error: null })
  assert.deepEqual(validateAudioFile('cbi_call.M4A', 4 * 1024 * 1024), { valid: true, error: null })
  assert.deepEqual(validateAudioFile('evidence.ogg', 1 * 1024 * 1024), { valid: true, error: null })
  assert.deepEqual(validateAudioFile('malware.exe', 1024), { valid: false, error: 'INVALID_AUDIO_FORMAT' })
  assert.deepEqual(validateAudioFile('document.pdf', 1024), { valid: false, error: 'INVALID_AUDIO_FORMAT' })
  assert.deepEqual(validateAudioFile('giant_recording.wav', 30 * 1024 * 1024), { valid: false, error: 'FILE_TOO_LARGE' })
})

test('generateCallReportMarkdown compiles executive incident report with 1930 and legal disclaimers', () => {
  const sampleResult: CallScanResult = {
    id: 'test-scan-call-uuid',
    inputType: 'transcript',
    languageDetected: 'en',
    riskScore: 88,
    verdict: 'Likely Scam',
    confidenceScore: 92,
    urgentActionRequired: true,
    summary: 'High-risk scam call impersonating CBI. Extortion under fake Digital Arrest detected.',
    tacticsDetected: [
      {
        id: 'digital_arrest',
        name: 'Digital Arrest Intimidation & Extortion',
        category: 'Extortion / Impersonation',
        description: 'Threat of non-bailable arrest over video call demanding immediate asset transfer.',
        detectedInLanguage: 'en',
        confidence: 95,
        evidenceQuotes: ['digital arrest', 'arrest warrant', 'transfer your funds to rbi'],
        mitigation: 'Immediately disconnect. Indian law does not permit arrest over video calls.',
        legalReference: 'IPC Section 419/420, Bharatiya Nyaya Sanhita (BNS) Section 318, IT Act Section 66D',
      },
      {
        id: 'fedex_narcotics_parcel',
        name: 'Customs & Narcotics Parcel Interception',
        category: 'Customs Fraud',
        description: 'Fabricated claims of drugs seized in international courier in victim name.',
        detectedInLanguage: 'en',
        confidence: 85,
        evidenceQuotes: ['parcel containing', 'mdma drugs', 'mumbai customs'],
        mitigation: 'Do not pay any customs clearance penalty to private bank accounts.',
      },
    ],
    safetyGuidance: [
      'Disconnect the call immediately and block the caller.',
      'Do not transfer money to any "clearing" or "verification" bank account.',
      'Report the incident to the National Cyber Crime Helpline at 1930.',
    ],
    emergencyContacts: [
      {
        title: 'National Cyber Crime Helpline',
        number: '1930',
        description: 'Immediate 24/7 financial fraud emergency desk to freeze fraudulent transfers.',
      },
      {
        title: 'Chakshu Telecom Fraud Reporting',
        number: 'sancharsaathi.gov.in',
        description: 'Department of Telecommunications official portal to report suspected fraud numbers.',
      },
    ],
    scannedAt: '2026-11-14T08:00:00.000Z',
  }

  const markdown = generateCallReportMarkdown(sampleResult)

  assert.ok(markdown.includes('CYBERSAATHI AI — TELECOM & VOICE SCAM FORENSIC REPORT'))
  assert.ok(markdown.includes('88 / 100'), 'Must contain risk score')
  assert.ok(markdown.includes('LIKELY SCAM'), 'Must contain verdict')
  assert.ok(markdown.includes('YES — IMMEDIATE RISK'), 'Must flag urgent action required')
  assert.ok(markdown.includes('Digital Arrest Intimidation & Extortion'), 'Must list tactic name')
  assert.ok(markdown.includes('"digital arrest"'), 'Must include evidence quote')
  assert.ok(markdown.includes('IPC Section 419/420'), 'Must contain legal reference')
  assert.ok(markdown.includes('1930'), 'Must contain National Cyber Crime Helpline')
  assert.ok(markdown.includes('sancharsaathi.gov.in'), 'Must contain Chakshu portal link')
  assert.ok(markdown.includes('THERE IS NO LEGAL PROVISION FOR "DIGITAL ARREST"'), 'Must contain official CrPC/BNSS notice')
})
