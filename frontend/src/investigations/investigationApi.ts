import { API_BASE_URL } from '../services/apiBaseUrl'

export type InvestigationStatus = 'open' | 'in_progress' | 'resolved'
export type InvestigationEventType =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'note'
  | 'evidence_added'
  | 'evidence_removed'

export interface Investigation {
  id: string
  user_id: string
  title: string
  description: string
  status: InvestigationStatus
  created_at: string
  updated_at: string
}

export interface InvestigationEvent {
  id: string
  investigation_id: string
  event_type: InvestigationEventType
  summary: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface InvestigationEvidence {
  id: string
  investigation_id: string
  file_name: string
  object_path: string
  mime_type: string
  size_bytes: number
  sha256: string
  created_at: string
}

export interface InvestigationDetail extends Investigation {
  events: InvestigationEvent[]
  evidence: InvestigationEvidence[]
}

export interface InvestigationInsight {
  summary: string
  referencedEventIds: string[]
  referencedEvidenceIds: string[]
  openQuestions: string[]
  recommendations: string[]
}

export class InvestigationApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'InvestigationApiError'
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isInvestigation(value: unknown): value is Investigation {
  return isRecord(value) &&
    isString(value.id) &&
    isString(value.user_id) &&
    isString(value.title) &&
    isString(value.description) &&
    ['open', 'in_progress', 'resolved'].includes(String(value.status)) &&
    isString(value.created_at) &&
    isString(value.updated_at)
}

function isEvent(value: unknown): value is InvestigationEvent {
  return isRecord(value) &&
    isString(value.id) &&
    isString(value.investigation_id) &&
    ['created', 'updated', 'status_changed', 'note', 'evidence_added', 'evidence_removed']
      .includes(String(value.event_type)) &&
    isString(value.summary) &&
    isRecord(value.metadata) &&
    isString(value.created_at)
}

function isEvidence(value: unknown): value is InvestigationEvidence {
  return isRecord(value) &&
    isString(value.id) &&
    isString(value.investigation_id) &&
    isString(value.file_name) &&
    isString(value.object_path) &&
    isString(value.mime_type) &&
    typeof value.size_bytes === 'number' &&
    isString(value.sha256) &&
    isString(value.created_at)
}

function isDetail(value: unknown): value is InvestigationDetail {
  return isInvestigation(value) &&
    isRecord(value) &&
    Array.isArray(value.events) && value.events.every(isEvent) &&
    Array.isArray(value.evidence) && value.evidence.every(isEvidence)
}

function isInsight(value: unknown): value is InvestigationInsight {
  const isStringArray = (entry: unknown): entry is string[] =>
    Array.isArray(entry) && entry.every(isString)
  return isRecord(value) &&
    isString(value.summary) &&
    isStringArray(value.referencedEventIds) &&
    isStringArray(value.referencedEvidenceIds) &&
    isStringArray(value.openQuestions) &&
    isStringArray(value.recommendations)
}

async function request(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
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
      throw new InvestigationApiError('The investigation service returned an unreadable response.', response.status)
    }
    if (!isRecord(body)) {
      throw new InvestigationApiError('The investigation service returned an invalid response.', response.status)
    }
    if (!response.ok) {
      throw new InvestigationApiError(
        isString(body.message) ? body.message : `The request failed (${response.status}).`,
        response.status,
      )
    }
    if (body.success !== true) {
      throw new InvestigationApiError('The investigation service did not confirm the requested operation.', response.status)
    }
    return body
  } catch (error) {
    if (error instanceof InvestigationApiError) throw error
    if (controller.signal.aborted) {
      throw new InvestigationApiError('The investigation request timed out. Try again.')
    }
    throw new InvestigationApiError('The investigation service could not be reached.')
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function listInvestigations(accessToken: string): Promise<Investigation[]> {
  const result = await request('/api/investigations', accessToken)
  if (!Array.isArray(result.investigations) || !result.investigations.every(isInvestigation)) {
    throw new InvestigationApiError('The investigation list had an invalid format.')
  }
  return result.investigations
}

export async function getInvestigation(accessToken: string, id: string): Promise<InvestigationDetail> {
  const result = await request(`/api/investigations/${encodeURIComponent(id)}`, accessToken)
  if (!isDetail(result.investigation)) {
    throw new InvestigationApiError('The investigation detail had an invalid format.')
  }
  return result.investigation
}

export async function createInvestigation(
  accessToken: string,
  input: { title: string; description: string },
): Promise<Investigation> {
  const result = await request('/api/investigations', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!isInvestigation(result.investigation)) {
    throw new InvestigationApiError('The created investigation had an invalid format.')
  }
  return result.investigation
}

export async function updateInvestigation(
  accessToken: string,
  id: string,
  input: Partial<Pick<Investigation, 'title' | 'description' | 'status'>>,
): Promise<Investigation> {
  const result = await request(`/api/investigations/${encodeURIComponent(id)}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  if (!isInvestigation(result.investigation)) {
    throw new InvestigationApiError('The updated investigation had an invalid format.')
  }
  return result.investigation
}

export async function deleteInvestigation(accessToken: string, id: string): Promise<void> {
  await request(`/api/investigations/${encodeURIComponent(id)}`, accessToken, { method: 'DELETE' })
}

export async function addInvestigationNote(
  accessToken: string,
  id: string,
  summary: string,
): Promise<InvestigationEvent> {
  const result = await request(`/api/investigations/${encodeURIComponent(id)}/notes`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ summary }),
  })
  if (!isEvent(result.event)) {
    throw new InvestigationApiError('The saved note had an invalid format.')
  }
  return result.event
}

export async function addInvestigationEvidence(
  accessToken: string,
  id: string,
  input: {
    id: string
    fileName: string
    objectPath: string
    mimeType: string
    sizeBytes: number
    sha256: string
  },
): Promise<InvestigationEvidence> {
  const result = await request(`/api/investigations/${encodeURIComponent(id)}/evidence`, accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!isEvidence(result.evidence)) {
    throw new InvestigationApiError('The evidence record had an invalid format.')
  }
  return result.evidence
}

export async function deleteInvestigationEvidence(
  accessToken: string,
  id: string,
  evidenceId: string,
): Promise<void> {
  await request(
    `/api/investigations/${encodeURIComponent(id)}/evidence/${encodeURIComponent(evidenceId)}`,
    accessToken,
    { method: 'DELETE' },
  )
}

export async function analyzeInvestigation(
  accessToken: string,
  id: string,
): Promise<{ status: 'available'; insight: InvestigationInsight } | { status: 'unavailable'; reason: string }> {
  const result = await request(`/api/investigations/${encodeURIComponent(id)}/analyze`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ allowExternalAnalysis: true }),
  })
  if (!isRecord(result.analysis)) {
    throw new InvestigationApiError('The AI analysis response had an invalid format.')
  }
  if (result.analysis.status === 'unavailable' && isString(result.analysis.reason)) {
    return { status: 'unavailable', reason: result.analysis.reason }
  }
  if (result.analysis.status === 'available' && isInsight(result.analysis.insight)) {
    return { status: 'available', insight: result.analysis.insight }
  }
  throw new InvestigationApiError('The AI analysis response had an invalid format.')
}
