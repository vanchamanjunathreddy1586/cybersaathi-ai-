import ApkReader from '@devicefarmer/adbkit-apkreader';
import {
  PERMISSION_CATALOG,
  SUSPICIOUS_PERMISSION_CLUSTERS,
  type PermissionCategory,
  type PermissionSeverity,
  type PermissionDefinition,
} from './permission-catalog.js';
import { validateApkArchive, type ArchiveValidationResult } from './safe-archive.validator.js';
import { checkThreatReputation, type ReputationProviderResult } from '../security-center/threat-intelligence.service.js';
import { logger } from '../../utils/logger.js';
import { getUserSupabaseClient } from '../../config/supabase.js';

export interface AppFinding {
  id: string;
  title: string;
  detail: string;
  severity: PermissionSeverity;
  category: string;
  source: string;
  verified: boolean;
  points: number;
}

export interface PermissionAuditItem {
  permission: string;
  shortName: string;
  category: PermissionCategory;
  severity: PermissionSeverity;
  protectionLevel: string;
  explanation: string;
  potentialAbuse: string;
  legitimateUseCases: string;
  recommendedAction: string;
}

export interface CertificateInfo {
  issuer?: string | undefined;
  subject?: string | undefined;
  validFrom?: string | undefined;
  validTo?: string | undefined;
  signatureAlgorithm?: string | undefined;
  fingerprintSha256?: string | undefined;
  isSelfSigned?: boolean | undefined;
  status: 'valid' | 'expired' | 'debug_key' | 'unknown';
}

export interface ComponentSecuritySummary {
  totalActivities: number;
  exportedActivities: number;
  totalServices: number;
  exportedServices: number;
  totalReceivers: number;
  exportedReceivers: number;
  totalProviders: number;
  exportedProviders: number;
  unprotectedExportedCount: number;
}

export interface ApkSecurityReport {
  scanId?: string | undefined;
  fileName: string;
  fileSizeBytes: number;
  sha256: string;
  packageName: string;
  appLabel: string;
  versionName: string;
  versionCode: string;
  minSdkVersion: number | null;
  targetSdkVersion: number | null;
  riskScore: number;
  riskLevel: 'Low Risk' | 'Medium Risk' | 'High Risk' | 'Critical Risk';
  verdict: 'Likely Safe' | 'Suspicious' | 'Likely Malicious' | 'Inconclusive';
  confidence: number;
  confidenceLevel: 'Low' | 'Medium' | 'High';
  declaredPermissions: PermissionAuditItem[];
  findings: AppFinding[];
  componentsSummary: ComponentSecuritySummary;
  manifestConfigurations: {
    debuggable: boolean;
    allowBackup: boolean;
    usesCleartextTraffic: boolean;
  };
  certificateInfo: CertificateInfo;
  threatReputation: {
    checked: boolean;
    provider?: string | undefined;
    status?: string | undefined;
    detail?: string | undefined;
    checkedAt?: string | undefined;
    malicious?: number | undefined;
    suspicious?: number | undefined;
  };
  matchedClusters: Array<{ title: string; description: string; severity: PermissionSeverity }>;
  recommendations: string[];
  limitations: string[];
  analyzedAt: string;
}

export class AppScannerService {
  /**
   * Performs an end-to-end static security analysis of an uploaded Android APK file.
   */
  public async analyzeApk(
    filePath: string,
    originalFileName: string,
    options?: { checkThreatIntel?: boolean },
  ): Promise<ApkSecurityReport> {
    const analyzedAt = new Date().toISOString();

    // 1. Validate archive integrity, file size, ZIP bombs, and ZipSlip path traversal
    const archiveResult: ArchiveValidationResult = await validateApkArchive(filePath);

    // 2. Open APK with adbkit-apkreader (safe streaming without file extraction)
    const reader = await ApkReader.open(filePath);
    let manifest: any;
    try {
      manifest = await reader.readManifest();
    } catch (manifestErr) {
      logger.warn('Failed to parse AndroidManifest.xml binary format', {
        errorType: manifestErr instanceof Error ? manifestErr.name : 'UnknownError',
      });
      throw new Error('CORRUPT_MANIFEST: Unable to decode Android binary XML structure.');
    }

    if (!manifest || typeof manifest !== 'object') {
      throw new Error('INVALID_MANIFEST: Manifest root object is invalid.');
    }

    // 3. Extract core identification
    const packageName = String(manifest.package || 'unknown.package');
    const appLabel = String(manifest.application?.label || manifest.application?.name || packageName);
    const versionName = String(manifest.versionName || '1.0');
    const versionCode = String(manifest.versionCode || '1');
    const minSdkVersion = manifest.usesSdk?.minSdkVersion ? Number(manifest.usesSdk.minSdkVersion) : null;
    const targetSdkVersion = manifest.usesSdk?.targetSdkVersion ? Number(manifest.usesSdk.targetSdkVersion) : null;

    // 4. Manifest Security Flags
    const debuggable = Boolean(manifest.application?.debuggable === true || manifest.application?.debuggable === 'true');
    const allowBackup = manifest.application?.allowBackup !== false && manifest.application?.allowBackup !== 'false';
    const usesCleartextTraffic = Boolean(manifest.application?.usesCleartextTraffic === true || manifest.application?.usesCleartextTraffic === 'true');

    // 5. Component Exposure Audit
    const componentsSummary = this.auditComponents(manifest.application);

    // 6. Permission Audit & Classification
    const declaredPermissions = this.auditPermissions(manifest.usesPermissions);

    // 7. Signing Certificate Audit
    const certificateInfo = await this.auditCertificates(reader);

    // 8. Threat Intelligence Lookup
    let threatReputation: ApkSecurityReport['threatReputation'] = { checked: false };
    if (options?.checkThreatIntel !== false) {
      try {
        const intel = await checkThreatReputation('hash', archiveResult.sha256);
        const vtProvider = intel.providers.find((p: ReputationProviderResult) => p.name === 'VirusTotal');
        threatReputation = {
          checked: true,
          provider: 'VirusTotal',
          status: vtProvider?.status || intel.determination,
          detail: vtProvider?.detail || intel.confidence,
          checkedAt: intel.checkedAt,
          malicious: (vtProvider as any)?.malicious ?? 0,
          suspicious: (vtProvider as any)?.suspicious ?? 0,
        };
      } catch (intelErr) {
        logger.warn('Optional file hash threat intelligence query skipped or unavailable', {
          errorType: intelErr instanceof Error ? intelErr.name : 'UnknownError',
        });
        threatReputation = {
          checked: true,
          provider: 'VirusTotal',
          status: 'unavailable',
          detail: 'Threat intelligence lookup was unavailable or rate-limited.',
          checkedAt: new Date().toISOString(),
        };
      }
    }

    // 9. Risk Scoring & Findings Engine
    const { riskScore, riskLevel, verdict, confidence, confidenceLevel, findings, matchedClusters, recommendations } =
      this.evaluateRisk({
        declaredPermissions,
        componentsSummary,
        debuggable,
        allowBackup,
        usesCleartextTraffic,
        minSdkVersion,
        targetSdkVersion,
        certificateInfo,
        threatReputation,
      });

    const limitations = [
      'Static analysis evaluates declared manifest configuration; it cannot prove whether sensitive code paths are dynamically executed at runtime.',
      'Applications may dynamically load secondary code via reflection, DexClassLoader, or native C/C++ libraries (.so) not reflected in the manifest.',
      'Clean threat intelligence reputation indicates absence of known signatures in threat databases, not a guarantee of total safety.',
      'Dangerous permissions require interactive user consent at runtime on Android 6.0+ devices.',
    ];

    return {
      fileName: originalFileName,
      fileSizeBytes: archiveResult.fileSizeBytes,
      sha256: archiveResult.sha256,
      packageName,
      appLabel,
      versionName,
      versionCode,
      minSdkVersion,
      targetSdkVersion,
      riskScore,
      riskLevel,
      verdict,
      confidence,
      confidenceLevel,
      declaredPermissions,
      findings,
      componentsSummary,
      manifestConfigurations: {
        debuggable,
        allowBackup,
        usesCleartextTraffic,
      },
      certificateInfo,
      threatReputation,
      matchedClusters,
      recommendations,
      limitations,
      analyzedAt,
    };
  }

  /**
   * Persists an APK security report to the Supabase database for an authenticated user.
   */
  public async saveScanResult(
    accessToken: string,
    userId: string,
    report: ApkSecurityReport,
  ): Promise<string> {
    const client = getUserSupabaseClient(accessToken);
    const { data, error } = await client
      .from('app_scans')
      .insert({
        user_id: userId,
        file_name: report.fileName,
        file_size_bytes: report.fileSizeBytes,
        sha256: report.sha256,
        package_name: report.packageName,
        app_label: report.appLabel,
        version_name: report.versionName,
        version_code: report.versionCode,
        min_sdk: report.minSdkVersion,
        target_sdk: report.targetSdkVersion,
        risk_score: report.riskScore,
        risk_level: report.riskLevel,
        verdict: report.verdict,
        declared_permissions: report.declaredPermissions,
        findings: report.findings,
        components_summary: report.componentsSummary,
        threat_reputation: report.threatReputation,
        recommendations: report.recommendations,
      })
      .select('id')
      .single();

    if (error) {
      logger.warn('Failed to persist app scan result to database', {
        errorType: error.message,
      });
      throw new Error('SCAN_PERSISTENCE_FAILED');
    }

    return data.id;
  }

  /**
   * Lists historical APK scans for an authenticated user.
   */
  public async listUserScans(accessToken: string): Promise<any[]> {
    const client = getUserSupabaseClient(accessToken);
    const { data, error } = await client
      .from('app_scans')
      .select('id, file_name, package_name, app_label, risk_score, risk_level, verdict, sha256, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error('APP_SCANS_LIST_FAILED');
    }

    return data || [];
  }

  /**
   * Retrieves a single historical app scan by ID.
   */
  public async getScanById(accessToken: string, scanId: string): Promise<any | null> {
    const client = getUserSupabaseClient(accessToken);
    const { data, error } = await client
      .from('app_scans')
      .select('*')
      .eq('id', scanId)
      .maybeSingle();

    if (error) {
      throw new Error('APP_SCAN_DETAIL_FAILED');
    }

    return data;
  }

  // --- INTERNAL ANALYSIS HELPERS ---

  private auditPermissions(rawPermissions: any): PermissionAuditItem[] {
    if (!Array.isArray(rawPermissions)) return [];

    const result: PermissionAuditItem[] = [];
    const seen = new Set<string>();

    for (const item of rawPermissions) {
      const name = typeof item === 'string' ? item : item?.name;
      if (!name || typeof name !== 'string' || seen.has(name)) continue;
      seen.add(name);

      const catalogDef: PermissionDefinition | undefined = PERMISSION_CATALOG[name];
      if (catalogDef) {
        result.push({
          permission: name,
          shortName: catalogDef.shortName,
          category: catalogDef.category,
          severity: catalogDef.severity,
          protectionLevel: catalogDef.protectionLevel,
          explanation: catalogDef.explanation,
          potentialAbuse: catalogDef.potentialAbuse,
          legitimateUseCases: catalogDef.legitimateUseCases,
          recommendedAction: catalogDef.recommendedAction,
        });
      } else {
        // Unknown or custom declared permission
        const isCustom = !name.startsWith('android.permission.');
        result.push({
          permission: name,
          shortName: name.split('.').pop() || name,
          category: isCustom ? 'Other sensitive permissions' : 'Other sensitive permissions',
          severity: isCustom ? 'low' : 'medium',
          protectionLevel: 'normal',
          explanation: isCustom
            ? 'Custom application-defined permission.'
            : 'Standard Android framework permission.',
          potentialAbuse: 'Requires inspection in context of application design.',
          legitimateUseCases: 'Application-specific inter-process communication.',
          recommendedAction: 'Verify vendor documentation for custom permissions.',
        });
      }
    }

    // Sort by severity (critical > high > medium > low)
    const severityRank: Record<PermissionSeverity, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return result.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
  }

  private auditComponents(appObj: any): ComponentSecuritySummary {
    if (!appObj || typeof appObj !== 'object') {
      return {
        totalActivities: 0,
        exportedActivities: 0,
        totalServices: 0,
        exportedServices: 0,
        totalReceivers: 0,
        exportedReceivers: 0,
        totalProviders: 0,
        exportedProviders: 0,
        unprotectedExportedCount: 0,
      };
    }

    const checkList = (items: any) => {
      if (!Array.isArray(items)) return { total: 0, exported: 0, unprotected: 0 };
      let exported = 0;
      let unprotected = 0;
      for (const item of items) {
        const isExported = item.exported === true || item.exported === 'true';
        if (isExported) {
          exported += 1;
          if (!item.permission) {
            unprotected += 1;
          }
        }
      }
      return { total: items.length, exported, unprotected };
    };

    const acts = checkList(appObj.activities);
    const servs = checkList(appObj.services);
    const recvs = checkList(appObj.receivers);
    const provs = checkList(appObj.providers);

    return {
      totalActivities: acts.total,
      exportedActivities: acts.exported,
      totalServices: servs.total,
      exportedServices: servs.exported,
      totalReceivers: recvs.total,
      exportedReceivers: recvs.exported,
      totalProviders: provs.total,
      exportedProviders: provs.exported,
      unprotectedExportedCount: acts.unprotected + servs.unprotected + recvs.unprotected + provs.unprotected,
    };
  }

  private async auditCertificates(reader: any): Promise<CertificateInfo> {
    try {
      const certs = await reader.readCertificate();
      if (!Array.isArray(certs) || certs.length === 0) {
        return { status: 'unknown' };
      }

      const primary = certs[0];
      const issuer = primary.issuer ? JSON.stringify(primary.issuer) : undefined;
      const subject = primary.subject ? JSON.stringify(primary.subject) : undefined;
      const validFrom = primary.validFrom ? new Date(primary.validFrom).toISOString() : undefined;
      const validTo = primary.validTo ? new Date(primary.validTo).toISOString() : undefined;
      const signatureAlgorithm = primary.signatureAlgorithm || 'SHA256withRSA';

      const isDebugKey =
        (issuer && issuer.toLowerCase().includes('androiddebugkey')) ||
        (subject && subject.toLowerCase().includes('androiddebugkey'));

      let status: CertificateInfo['status'] = 'valid';
      if (isDebugKey) {
        status = 'debug_key';
      } else if (primary.validTo && new Date(primary.validTo) < new Date()) {
        status = 'expired';
      }

      return {
        issuer,
        subject,
        validFrom,
        validTo,
        signatureAlgorithm,
        isSelfSigned: issuer === subject,
        status,
      };
    } catch {
      return { status: 'unknown' };
    }
  }

  private evaluateRisk(input: {
    declaredPermissions: PermissionAuditItem[];
    componentsSummary: ComponentSecuritySummary;
    debuggable: boolean;
    allowBackup: boolean;
    usesCleartextTraffic: boolean;
    minSdkVersion: number | null;
    targetSdkVersion: number | null;
    certificateInfo: CertificateInfo;
    threatReputation: ApkSecurityReport['threatReputation'];
  }) {
    let score = 0;
    const findings: AppFinding[] = [];
    const recommendations: string[] = [];
    const matchedClusters: ApkSecurityReport['matchedClusters'] = [];

    // 1. Permission scoring with non-linear saturation
    const permNames = new Set(input.declaredPermissions.map((p) => p.permission));

    const criticalPerms = input.declaredPermissions.filter((p) => p.severity === 'critical');
    const highPerms = input.declaredPermissions.filter((p) => p.severity === 'high');
    const mediumPerms = input.declaredPermissions.filter((p) => p.severity === 'medium');

    const criticalPoints = Math.min(criticalPerms.length * 10, 35);
    const highPoints = Math.min(highPerms.length * 5, 20);
    const mediumPoints = Math.min(mediumPerms.length * 2, 10);

    score += criticalPoints + highPoints + mediumPoints;

    if (criticalPerms.length > 0) {
      findings.push({
        id: 'critical_permissions_declared',
        title: `${criticalPerms.length} Critical Permission(s) Declared`,
        detail: `The application requests critical Android capabilities: ${criticalPerms.map((p) => p.shortName).join(', ')}.`,
        severity: 'critical',
        category: 'Permissions',
        source: 'Manifest Analysis',
        verified: true,
        points: criticalPoints,
      });
      recommendations.push('Review whether critical capabilities like Accessibility, SMS, or Notification Listener are strictly necessary.');
    }

    if (highPerms.length > 0) {
      findings.push({
        id: 'high_permissions_declared',
        title: `${highPerms.length} High-Risk Permission(s) Declared`,
        detail: `Requests sensitive data access: ${highPerms.map((p) => p.shortName).join(', ')}.`,
        severity: 'high',
        category: 'Permissions',
        source: 'Manifest Analysis',
        verified: true,
        points: highPoints,
      });
    }

    // 2. Suspicious Permission Clusters (Loan shark extortion, Banking overlay, SMS bot)
    for (const cluster of SUSPICIOUS_PERMISSION_CLUSTERS) {
      const allMatched = cluster.requiredPermissions.every((req) => {
        if (Array.isArray(req)) {
          return req.some((r) => permNames.has(r));
        }
        return permNames.has(req);
      });

      if (allMatched) {
        score += cluster.riskWeight;
        matchedClusters.push({
          title: cluster.title,
          description: cluster.description,
          severity: cluster.severity,
        });
        findings.push({
          id: `cluster_${cluster.id}`,
          title: `Suspicious Pattern: ${cluster.title}`,
          detail: cluster.description,
          severity: cluster.severity,
          category: 'Behavioral Pattern',
          source: 'Permission Cluster Engine',
          verified: true,
          points: cluster.riskWeight,
        });
        recommendations.push(`Alert: This APK requests a permission cluster characteristic of ${cluster.title}. Exercise extreme caution before installing.`);
      }
    }

    // 3. Debuggable Application
    if (input.debuggable) {
      score += 20;
      findings.push({
        id: 'manifest_debuggable_enabled',
        title: 'Application is Debuggable (android:debuggable="true")',
        detail: 'The app is marked debuggable in its manifest. Anyone with physical or ADB access can attach a debugger, extract memory, dump cryptographic keys, and bypass security controls.',
        severity: 'critical',
        category: 'Manifest Configuration',
        source: 'Manifest Analysis',
        verified: true,
        points: 20,
      });
      recommendations.push('Disable android:debuggable="true" in production release builds.');
    }

    // 4. Cleartext Network Traffic
    if (input.usesCleartextTraffic) {
      score += 10;
      findings.push({
        id: 'manifest_cleartext_traffic',
        title: 'Cleartext HTTP Traffic Allowed',
        detail: 'The application explicitly permits unencrypted HTTP network communication (android:usesCleartextTraffic="true"), exposing sensitive data to eavesdropping and MITM attacks.',
        severity: 'medium',
        category: 'Network Security',
        source: 'Manifest Analysis',
        verified: true,
        points: 10,
      });
      recommendations.push('Enforce HTTPS and configure an Android Network Security Config file.');
    }

    // 5. Allow Backup Flag
    if (input.allowBackup) {
      score += 5;
      findings.push({
        id: 'manifest_allow_backup',
        title: 'Application Data Backup Enabled (android:allowBackup="true")',
        detail: 'Allows users and attackers with ADB shell access to extract local application databases and preferences via adb backup.',
        severity: 'low',
        category: 'Manifest Configuration',
        source: 'Manifest Analysis',
        verified: true,
        points: 5,
      });
      recommendations.push('Consider setting android:allowBackup="false" if the application stores sensitive session tokens.');
    }

    // 6. Component Exposure
    if (input.componentsSummary.unprotectedExportedCount > 0) {
      const compPoints = Math.min(input.componentsSummary.unprotectedExportedCount * 4, 15);
      score += compPoints;
      findings.push({
        id: 'exported_components_unprotected',
        title: `${input.componentsSummary.unprotectedExportedCount} Unprotected Exported Component(s)`,
        detail: `The APK exposes ${input.componentsSummary.unprotectedExportedCount} activities, services, or receivers to other third-party apps on the device without requiring an android:permission guard.`,
        severity: 'medium',
        category: 'Component Exposure',
        source: 'Manifest Analysis',
        verified: true,
        points: compPoints,
      });
      recommendations.push('Explicitly set android:exported="false" on private components or apply permission attributes.');
    }

    // 7. Outdated Target SDK
    if (input.targetSdkVersion !== null && input.targetSdkVersion < 31) {
      score += 10;
      findings.push({
        id: 'outdated_target_sdk',
        title: `Outdated Target SDK (${input.targetSdkVersion})`,
        detail: `Targeting SDK ${input.targetSdkVersion} bypasses modern Android privacy safeguards such as explicit component export requirements, notification runtime permissions, and Scoped Storage.`,
        severity: 'medium',
        category: 'Platform Security',
        source: 'Manifest Analysis',
        verified: true,
        points: 10,
      });
      recommendations.push('Update targetSdkVersion to Android 14+ (API Level 34).');
    }

    // 8. Debug Signing Key
    if (input.certificateInfo.status === 'debug_key') {
      score += 15;
      findings.push({
        id: 'debug_signing_certificate',
        title: 'Signed with Android Debug Certificate',
        detail: 'The APK is signed with a generic Android debug key (androiddebugkey) instead of a certified developer release key.',
        severity: 'high',
        category: 'Code Signing',
        source: 'Certificate Inspection',
        verified: true,
        points: 15,
      });
      recommendations.push('Sign production packages with a secured developer release keystore.');
    }

    // 9. External Threat Intelligence Corroboration
    if (input.threatReputation.status === 'threat_found') {
      const mal = input.threatReputation.malicious || 0;
      if (mal >= 5) {
        score = Math.max(score, 88);
      } else {
        score = Math.max(score, 65);
      }
      findings.push({
        id: 'threat_intel_match',
        title: `VirusTotal Flagged Binary (${mal} Detections)`,
        detail: input.threatReputation.detail || 'VirusTotal reported malicious detections for this APK hash.',
        severity: 'critical',
        category: 'Threat Intelligence',
        source: 'VirusTotal',
        verified: true,
        points: 35,
      });
    }

    // Clamp score to 0..100
    score = Math.min(Math.max(score, 0), 100);

    // Determine Risk Level & Verdict
    let riskLevel: ApkSecurityReport['riskLevel'];
    let verdict: ApkSecurityReport['verdict'];

    if (score >= 75) {
      riskLevel = 'Critical Risk';
      verdict = input.threatReputation.status === 'threat_found' ? 'Likely Malicious' : 'Suspicious';
    } else if (score >= 50) {
      riskLevel = 'High Risk';
      verdict = 'Suspicious';
    } else if (score >= 25) {
      riskLevel = 'Medium Risk';
      verdict = 'Suspicious';
    } else {
      riskLevel = 'Low Risk';
      verdict = 'Likely Safe';
    }

    // Confidence Level
    const confidence = input.threatReputation.checked && input.threatReputation.status !== 'unavailable' ? 90 : 75;
    const confidenceLevel: ApkSecurityReport['confidenceLevel'] = confidence >= 85 ? 'High' : 'Medium';

    if (recommendations.length === 0) {
      recommendations.push('The APK exhibits standard Android security practices based on static analysis.');
    }

    return {
      riskScore: score,
      riskLevel,
      verdict,
      confidence,
      confidenceLevel,
      findings,
      matchedClusters,
      recommendations,
    };
  }
}

export const appScannerService = new AppScannerService();
