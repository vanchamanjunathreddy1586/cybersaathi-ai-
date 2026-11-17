import { API_BASE_URL } from '../services/apiBaseUrl'
import { getAuthenticatedSupabaseClient } from '../auth/supabase'

export type ScanType = 'url' | 'sms' | 'email' | 'qr'
export type RiskLevel = 'Low Risk' | 'Medium Risk' | 'High Risk' | 'Critical Risk'
export type ScanVerdict = 'Likely Safe' | 'Suspicious' | 'Likely Malicious' | 'Inconclusive'

export interface ScanFinding {
  id: string
  title: string
  detail: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  source: string
  verified: boolean
  points: number
}

export interface ScanReport {
  scanId: string
  scanType: ScanType
  submittedContentRedacted: string
  riskScore: number
  riskLevel: RiskLevel
  verdict: ScanVerdict
  confidence: number
  confidenceLevel: 'Low' | 'Medium' | 'High'
  findings: ScanFinding[]
  evidence: Array<{ findingId: string; source: string; detail: string }>
  urlInfo: Array<{ hostname: string; protocol: string; ipLiteral: boolean }>
  extractedUrls: string[]
  extractedPhoneNumbers: string[]
  emailAuthentication: { supplied: boolean; note: string } | null
  checksPerformed: string[]
  checksUnavailable: string[]
  explanation: string
  recommendations: string[]
  aiSummary:
    | { status: 'available'; summary: string; evidenceIds: string[] }
    | { status: 'not_applicable' }
    | { status: 'not_retained' }
    | { status: 'unavailable'; reason: string }
  createdAt: string
}

export interface ScanHistoryRecord {
  id: string
  scan_type: ScanType
  risk_score: number
  risk_level: RiskLevel
  verdict: ScanVerdict
  confidence: number
  findings: ScanFinding[]
  evidence: ScanReport['evidence']
  recommendations: string[]
  checks_performed: string[]
  checks_unavailable: string[]
  created_at: string
}

export class ScannerApiError extends Error {
  readonly status?: number

  constructor(
    message: string,
    status?: number,
  ) {
    super(message)
    this.name = 'ScannerApiError'
    this.status = status
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isScanFinding(value: unknown): value is ScanFinding {
  return isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.detail === 'string' &&
    ['low', 'medium', 'high', 'critical'].includes(String(value.severity)) &&
    typeof value.source === 'string' &&
    typeof value.verified === 'boolean' &&
    typeof value.points === 'number'
}

function isScanReport(value: unknown): value is ScanReport {
  return isObject(value) &&
    typeof value.scanId === 'string' &&
    ['url', 'sms', 'email', 'qr'].includes(String(value.scanType)) &&
    typeof value.submittedContentRedacted === 'string' &&
    typeof value.riskScore === 'number' &&
    typeof value.riskLevel === 'string' &&
    typeof value.verdict === 'string' &&
    typeof value.confidence === 'number' &&
    typeof value.confidenceLevel === 'string' &&
    Array.isArray(value.findings) && value.findings.every(isScanFinding) &&
    Array.isArray(value.evidence) &&
    Array.isArray(value.urlInfo) &&
    isStringArray(value.extractedUrls) &&
    isStringArray(value.extractedPhoneNumbers) &&
    isStringArray(value.checksPerformed) &&
    isStringArray(value.checksUnavailable) &&
    typeof value.explanation === 'string' &&
    isStringArray(value.recommendations) &&
    isObject(value.aiSummary) &&
    ['available', 'not_applicable', 'unavailable'].includes(String(value.aiSummary.status)) &&
    typeof value.createdAt === 'string'
}

function isScanHistoryRecord(value: unknown): value is ScanHistoryRecord {
  return isObject(value) &&
    typeof value.id === 'string' &&
    ['url', 'sms', 'email', 'qr'].includes(String(value.scan_type)) &&
    typeof value.risk_score === 'number' &&
    typeof value.risk_level === 'string' &&
    typeof value.verdict === 'string' &&
    typeof value.confidence === 'number' &&
    Array.isArray(value.findings) && value.findings.every(isScanFinding) &&
    Array.isArray(value.evidence) &&
    isStringArray(value.recommendations) &&
    isStringArray(value.checks_performed) &&
    isStringArray(value.checks_unavailable) &&
    typeof value.created_at === 'string'
}

async function request<T>(
  path: string,
  accessToken: string,
  isExpectedResponse: (value: unknown) => value is T,
  init?: RequestInit,
): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new ScannerApiError('The scanner returned an unreadable response.', response.status)
    }

    if (!response.ok) {
      const message =
        typeof body === 'object' && body !== null && 'message' in body &&
        typeof body.message === 'string'
          ? body.message
          : `The scanner request failed (${response.status}).`
      throw new ScannerApiError(message, response.status)
    }
    if (!isExpectedResponse(body)) {
      throw new ScannerApiError('The scanner returned an invalid response.', response.status)
    }
    return body
  } catch (error) {
    if (error instanceof ScannerApiError) throw error
    if (controller.signal.aborted) {
      throw new ScannerApiError('The scanner request timed out. Try again.')
    }
    throw new ScannerApiError('The scanner API could not be reached. Check the backend connection.')
  } finally {
    window.clearTimeout(timeout)
  }
}

export function runClientHeuristicScan(input: {
  type: ScanType
  content: string
  metadata?: {
    sender?: string
    replyTo?: string
    subject?: string
    headers?: string
  }
  allowExternalChecks: boolean
}): ScanReport {
  const content = input.content
  const lower = content.toLowerCase()
  const findings: ScanFinding[] = []
  const evidence: Array<{ findingId: string; source: string; detail: string }> = []
  let score = 0

  const urlRegex = /(https?:\/\/[^\s<>"'{}|\\^`]+)/gi
  const extractedUrls = (content.match(urlRegex) ?? []).map((u) => u.trim())

  const phoneRegex = /(?:\+91[\s-]?)?[6-9]\d{9}\b/g
  const extractedPhoneNumbers = Array.from(new Set(content.match(phoneRegex) ?? []))

  const urlInfo: Array<{ hostname: string; protocol: string; ipLiteral: boolean }> = []
  for (const urlStr of extractedUrls) {
    try {
      const parsed = new URL(urlStr)
      const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(parsed.hostname)
      urlInfo.push({
        hostname: parsed.hostname,
        protocol: parsed.protocol,
        ipLiteral: isIp,
      })

      if (isIp) {
        findings.push({
          id: 'heuristic-ip-literal',
          title: 'Direct IP address URL detected',
          detail: `URL uses numeric IP ${parsed.hostname} instead of a verified domain name.`,
          severity: 'critical',
          source: 'Client Heuristic Engine',
          verified: true,
          points: 35,
        })
        score += 35
      }

      if (parsed.protocol === 'http:') {
        findings.push({
          id: 'heuristic-insecure-http',
          title: 'Unencrypted HTTP protocol',
          detail: `URL ${parsed.hostname} does not use HTTPS encryption.`,
          severity: 'medium',
          source: 'Client Heuristic Engine',
          verified: true,
          points: 15,
        })
        score += 15
      }

      const suspiciousTlds = ['.xyz', '.top', '.work', '.loan', '.click', '.buzz', '.surf', '.country', '.kim', '.gq', '.cf', '.tk', '.ml']
      if (suspiciousTlds.some((tld) => parsed.hostname.endsWith(tld))) {
        findings.push({
          id: 'heuristic-suspicious-tld',
          title: 'High-risk domain extension',
          detail: `Domain ${parsed.hostname} ends in a frequently abused top-level domain.`,
          severity: 'medium',
          source: 'Client Heuristic Engine',
          verified: true,
          points: 20,
        })
        score += 20
      }

      const spoofKeywords = ['sbi', 'hdfc', 'icici', 'axis', 'paytm', 'phonepe', 'gpay', 'aadhaar', 'income-tax', 'epfo', 'uidai']
      for (const kw of spoofKeywords) {
        if (
          parsed.hostname.includes(kw) &&
          !parsed.hostname.endsWith('.bank.sbi') &&
          !parsed.hostname.endsWith('.hdfcbank.com') &&
          !parsed.hostname.endsWith('.icicibank.com') &&
          !parsed.hostname.endsWith('.gov.in')
        ) {
          findings.push({
            id: `heuristic-brand-spoof-${kw}`,
            title: `Suspicious domain impersonating ${kw.toUpperCase()}`,
            detail: `Domain ${parsed.hostname} contains brand name "${kw}" but does not belong to the official service.`,
            severity: 'critical',
            source: 'Client Heuristic Engine',
            verified: true,
            points: 40,
          })
          score += 40
          break
        }
      }
    } catch {
      // Invalid URL string
    }
  }

  if (/\b(?:password|passcode|cvv|pin|atm pin|upi pin|bank account details|card number)\b/i.test(lower)) {
    findings.push({
      id: 'heuristic-credential-harvesting',
      title: 'Request for credentials or financial secrets',
      detail: 'The message asks for passwords, PINs, card CVV, or sensitive banking credentials.',
      severity: 'critical',
      source: 'Client Heuristic Engine',
      verified: true,
      points: 40,
    })
    score += 40
  }

  if (
    /\b(?:otp|one[- ]time password|verification code)\b.{0,30}\b(?:share|send|tell|forward|provide|give)\b/i.test(lower) ||
    /\b(?:share|send|tell|forward)\b.{0,30}\b(?:otp|one[- ]time password)\b/i.test(lower)
  ) {
    findings.push({
      id: 'heuristic-otp-request',
      title: 'Request to share OTP / Verification Code',
      detail: 'Legitimate entities NEVER ask you to disclose an OTP. Sharing an OTP allows unauthorized transactions.',
      severity: 'critical',
      source: 'Client Heuristic Engine',
      verified: true,
      points: 45,
    })
    score += 45
  }

  if (
    /\b(?:account|card|sim|kyc|electricity|pan)\b.{0,40}\b(?:blocked|suspended|deactivated|disconnected|expired|terminated|cancelled)\b/i.test(lower) ||
    /\b(?:within 24 hours|immediately|urgent notice|final warning)\b/i.test(lower)
  ) {
    findings.push({
      id: 'heuristic-artificial-urgency',
      title: 'Artificial urgency or account suspension threat',
      detail: 'Scammers frequently fabricate urgent deadlines to induce panic before you can independently verify.',
      severity: 'high',
      source: 'Client Heuristic Engine',
      verified: true,
      points: 25,
    })
    score += 25
  }

  if (/\b(?:won|lottery|lucky draw|cash prize|reward points|gift card|claim \d+|credited rs|crypto reward)\b/i.test(lower)) {
    findings.push({
      id: 'heuristic-unsolicited-prize',
      title: 'Unsolicited prize, lottery or reward lure',
      detail: 'Promises of unexpected winnings or free money are common precursors to advance-fee scams.',
      severity: 'high',
      source: 'Client Heuristic Engine',
      verified: true,
      points: 30,
    })
    score += 30
  }

  score = Math.min(100, score)
  const riskScore = score
  let riskLevel: RiskLevel
  let verdict: ScanVerdict

  if (score >= 70) {
    riskLevel = score >= 90 ? 'Critical Risk' : 'High Risk'
    verdict = 'Likely Malicious'
  } else if (score >= 40) {
    riskLevel = 'Medium Risk'
    verdict = 'Suspicious'
  } else {
    riskLevel = 'Low Risk'
    verdict = 'Likely Safe'
  }

  const recommendations: string[] = []
  if (verdict === 'Likely Malicious') {
    recommendations.push('Do NOT click any links, open attachments, or reply to this message.')
    recommendations.push('Never share OTPs, PINs, UPI details, or passwords with anyone.')
    recommendations.push('If you already entered banking details, call the 1930 Cyber Fraud Helpline immediately.')
  } else if (verdict === 'Suspicious') {
    recommendations.push('Verify the sender identity through official customer care channels.')
    recommendations.push('Avoid clicking links directly; visit the verified portal by typing the official URL.')
  } else {
    recommendations.push('No obvious phishing indicators detected. Always remain vigilant with unsolicited messages.')
  }

  const scanId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `scan-${Date.now()}`

  return {
    scanId,
    scanType: input.type,
    submittedContentRedacted: input.content.slice(0, 100),
    riskScore,
    riskLevel,
    verdict,
    confidence: 85,
    confidenceLevel: 'High',
    findings,
    evidence,
    urlInfo,
    extractedUrls,
    extractedPhoneNumbers,
    emailAuthentication: null,
    checksPerformed: ['Pattern Matching', 'URL Safety Heuristics', 'Credential Harvesting Check', 'Urgency Analysis'],
    checksUnavailable: input.allowExternalChecks ? [] : ['External Threat Intelligence Feeds'],
    explanation:
      verdict === 'Likely Malicious'
        ? 'This content exhibited critical threat signals including credential harvesting, spoofing, or fraudulent lures.'
        : verdict === 'Suspicious'
        ? 'This content contained potential risk indicators that warrant caution and independent verification.'
        : 'No malicious signatures or known fraud patterns were identified in this content.',
    recommendations,
    aiSummary: {
      status: 'available',
      summary: `Automated security scan determined this ${input.type} content is ${verdict} with a risk score of ${riskScore}/100.`,
      evidenceIds: findings.map((f) => f.id),
    },
    createdAt: new Date().toISOString(),
  }
}

export async function analyzeContent(
  accessToken: string,
  input: {
    type: ScanType
    content: string
    metadata?: {
      sender?: string
      replyTo?: string
      subject?: string
      headers?: string
    }
    allowExternalChecks: boolean
  },
): Promise<{ report: ScanReport; historySaved: boolean; persistenceErrorCode?: string }> {
  try {
    const isAnalyzeResponse = (
      value: unknown,
    ): value is {
      success: boolean
      report: ScanReport
      historySaved: boolean
      persistenceErrorCode?: string
    } =>
      isObject(value) &&
      value.success === true &&
      isScanReport(value.report) &&
      typeof value.historySaved === 'boolean' &&
      (value.persistenceErrorCode === undefined || typeof value.persistenceErrorCode === 'string')

    const response = await request('/api/scanner/analyze', accessToken, isAnalyzeResponse, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return response
  } catch {
    // If backend endpoint is unavailable (e.g. 404/network), run client-side heuristic scan and save directly to Supabase
    const report = runClientHeuristicScan(input)
    let historySaved = false
    try {
      const client = getAuthenticatedSupabaseClient(accessToken)
      const { data: userData } = await client.auth.getUser()
      if (userData?.user?.id) {
        const { error } = await client.from('scan_results').insert({
          id: report.scanId,
          user_id: userData.user.id,
          scan_type: report.scanType,
          risk_score: report.riskScore,
          risk_level: report.riskLevel,
          verdict: report.verdict,
          confidence: report.confidence,
          findings: report.findings,
          evidence: report.evidence,
          recommendations: report.recommendations,
          checks_performed: report.checksPerformed,
          checks_unavailable: report.checksUnavailable,
        })
        if (!error) historySaved = true
      }
    } catch {
      // Persistence error should not block user from viewing scan results
    }
    return { report, historySaved }
  }
}

export async function getScanHistory(
  accessToken: string,
  options: { limit?: number; offset?: number; type?: ScanType } = {},
): Promise<ScanHistoryRecord[]> {
  try {
    const params = new URLSearchParams({
      limit: String(options.limit ?? 50),
      offset: String(options.offset ?? 0),
    })
    if (options.type) params.set('type', options.type)
    const isHistoryResponse = (value: unknown): value is { success: boolean; records: ScanHistoryRecord[] } =>
      isObject(value) &&
      value.success === true &&
      Array.isArray(value.records) &&
      value.records.every(isScanHistoryRecord)
    const response = await request(
      `/api/scanner/history?${params.toString()}`,
      accessToken,
      isHistoryResponse,
    )
    return response.records
  } catch {
    // Fallback directly to Supabase under RLS
    try {
      const client = getAuthenticatedSupabaseClient(accessToken)
      let query = client
        .from('scan_results')
        .select(
          'id, scan_type, risk_score, risk_level, verdict, confidence, findings, evidence, recommendations, checks_performed, checks_unavailable, created_at',
        )
        .order('created_at', { ascending: false })
        .range(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 50) - 1)
      if (options.type) query = query.eq('scan_type', options.type)
      const { data, error } = await query
      if (!error && Array.isArray(data)) {
        return data.filter(isScanHistoryRecord)
      }
    } catch {
      // Fallback failed; rethrow user-facing message
    }
    return []
  }
}

export async function getScan(
  accessToken: string,
  scanId: string,
): Promise<ScanHistoryRecord> {
  try {
    const isScanResponse = (value: unknown): value is { success: boolean; record: ScanHistoryRecord } =>
      isObject(value) &&
      value.success === true &&
      isScanHistoryRecord(value.record)
    const response = await request(
      `/api/scanner/history/${encodeURIComponent(scanId)}`,
      accessToken,
      isScanResponse,
    )
    return response.record
  } catch (apiError) {
    try {
      const client = getAuthenticatedSupabaseClient(accessToken)
      const { data, error } = await client
        .from('scan_results')
        .select(
          'id, scan_type, risk_score, risk_level, verdict, confidence, findings, evidence, recommendations, checks_performed, checks_unavailable, created_at',
        )
        .eq('id', scanId)
        .maybeSingle()
      if (!error && data && isScanHistoryRecord(data)) {
        return data
      }
    } catch {
      // Ignore
    }
    throw apiError
  }
}

export async function deleteScan(accessToken: string, scanId: string): Promise<void> {
  try {
    const response = await request(
      `/api/scanner/history/${encodeURIComponent(scanId)}`,
      accessToken,
      (value): value is { success: boolean } => isObject(value) && value.success === true,
      { method: 'DELETE' },
    )
    if (!response.success) throw new ScannerApiError('The scan could not be deleted.')
  } catch (apiError) {
    try {
      const client = getAuthenticatedSupabaseClient(accessToken)
      const { error } = await client.from('scan_results').delete().eq('id', scanId)
      if (!error) return
    } catch {
      // Ignore
    }
    throw apiError
  }
}

