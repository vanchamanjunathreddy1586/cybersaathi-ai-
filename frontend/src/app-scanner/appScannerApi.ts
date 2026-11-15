import { API_BASE_URL } from '../services/apiBaseUrl.ts'

export type PermissionSeverity = 'low' | 'medium' | 'high' | 'critical'

export type PermissionCategory =
  | 'Contacts'
  | 'SMS'
  | 'Call logs and telephony'
  | 'Microphone'
  | 'Camera'
  | 'Location'
  | 'Storage and media'
  | 'Accessibility'
  | 'Notification access'
  | 'Device administration'
  | 'Network'
  | 'Other sensitive permissions'

export interface PermissionAuditItem {
  permission: string
  shortName: string
  category: PermissionCategory
  severity: PermissionSeverity
  protectionLevel: string
  explanation: string
  potentialAbuse: string
  legitimateUseCases: string
  recommendedAction: string
}

export interface AppFinding {
  id: string
  title: string
  detail: string
  severity: PermissionSeverity
  category: string
  source: string
  verified: boolean
  points: number
}

export interface ComponentSecuritySummary {
  totalActivities: number
  exportedActivities: number
  totalServices: number
  exportedServices: number
  totalReceivers: number
  exportedReceivers: number
  totalProviders: number
  exportedProviders: number
  unprotectedExportedCount: number
}

export interface CertificateInfo {
  issuer?: string
  subject?: string
  validFrom?: string
  validTo?: string
  signatureAlgorithm?: string
  fingerprintSha256?: string
  isSelfSigned?: boolean
  status: 'valid' | 'expired' | 'debug_key' | 'unknown'
}

export interface ApkSecurityReport {
  scanId?: string
  fileName: string
  fileSizeBytes: number
  sha256: string
  packageName: string
  appLabel: string
  versionName: string
  versionCode: string
  minSdkVersion: number | null
  targetSdkVersion: number | null
  riskScore: number
  riskLevel: 'Low Risk' | 'Medium Risk' | 'High Risk' | 'Critical Risk'
  verdict: 'Likely Safe' | 'Suspicious' | 'Likely Malicious' | 'Inconclusive'
  confidence: number
  confidenceLevel: 'Low' | 'Medium' | 'High'
  declaredPermissions: PermissionAuditItem[]
  findings: AppFinding[]
  componentsSummary: ComponentSecuritySummary
  manifestConfigurations: {
    debuggable: boolean
    allowBackup: boolean
    usesCleartextTraffic: boolean
  }
  certificateInfo: CertificateInfo
  threatReputation: {
    checked: boolean
    provider?: string
    status?: string
    detail?: string
    checkedAt?: string
    malicious?: number
    suspicious?: number
  }
  matchedClusters: Array<{ title: string; description: string; severity: PermissionSeverity }>
  recommendations: string[]
  limitations: string[]
  analyzedAt: string
}

export interface AppScanHistoryItem {
  id: string
  file_name: string
  package_name: string
  app_label: string
  risk_score: number
  risk_level: string
  verdict: string
  sha256: string
  created_at: string
}

export class AppScannerApiError extends Error {
  readonly status?: number
  readonly code?: string

  constructor(message: string, status?: number, code?: string) {
    super(message)
    this.name = 'AppScannerApiError'
    this.status = status
    this.code = code
  }
}

/**
 * Uploads an APK file to the backend for static analysis.
 */
export async function uploadAndAnalyzeApk(
  file: File,
  consentThreatIntel: boolean,
  accessToken?: string,
): Promise<ApkSecurityReport> {
  const formData = new FormData()
  formData.append('apk', file, file.name)
  formData.append('consentThreatIntel', String(consentThreatIntel))

  const headers: Record<string, string> = {}
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 60_000)

  try {
    const response = await fetch(`${API_BASE_URL}/api/app-scanner/analyze`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
      credentials: 'omit',
    })

    let json: unknown
    try {
      json = await response.json()
    } catch {
      throw new AppScannerApiError('The analyzer service returned an unreadable response.', response.status)
    }

    if (!response.ok) {
      const errObj = json as { message?: string; code?: string }
      const message = errObj?.message || `APK analysis failed with status ${response.status}.`
      throw new AppScannerApiError(message, response.status, errObj?.code)
    }

    const result = json as { success: boolean; data: ApkSecurityReport }
    return result.data
  } catch (err) {
    if (err instanceof AppScannerApiError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AppScannerApiError('Analysis timed out. The APK file may be too complex or large to process.', 408, 'TIMEOUT')
    }
    throw new AppScannerApiError(err instanceof Error ? err.message : 'Network error during APK analysis.')
  } finally {
    window.clearTimeout(timeout)
  }
}

/**
 * Fetches recent APK scan history for an authenticated user.
 */
export async function fetchUserAppScans(accessToken: string): Promise<AppScanHistoryItem[]> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(`${API_BASE_URL}/api/app-scanner/history`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
      credentials: 'omit',
    })

    if (!response.ok) {
      throw new AppScannerApiError('Failed to fetch past scans.', response.status)
    }

    const json = (await response.json()) as { success: boolean; data: AppScanHistoryItem[] }
    return json.data || []
  } finally {
    window.clearTimeout(timeout)
  }
}

interface RawAppScanRow {
  id: string
  file_name: string
  file_size_bytes: number
  sha256: string
  package_name: string
  app_label: string
  version_name: string
  version_code: string
  min_sdk: number | null
  target_sdk: number | null
  risk_score: number
  risk_level: 'Low Risk' | 'Medium Risk' | 'High Risk' | 'Critical Risk'
  verdict: 'Likely Safe' | 'Suspicious' | 'Likely Malicious' | 'Inconclusive'
  declared_permissions?: PermissionAuditItem[]
  findings?: AppFinding[]
  components_summary?: ComponentSecuritySummary
  threat_reputation?: ApkSecurityReport['threatReputation']
  recommendations?: string[]
  created_at: string
}

/**
 * Fetches a single historical APK scan report by ID.
 */
export async function fetchAppScanById(scanId: string, accessToken: string): Promise<ApkSecurityReport> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(`${API_BASE_URL}/api/app-scanner/scans/${encodeURIComponent(scanId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
      credentials: 'omit',
    })

    if (!response.ok) {
      throw new AppScannerApiError('Failed to fetch scan detail.', response.status)
    }

    const json = (await response.json()) as { success: boolean; data: RawAppScanRow }
    const raw = json.data
    return {
      scanId: raw.id,
      fileName: raw.file_name,
      fileSizeBytes: raw.file_size_bytes,
      sha256: raw.sha256,
      packageName: raw.package_name,
      appLabel: raw.app_label,
      versionName: raw.version_name,
      versionCode: raw.version_code,
      minSdkVersion: raw.min_sdk,
      targetSdkVersion: raw.target_sdk,
      riskScore: raw.risk_score,
      riskLevel: raw.risk_level,
      verdict: raw.verdict,
      confidence: 85,
      confidenceLevel: 'High',
      declaredPermissions: raw.declared_permissions || [],
      findings: raw.findings || [],
      componentsSummary: raw.components_summary || {
        totalActivities: 0,
        exportedActivities: 0,
        totalServices: 0,
        exportedServices: 0,
        totalReceivers: 0,
        exportedReceivers: 0,
        totalProviders: 0,
        exportedProviders: 0,
        unprotectedExportedCount: 0,
      },
      manifestConfigurations: {
        debuggable: false,
        allowBackup: true,
        usesCleartextTraffic: false,
      },
      certificateInfo: {
        status: 'unknown',
      },
      threatReputation: raw.threat_reputation || { checked: false },
      matchedClusters: [],
      recommendations: raw.recommendations || [],
      limitations: [
        'Static manifest analysis reflects declared capabilities, not verified runtime behavior.',
        'Obfuscated or dynamically downloaded native payloads require dynamic sandbox evaluation.',
      ],
      analyzedAt: raw.created_at,
    }
  } finally {
    window.clearTimeout(timeout)
  }
}

/**
 * Generates an executive Markdown report suitable for export or printing.
 */
export function generateReportMarkdown(report: ApkSecurityReport): string {
  const criticalPerms = report.declaredPermissions.filter((p) => p.severity === 'critical')
  const highPerms = report.declaredPermissions.filter((p) => p.severity === 'high')

  return `# CYBERSAATHI AI — ANDROID APK STATIC SECURITY AUDIT REPORT
Generated: ${new Date(report.analyzedAt).toUTCString()}

## EXECUTIVE SUMMARY
- Application Label: ${report.appLabel}
- Package Name: ${report.packageName}
- Version: ${report.versionName} (Code: ${report.versionCode})
- SHA-256 Hash: \`${report.sha256}\`
- File Size: ${(report.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
- Risk Score: ${report.riskScore} / 100 (${report.riskLevel.toUpperCase()})
- Security Verdict: ${report.verdict.toUpperCase()}
- Analysis Confidence: ${report.confidence}% (${report.confidenceLevel})

---

## MANIFEST & PLATFORM POSTURE
- Target SDK: ${report.targetSdkVersion ?? 'Not specified'} ${report.targetSdkVersion !== null && report.targetSdkVersion < 31 ? '[OUTDATED - Lacks modern privacy limits]' : '[Modern]'}
- Minimum SDK: ${report.minSdkVersion ?? 'Not specified'}
- Debuggable: ${report.manifestConfigurations.debuggable ? 'YES [CRITICAL HAZARD]' : 'No'}
- Unencrypted Cleartext Traffic: ${report.manifestConfigurations.usesCleartextTraffic ? 'ALLOWED [RISK]' : 'Blocked / Default'}
- Application Backup Allowed: ${report.manifestConfigurations.allowBackup ? 'YES' : 'Disabled'}

---

## SIGNING CERTIFICATE
- Status: ${report.certificateInfo.status.toUpperCase()}
- Self-Signed: ${report.certificateInfo.isSelfSigned ? 'Yes' : 'No'}
- Algorithm: ${report.certificateInfo.signatureAlgorithm || 'Unknown'}
- Issuer: ${report.certificateInfo.issuer || 'Unknown'}
- Subject: ${report.certificateInfo.subject || 'Unknown'}
- Valid Period: ${report.certificateInfo.validFrom || 'N/A'} to ${report.certificateInfo.validTo || 'N/A'}

---

## THREAT INTELLIGENCE REPUTATION
- Provider: ${report.threatReputation.provider || 'VirusTotal'}
- Checked: ${report.threatReputation.checked ? 'Yes' : 'No (user opted out or provider unconfigured)'}
- Status: ${report.threatReputation.status || 'N/A'}
- Detail: ${report.threatReputation.detail || 'N/A'}
${report.threatReputation.malicious !== undefined ? `- Detections: ${report.threatReputation.malicious} engines flagged malicious` : ''}

---

## SUSPICIOUS PERMISSION CLUSTERS (${report.matchedClusters.length})
${
  report.matchedClusters.length === 0
    ? '_No predatory or trojan-like permission clusters detected._'
    : report.matchedClusters
        .map((c) => `### ⚠️ ${c.title} (${c.severity.toUpperCase()})\n${c.description}`)
        .join('\n\n')
}

---

## KEY SECURITY FINDINGS (${report.findings.length})
${
  report.findings.length === 0
    ? '_No high or critical security findings identified._'
    : report.findings
        .map(
          (f, idx) =>
            `${idx + 1}. [${f.severity.toUpperCase()}] **${f.title}** (${f.category})\n   ${f.detail}`,
        )
        .join('\n\n')
}

---

## DECLARED PERMISSIONS SUMMARY (${report.declaredPermissions.length} total)
- Critical: ${criticalPerms.length}
- High: ${highPerms.length}
- Medium: ${report.declaredPermissions.filter((p) => p.severity === 'medium').length}
- Low / Normal: ${report.declaredPermissions.filter((p) => p.severity === 'low').length}

### High & Critical Permissions Detail:
${
  [...criticalPerms, ...highPerms].length === 0
    ? '_None declared._'
    : [...criticalPerms, ...highPerms]
        .map(
          (p) =>
            `- **${p.shortName}** (\`${p.permission}\`) [${p.severity.toUpperCase()}]\n  - *Category:* ${p.category}\n  - *Abuse Potential:* ${p.potentialAbuse}\n  - *Legitimate Use:* ${p.legitimateUseCases}\n  - *Recommendation:* ${p.recommendedAction}`,
        )
        .join('\n\n')
}

---

## RECOMMENDATIONS
${
  report.recommendations.length === 0
    ? '- Keep Android OS and Google Play Protect updated on your device.'
    : report.recommendations.map((r) => `- ${r}`).join('\n')
}

---

## STATIC ANALYSIS LIMITATIONS & DISCLAIMER
${report.limitations.map((l) => `- ${l}`).join('\n')}
- *Disclaimer:* This static security analysis does not guarantee the presence or absence of malicious runtime behavior. Always install applications from official app stores like Google Play.
`
}
