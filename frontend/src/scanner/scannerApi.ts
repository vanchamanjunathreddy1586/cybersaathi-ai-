import { API_BASE_URL } from '../services/apiBaseUrl'

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
  const isAnalyzeResponse = (value: unknown): value is {
    success: boolean
    report: ScanReport
    historySaved: boolean
    persistenceErrorCode?: string
  } => isObject(value) &&
    value.success === true &&
    isScanReport(value.report) &&
    typeof value.historySaved === 'boolean' &&
    (value.persistenceErrorCode === undefined || typeof value.persistenceErrorCode === 'string')
  const response = await request('/api/scanner/analyze', accessToken, isAnalyzeResponse, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return response
}

export async function getScanHistory(
  accessToken: string,
  options: { limit?: number; offset?: number; type?: ScanType } = {},
): Promise<ScanHistoryRecord[]> {
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
}

export async function getScan(
  accessToken: string,
  scanId: string,
): Promise<ScanHistoryRecord> {
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
}

export async function deleteScan(accessToken: string, scanId: string): Promise<void> {
  const response = await request(
    `/api/scanner/history/${encodeURIComponent(scanId)}`,
    accessToken,
    (value): value is { success: boolean } => isObject(value) && value.success === true,
    { method: 'DELETE' },
  )
  if (!response.success) throw new ScannerApiError('The scan could not be deleted.')
}
