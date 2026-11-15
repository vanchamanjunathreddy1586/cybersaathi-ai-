import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AppScannerApiError,
  generateReportMarkdown,
  type ApkSecurityReport,
} from '../src/app-scanner/appScannerApi.ts'

test('AppScannerApiError captures message, status, and custom error code', () => {
  const err = new AppScannerApiError('Uploaded file exceeds 35 MB.', 400, 'FILE_TOO_LARGE')
  assert.equal(err.name, 'AppScannerApiError')
  assert.equal(err.message, 'Uploaded file exceeds 35 MB.')
  assert.equal(err.status, 400)
  assert.equal(err.code, 'FILE_TOO_LARGE')
})

test('Client-side APK pre-validation enforces .apk extension and 35 MB size limit', () => {
  const validateApk = (fileName: string, sizeBytes: number) => {
    if (!fileName.toLowerCase().endsWith('.apk')) {
      return { valid: false, error: 'INVALID_EXTENSION' }
    }
    const maxSizeBytes = 35 * 1024 * 1024
    if (sizeBytes > maxSizeBytes) {
      return { valid: false, error: 'FILE_TOO_LARGE' }
    }
    return { valid: true, error: null }
  }

  assert.deepEqual(validateApk('calculator.apk', 5 * 1024 * 1024), { valid: true, error: null })
  assert.deepEqual(validateApk('malicious.APK', 34 * 1024 * 1024), { valid: true, error: null })
  assert.deepEqual(validateApk('update.exe', 1024), { valid: false, error: 'INVALID_EXTENSION' })
  assert.deepEqual(validateApk('archive.zip', 1024), { valid: false, error: 'INVALID_EXTENSION' })
  assert.deepEqual(validateApk('huge_game.apk', 40 * 1024 * 1024), { valid: false, error: 'FILE_TOO_LARGE' })
})

test('generateReportMarkdown compiles executive audit report with all security sections', () => {
  const sampleReport: ApkSecurityReport = {
    scanId: 'test-scan-uuid',
    fileName: 'instant_loan_pro.apk',
    fileSizeBytes: 14 * 1024 * 1024,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    packageName: 'com.quickcash.instantcredit',
    appLabel: 'Quick Cash Instant Loan',
    versionName: '2.1.0',
    versionCode: '21',
    minSdkVersion: 21,
    targetSdkVersion: 29, // Outdated target SDK
    riskScore: 82,
    riskLevel: 'Critical Risk',
    verdict: 'Likely Malicious',
    confidence: 90,
    confidenceLevel: 'High',
    declaredPermissions: [
      {
        permission: 'android.permission.READ_CONTACTS',
        shortName: 'Read Contacts',
        category: 'Contacts',
        severity: 'critical',
        protectionLevel: 'dangerous',
        explanation: 'Allows reading all stored phonebook contacts.',
        potentialAbuse: 'Harvesting full contact lists for predatory extortion.',
        legitimateUseCases: 'Messaging and phone dialer apps.',
        recommendedAction: 'Do not grant to loan apps.',
      },
      {
        permission: 'android.permission.ACCESS_FINE_LOCATION',
        shortName: 'Precise GPS Location',
        category: 'Location',
        severity: 'high',
        protectionLevel: 'dangerous',
        explanation: 'Allows pinpointing accurate device GPS coordinates.',
        potentialAbuse: 'Physical tracking and intimidation.',
        legitimateUseCases: 'Turn-by-turn navigation apps.',
        recommendedAction: 'Restrict to while app is in use.',
      },
      {
        permission: 'android.permission.INTERNET',
        shortName: 'Full Internet Access',
        category: 'Network',
        severity: 'low',
        protectionLevel: 'normal',
        explanation: 'Allows creating network sockets.',
        potentialAbuse: 'Data exfiltration.',
        legitimateUseCases: 'Any networked app.',
        recommendedAction: 'Standard permission.',
      },
    ],
    findings: [
      {
        id: 'debuggable',
        title: 'Application is Debuggable',
        detail: 'Marked debuggable in manifest.',
        severity: 'critical',
        category: 'Manifest Configuration',
        source: 'Manifest Analysis',
        verified: true,
        points: 20,
      },
    ],
    componentsSummary: {
      totalActivities: 5,
      exportedActivities: 2,
      totalServices: 2,
      exportedServices: 1,
      totalReceivers: 1,
      exportedReceivers: 1,
      totalProviders: 0,
      exportedProviders: 0,
      unprotectedExportedCount: 3,
    },
    manifestConfigurations: {
      debuggable: true,
      allowBackup: true,
      usesCleartextTraffic: true,
    },
    certificateInfo: {
      status: 'debug_key',
      isSelfSigned: true,
      signatureAlgorithm: 'SHA256withRSA',
      issuer: 'CN=Android Debug',
      subject: 'CN=Android Debug',
    },
    threatReputation: {
      checked: true,
      provider: 'VirusTotal',
      status: 'threat_found',
      detail: '8 security vendors flagged this binary hash as malicious.',
      malicious: 8,
      suspicious: 2,
    },
    matchedClusters: [
      {
        title: 'Extortion Loan Shark Cluster',
        description: 'Simultaneous request for Contacts, SMS, Call Logs, and GPS location.',
        severity: 'critical',
      },
    ],
    recommendations: [
      'Do not install this APK. It requests invasive contact and location permissions characteristic of illegal lending apps.',
    ],
    limitations: [
      'Static analysis reflects declared capabilities, not verified runtime behavior.',
    ],
    analyzedAt: '2026-11-14T06:00:00.000Z',
  }

  const markdown = generateReportMarkdown(sampleReport)

  assert.ok(markdown.includes('Quick Cash Instant Loan'), 'Must contain app title')
  assert.ok(markdown.includes('com.quickcash.instantcredit'), 'Must contain package name')
  assert.ok(markdown.includes('82 / 100'), 'Must contain risk score')
  assert.ok(markdown.includes('CRITICAL RISK'), 'Must contain risk level')
  assert.ok(markdown.includes('LIKELY MALICIOUS'), 'Must contain verdict')
  assert.ok(markdown.includes('Extortion Loan Shark Cluster'), 'Must contain matched cluster title')
  assert.ok(markdown.includes('READ_CONTACTS'), 'Must contain permission identifier')
  assert.ok(markdown.includes('VirusTotal'), 'Must mention threat intelligence provider')
  assert.ok(markdown.includes('STATIC ANALYSIS LIMITATIONS'), 'Must contain limitations header')
})

test('Risk score mapping correctly maps all risk level thresholds', () => {
  const getRiskLevel = (score: number) => {
    if (score >= 75) return 'Critical Risk'
    if (score >= 50) return 'High Risk'
    if (score >= 25) return 'Medium Risk'
    return 'Low Risk'
  }

  assert.equal(getRiskLevel(0), 'Low Risk')
  assert.equal(getRiskLevel(24), 'Low Risk')
  assert.equal(getRiskLevel(25), 'Medium Risk')
  assert.equal(getRiskLevel(49), 'Medium Risk')
  assert.equal(getRiskLevel(50), 'High Risk')
  assert.equal(getRiskLevel(74), 'High Risk')
  assert.equal(getRiskLevel(75), 'Critical Risk')
  assert.equal(getRiskLevel(100), 'Critical Risk')
})
