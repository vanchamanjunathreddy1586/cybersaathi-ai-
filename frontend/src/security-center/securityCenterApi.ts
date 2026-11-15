import { API_BASE_URL } from '../services/apiBaseUrl'

export type PeriodDays = 7 | 30 | 90 | 365
export type AlertSeverity = 'medium' | 'high' | 'critical'

export interface SecurityAlert {
  id: string
  category: 'suspicious_url' | 'high_risk_scan' | 'investigation_update' | 'evidence_added'
  severity: AlertSeverity
  title: string
  summary: string
  entity_type: 'scan' | 'investigation'
  entity_id: string
  read_at: string | null
  created_at: string
}

export interface NotificationPreferences {
  critical_alerts: boolean
  high_risk_alerts: boolean
  investigation_updates: boolean
  community_notifications: boolean
  learning_reminders: boolean
  browser_notifications: boolean
}

export interface SecurityDashboard {
  generatedAt: string
  days: number
  start: string
  summary: {
    totalScans: number
    safeScans: number
    suspiciousScans: number
    maliciousScans: number
    inconclusiveScans: number
    activeInvestigations: number
    openInvestigations: number
    inProgressInvestigations: number
    resolvedInvestigations: number
    lessonsCompleted: number
    lessonsInSelectedPeriodMayBeTruncated: boolean
  }
  activity: { date: string; scans: number; investigations: number; lessons: number }[]
  chartGranularity: 'day' | 'month'
  riskDistribution: { name: string; value: number }[]
  investigationDistribution: { name: string; value: number }[]
  observations: {
    title: string
    category: string
    count: number
    verified: number
    basis: string
    lessonId: string | null
  }[]
  recentEvents: {
    id: string
    kind: 'scan' | 'investigation' | 'learning'
    title: string
    detail: string
    created_at: string
    severity: string
  }[]
  alerts: SecurityAlert[]
  unreadAlertCount: number
  dataLimits: { truncated: boolean; chartRecordLimit: number }
  communityActivity: { available: boolean; reason: string }
}

export interface ProviderConfiguration {
  name: string
  configured: boolean
}

export interface WebPushConfiguration {
  configured: boolean
  publicKey: string | null
}

export interface ScorePillar {
  id: string
  name: string
  score: number
  maxScore: number
  status: 'good' | 'fair' | 'needs_improvement'
  signals: string[]
}

export interface ScoreRecommendation {
  id: string
  title: string
  pointsPotential: number
  actionUrl: string
  actionLabel: string
  description: string
  category: string
}

export interface SafetyScoreResult {
  score: number
  tier: 'Vulnerable' | 'Moderate' | 'Strong' | 'Fortified'
  grade: 'A+' | 'A' | 'B' | 'C' | 'D'
  summary: string
  pillars: ScorePillar[]
  recommendations: ScoreRecommendation[]
  stats: {
    totalScans: number
    appScans: number
    callScans: number
    lessonsCompleted: number
    activeCases: number
    unresolvedAlerts: number
  }
  computedAt: string
}

export interface ProviderHealthItem {
  id: string
  name: string
  status: 'operational' | 'degraded' | 'unconfigured' | 'offline'
  configured: boolean
  circuitState?: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  description: string
  latencyMs?: number
}

export interface IndiaThreatVector {
  id: string
  name: string
  severity: 'critical' | 'high' | 'medium'
  trend: 'rising' | 'stable' | 'monitoring'
  activeModusOperandi: string
  commonTargetPlatforms: string[]
  recommendedDefense: string
  advisoryReference?: string
}

export interface SocOverviewData {
  timestamp: string
  uptimeSeconds: number
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'ATTENTION_REQUIRED'
  providers: ProviderHealthItem[]
  threatTelemetry: IndiaThreatVector[]
  systemMetrics: {
    totalRequests: number
    totalRateLimitBlocks: number
    activeQueues: Array<{
      name: string
      activeWorkers: number
      queueDepth: number
      totalProcessed: number
    }>
  }
}

export interface ThreatResult {
  indicator: string
  type: 'url' | 'domain' | 'hash'
  checkedAt: string
  determination: 'threat_found' | 'no_match' | 'inconclusive'
  confidence: string
  providers: {
    name: string
    status: 'threat_found' | 'no_match' | 'unavailable'
    detail: string
    evidence?: string[]
    malicious?: number
    suspicious?: number
  }[]
  findings: {
    title: string
    detail: string
    source: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    verified: boolean
  }[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isAlert(value: unknown): value is SecurityAlert {
  if (!isRecord(value)) return false
  return isString(value.id) &&
    ['suspicious_url', 'high_risk_scan', 'investigation_update', 'evidence_added'].includes(String(value.category)) &&
    ['medium', 'high', 'critical'].includes(String(value.severity)) &&
    isString(value.title) && isString(value.summary) &&
    ['scan', 'investigation'].includes(String(value.entity_type)) &&
    isString(value.entity_id) &&
    (value.read_at === null || isString(value.read_at)) &&
    isString(value.created_at)
}

function isPreferences(value: unknown): value is NotificationPreferences {
  return isRecord(value) &&
    typeof value.critical_alerts === 'boolean' &&
    typeof value.high_risk_alerts === 'boolean' &&
    typeof value.investigation_updates === 'boolean' &&
    typeof value.community_notifications === 'boolean' &&
    typeof value.learning_reminders === 'boolean' &&
    typeof value.browser_notifications === 'boolean'
}

function isDashboard(value: unknown): value is SecurityDashboard {
  if (!isRecord(value) || !isRecord(value.summary) || !isRecord(value.dataLimits) ||
      !isRecord(value.communityActivity)) return false
  const summary = value.summary
  return isString(value.generatedAt) && isNumber(value.days) && isString(value.start) &&
    [
      summary.totalScans, summary.safeScans, summary.suspiciousScans, summary.maliciousScans,
      summary.inconclusiveScans, summary.activeInvestigations, summary.openInvestigations,
      summary.inProgressInvestigations, summary.resolvedInvestigations, summary.lessonsCompleted,
    ].every(isNumber) &&
    typeof summary.lessonsInSelectedPeriodMayBeTruncated === 'boolean' &&
    ['day', 'month'].includes(String(value.chartGranularity)) &&
    Array.isArray(value.activity) && value.activity.every((item) =>
      isRecord(item) && isString(item.date) && isNumber(item.scans) &&
      isNumber(item.investigations) && isNumber(item.lessons)
    ) &&
    Array.isArray(value.riskDistribution) && value.riskDistribution.every((item) =>
      isRecord(item) && isString(item.name) && isNumber(item.value)
    ) &&
    Array.isArray(value.investigationDistribution) && value.investigationDistribution.every((item) =>
      isRecord(item) && isString(item.name) && isNumber(item.value)
    ) &&
    Array.isArray(value.observations) && value.observations.every((item) =>
      isRecord(item) && isString(item.title) && isString(item.category) &&
      isNumber(item.count) && isNumber(item.verified) && isString(item.basis) &&
      (item.lessonId === null || isString(item.lessonId))
    ) &&
    Array.isArray(value.recentEvents) && value.recentEvents.every((item) =>
      isRecord(item) && isString(item.id) && ['scan', 'investigation', 'learning'].includes(String(item.kind)) &&
      isString(item.title) && isString(item.detail) && isString(item.created_at) &&
      isString(item.severity)
    ) &&
    Array.isArray(value.alerts) && value.alerts.every(isAlert) &&
    isNumber(value.unreadAlertCount) &&
    typeof value.dataLimits.truncated === 'boolean' &&
    isNumber(value.dataLimits.chartRecordLimit) &&
    typeof value.communityActivity.available === 'boolean' &&
    isString(value.communityActivity.reason)
}

function isThreatResult(value: unknown): value is ThreatResult {
  if (!isRecord(value)) return false
  return isString(value.indicator) && ['url', 'domain', 'hash'].includes(String(value.type)) &&
    isString(value.checkedAt) &&
    ['threat_found', 'no_match', 'inconclusive'].includes(String(value.determination)) &&
    isString(value.confidence) && Array.isArray(value.providers) &&
    value.providers.every((provider) =>
      isRecord(provider) && isString(provider.name) &&
      ['threat_found', 'no_match', 'unavailable'].includes(String(provider.status)) &&
      isString(provider.detail) &&
      (provider.evidence === undefined || (Array.isArray(provider.evidence) && provider.evidence.every(isString))) &&
      (provider.malicious === undefined || isNumber(provider.malicious)) &&
      (provider.suspicious === undefined || isNumber(provider.suspicious))
    ) &&
    Array.isArray(value.findings) && value.findings.every((finding) =>
      isRecord(finding) && isString(finding.title) && isString(finding.detail) &&
      isString(finding.source) && ['low', 'medium', 'high', 'critical'].includes(String(finding.severity)) &&
      typeof finding.verified === 'boolean'
    )
}

async function request<T>(
  path: string,
  accessToken: string,
  parse: (value: unknown) => T,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/security-center${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      credentials: 'omit',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new Error('The security center API could not be reached. Check your connection and try again.')
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('The security center API returned an invalid response.')
  }
  if (!response.ok) {
    const message = isRecord(payload) && isString(payload.message)
      ? payload.message
      : 'The security center request could not be completed.'
    throw new Error(message)
  }
  return parse(payload)
}

function getEnvelopeData<T>(value: unknown, key: string, isExpected: (data: unknown) => data is T): T {
  if (!isRecord(value) || value.success !== true || !isExpected(value[key])) {
    throw new Error('The security center returned an invalid response.')
  }
  return value[key]
}

export function loadSecurityDashboard(accessToken: string, days: PeriodDays) {
  return request(`/dashboard?days=${days}`, accessToken, (value) =>
    getEnvelopeData(value, 'dashboard', isDashboard),
  )
}

export function loadSecurityAlerts(
  accessToken: string,
  severity: 'all' | AlertSeverity = 'all',
) {
  return request(`/alerts?severity=${severity}`, accessToken, (value) =>
    getEnvelopeData(value, 'alerts', (data): data is SecurityAlert[] =>
      Array.isArray(data) && data.every(isAlert),
    ),
  )
}

export function markAlertRead(accessToken: string, id: string) {
  return request(`/alerts/${encodeURIComponent(id)}/read`, accessToken, (value) =>
    isRecord(value) && value.success === true ? true : (() => { throw new Error('The alert could not be marked read.') })(),
    { method: 'POST', body: {} },
  )
}

export function markAllAlertsRead(accessToken: string) {
  return request('/alerts/read-all', accessToken, (value) =>
    isRecord(value) && value.success === true ? true : (() => { throw new Error('Alerts could not be marked read.') })(),
    { method: 'POST', body: {} },
  )
}

export function removeAlert(accessToken: string, id: string) {
  return request(`/alerts/${encodeURIComponent(id)}`, accessToken, (value) =>
    isRecord(value) && value.success === true ? true : (() => { throw new Error('The alert could not be deleted.') })(),
    { method: 'DELETE' },
  )
}

export function loadNotificationPreferences(accessToken: string) {
  return request('/notification-preferences', accessToken, (value) =>
    getEnvelopeData(value, 'preferences', isPreferences),
  )
}

export function saveNotificationPreferences(
  accessToken: string,
  preferences: NotificationPreferences,
) {
  return request('/notification-preferences', accessToken, (value) =>
    getEnvelopeData(value, 'preferences', isPreferences),
    { method: 'PUT', body: preferences },
  )
}

export function loadWebPushConfiguration(accessToken: string) {
  return request('/push/configuration', accessToken, (value) =>
    getEnvelopeData(value, 'push', (data): data is WebPushConfiguration =>
      isRecord(data) &&
      typeof data.configured === 'boolean' &&
      (data.publicKey === null || isString(data.publicKey)),
    ),
  )
}

export function saveWebPushSubscription(
  accessToken: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
) {
  return request('/push/subscription', accessToken, (value) =>
    isRecord(value) && value.success === true
      ? true
      : (() => { throw new Error('The push subscription could not be saved.') })(),
    { method: 'PUT', body: subscription },
  )
}

export function deleteWebPushSubscription(accessToken: string, endpoint: string) {
  return request('/push/subscription', accessToken, (value) =>
    isRecord(value) && value.success === true
      ? true
      : (() => { throw new Error('The push subscription could not be removed.') })(),
    { method: 'DELETE', body: { endpoint } },
  )
}

export function loadThreatProviders(accessToken: string) {
  return request('/threat-intelligence/providers', accessToken, (value) =>
    getEnvelopeData(value, 'providers', (data): data is ProviderConfiguration[] =>
      Array.isArray(data) && data.every((provider) =>
        isRecord(provider) && isString(provider.name) && typeof provider.configured === 'boolean'
      ),
    ),
  )
}

export function checkThreatIndicator(
  accessToken: string,
  type: 'url' | 'domain' | 'hash',
  indicator: string,
) {
  return request('/threat-intelligence/check', accessToken, (value) =>
    getEnvelopeData(value, 'result', isThreatResult),
    {
      method: 'POST',
      body: { type, indicator, shareWithProviders: true },
    },
  )
}

export function loadSafetyScore(accessToken: string): Promise<SafetyScoreResult> {
  return request('/safety-score', accessToken, (value) => {
    if (!isRecord(value) || value.success !== true || !isRecord(value.data)) {
      throw new Error('Failed to load safety score.')
    }
    return value.data as unknown as SafetyScoreResult
  })
}

export function loadSocOverview(accessToken: string): Promise<SocOverviewData> {
  return request('/soc-overview', accessToken, (value) => {
    if (!isRecord(value) || value.success !== true || !isRecord(value.data)) {
      throw new Error('Failed to load SOC overview.')
    }
    return value.data as unknown as SocOverviewData
  })
}
