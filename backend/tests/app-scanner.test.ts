import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Server } from 'node:http';
import {
  validateApkArchive,
  ArchiveSecurityError,
} from '../src/services/app-scanner/safe-archive.validator.js';
import {
  PERMISSION_CATALOG,
  SUSPICIOUS_PERMISSION_CLUSTERS,
} from '../src/services/app-scanner/permission-catalog.js';
import { AppScannerService } from '../src/services/app-scanner/app-scanner.service.js';
import { createApp } from '../src/app.js';

// Helper to construct in-memory ZIP archive buffers
function crc32(buf: Buffer): number {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]!;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
    }
  }
  return (~crc) >>> 0;
}

function createZipBuffer(entries: Array<{ name: string; content: Buffer | string }>): Buffer {
  const parts: Buffer[] = [];
  const cdEntries: Buffer[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const dataBuf = Buffer.isBuffer(e.content) ? e.content : Buffer.from(e.content, 'utf8');
    const crc = crc32(dataBuf);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(0, 8); // stored
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(dataBuf.length, 18);
    lh.writeUInt32LE(dataBuf.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    parts.push(lh, nameBuf, dataBuf);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(dataBuf.length, 20);
    cd.writeUInt32LE(dataBuf.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    cdEntries.push(cd, nameBuf);
    offset += 30 + nameBuf.length + dataBuf.length;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const b of cdEntries) cdSize += b.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, ...cdEntries, eocd]);
}

test('safe-archive validator rejects non-zip files with INVALID_ZIP', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apk-test-'));
  const testFile = path.join(tmpDir, 'corrupt.apk');
  try {
    await fs.writeFile(testFile, Buffer.from('This is definitely not a zip file archive.'));
    await assert.rejects(
      async () => validateApkArchive(testFile),
      (err: any) => {
        assert.ok(err instanceof ArchiveSecurityError);
        assert.equal(err.code, 'INVALID_ZIP_HEADER');
        return true;
      },
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('safe-archive validator rejects archives missing AndroidManifest.xml', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apk-test-'));
  const testFile = path.join(tmpDir, 'no-manifest.apk');
  try {
    const zipBuf = createZipBuffer([
      { name: 'classes.dex', content: 'dummy dex bytecode content' },
      { name: 'resources.arsc', content: 'dummy resource table' },
    ]);
    await fs.writeFile(testFile, zipBuf);
    await assert.rejects(
      async () => validateApkArchive(testFile),
      (err: any) => {
        assert.ok(err instanceof ArchiveSecurityError);
        assert.equal(err.code, 'MISSING_MANIFEST');
        return true;
      },
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('safe-archive validator rejects ZipSlip path traversal entries', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apk-test-'));
  const testFile = path.join(tmpDir, 'zipslip.apk');
  try {
    const zipBuf = createZipBuffer([
      { name: 'AndroidManifest.xml', content: 'dummy manifest' },
      { name: '../../etc/passwd', content: 'malicious path traversal payload' },
    ]);
    await fs.writeFile(testFile, zipBuf);
    await assert.rejects(
      async () => validateApkArchive(testFile),
      (err: any) => {
        assert.ok(err instanceof ArchiveSecurityError);
        assert.equal(err.code, 'PATH_TRAVERSAL_DETECTED');
        return true;
      },
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('safe-archive validator accepts valid archive with AndroidManifest.xml and computes SHA-256', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apk-test-'));
  const testFile = path.join(tmpDir, 'valid.apk');
  try {
    const zipBuf = createZipBuffer([
      { name: 'AndroidManifest.xml', content: 'dummy binary manifest' },
      { name: 'classes.dex', content: 'bytecode data' },
    ]);
    await fs.writeFile(testFile, zipBuf);
    const result = await validateApkArchive(testFile);
    assert.equal(result.totalEntries, 2);
    assert.ok(result.sha256 && result.sha256.length === 64, 'SHA-256 must be 64-char hex');
    assert.equal(result.fileSizeBytes, zipBuf.length);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('permission catalog defines comprehensive metadata across sensitive categories', () => {
  const criticalPermissions = [
    'android.permission.BIND_ACCESSIBILITY_SERVICE',
    'android.permission.RECEIVE_SMS',
    'android.permission.READ_SMS',
    'android.permission.SEND_SMS',
    'android.permission.SYSTEM_ALERT_WINDOW',
    'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
  ];

  for (const perm of criticalPermissions) {
    const def = PERMISSION_CATALOG[perm];
    assert.ok(def, `Catalog must define ${perm}`);
    assert.equal(def.severity, 'critical');
    assert.ok(def.potentialAbuse.length > 10, 'Must have detailed abuse explanation');
    assert.ok(def.legitimateUseCases.length > 5, 'Must have legitimate use cases');
    assert.ok(def.recommendedAction.length > 5, 'Must have recommended action');
  }

  // Verify categories exist
  const categories = new Set(Object.values(PERMISSION_CATALOG).map((p) => p.category));
  assert.ok(categories.has('SMS'));
  assert.ok(categories.has('Contacts'));
  assert.ok(categories.has('Location'));
  assert.ok(categories.has('Camera'));
  assert.ok(categories.has('Microphone'));
  assert.ok(categories.has('Accessibility'));
});

test('suspicious permission clusters detect predatory loan app, banking overlay, and SMS bot combinations', () => {
  const clusterIds = SUSPICIOUS_PERMISSION_CLUSTERS.map((c) => c.id);
  assert.ok(clusterIds.includes('predatory_loan_shark'));
  assert.ok(clusterIds.includes('banking_trojan_overlay'));
  assert.ok(clusterIds.includes('sms_interception_bot'));

  // Predatory loan cluster required permissions
  const loanCluster = SUSPICIOUS_PERMISSION_CLUSTERS.find((c) => c.id === 'predatory_loan_shark')!;
  assert.equal(loanCluster.severity, 'critical');
  assert.ok(loanCluster.riskWeight >= 20);
});

test('appScannerService audits permissions, components, and evaluates risk score accurately', () => {
  const service = new AppScannerService();

  // Test permission auditing and ranking
  const rawPerms = [
    'android.permission.INTERNET',
    'android.permission.READ_CONTACTS',
    'android.permission.BIND_ACCESSIBILITY_SERVICE',
    'android.permission.ACCESS_FINE_LOCATION',
  ];

  // Access private auditPermissions via any cast for unit testing
  const audited = (service as any).auditPermissions(rawPerms);
  assert.equal(audited.length, 4);
  assert.equal(audited[0].severity, 'critical'); // BIND_ACCESSIBILITY_SERVICE ranked first
  assert.equal(audited[audited.length - 1].severity, 'low'); // INTERNET ranked last

  // Test component auditing
  const rawApp = {
    activities: [
      { exported: true }, // unprotected exported
      { exported: false },
      { exported: true, permission: 'com.example.CUSTOM_GUARD' }, // protected exported
    ],
    services: [
      { exported: true }, // unprotected exported
    ],
  };

  const compSummary = (service as any).auditComponents(rawApp);
  assert.equal(compSummary.totalActivities, 3);
  assert.equal(compSummary.exportedActivities, 2);
  assert.equal(compSummary.unprotectedExportedCount, 2);

  // Test risk evaluation logic
  const evalResult = (service as any).evaluateRisk({
    declaredPermissions: audited,
    componentsSummary: compSummary,
    debuggable: true,
    allowBackup: true,
    usesCleartextTraffic: true,
    minSdkVersion: 23,
    targetSdkVersion: 28, // Outdated target SDK
    certificateInfo: {
      status: 'debug_key',
    },
    threatReputation: { checked: false },
  });

  assert.ok(evalResult.riskScore >= 70, 'High risk app must receive high score');
  assert.equal(evalResult.riskLevel, 'Critical Risk');
  assert.ok(evalResult.findings.some((f: any) => f.id === 'manifest_debuggable_enabled'));
  assert.ok(evalResult.findings.some((f: any) => f.id === 'manifest_cleartext_traffic'));
  assert.ok(evalResult.findings.some((f: any) => f.id === 'outdated_target_sdk'));
  assert.ok(evalResult.findings.some((f: any) => f.id === 'debug_signing_certificate'));
});

test('app scanner HTTP endpoints enforce file presence, extensions, and auth protection', async () => {
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. POST without file returns 400 MISSING_FILE
    const resNoFile = await fetch(`${baseUrl}/api/app-scanner/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary123' },
      body: '------WebKitFormBoundary123--\r\n',
    });
    assert.equal(resNoFile.status, 400);
    const bodyNoFile = (await resNoFile.json()) as any;
    assert.equal(bodyNoFile.code, 'MISSING_FILE');

    // 2. GET /history unauthenticated returns 401
    const resHistory = await fetch(`${baseUrl}/api/app-scanner/history`, {
      method: 'GET',
    });
    assert.equal(resHistory.status, 401);
    const bodyHistory = (await resHistory.json()) as any;
    assert.equal(bodyHistory.success, false);
    assert.equal(bodyHistory.message, 'Authentication required.');

    // 3. GET /scans/:id unauthenticated returns 401
    const resScanDetail = await fetch(`${baseUrl}/api/app-scanner/scans/dummy-scan-id`, {
      method: 'GET',
    });
    assert.equal(resScanDetail.status, 401);
    const bodyScanDetail = (await resScanDetail.json()) as any;
    assert.equal(bodyScanDetail.success, false);
    assert.equal(bodyScanDetail.message, 'Authentication required.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
