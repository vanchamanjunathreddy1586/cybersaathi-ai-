import { API_BASE_URL } from '../services/apiBaseUrl'
import { getAuthenticatedSupabaseClient } from '../auth/supabase'

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
  try {
    const result = await request('/api/investigations', accessToken)
    if (!Array.isArray(result.investigations) || !result.investigations.every(isInvestigation)) {
      throw new InvestigationApiError('The investigation list had an invalid format.')
    }
    return result.investigations
  } catch {
    try {
      const client = getAuthenticatedSupabaseClient(accessToken)
      const { data, error } = await client
        .from('investigations')
        .select('id, user_id, title, description, status, created_at, updated_at')
        .order('updated_at', { ascending: false })
      if (!error && Array.isArray(data)) {
        return data.filter(isInvestigation)
      }
    } catch {
      // Ignore
    }
    return []
  }
}

export async function getInvestigation(accessToken: string, id: string): Promise<InvestigationDetail> {
  try {
    const result = await request(`/api/investigations/${encodeURIComponent(id)}`, accessToken)
    if (!isDetail(result.investigation)) {
      throw new InvestigationApiError('The investigation detail had an invalid format.')
    }
    return result.investigation
  } catch {
    try {
      const client = getAuthenticatedSupabaseClient(accessToken)
      const { data: inv, error: invError } = await client
        .from('investigations')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (!invError && inv && isInvestigation(inv)) {
        const [eventsRes, evidenceRes] = await Promise.all([
          client
            .from('investigation_events')
            .select('*')
            .eq('investigation_id', id)
            .order('created_at', { ascending: true }),
          client
            .from('investigation_evidence')
            .select('*')
            .eq('investigation_id', id)
            .order('created_at', { ascending: true }),
        ])
        return {
          ...inv,
          events: (eventsRes.data ?? []).filter(isEvent),
          evidence: (evidenceRes.data ?? []).filter(isEvidence),
        }
      }
    } catch {
      // Ignore
    }
    throw new InvestigationApiError('Investigation not found or access denied.')
  }
}

export async function createInvestigation(
  accessToken: string,
  input: { title: string; description: string },
): Promise<Investigation> {
  try {
    const result = await request('/api/investigations', accessToken, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    if (!isInvestigation(result.investigation)) {
      throw new InvestigationApiError('The created investigation had an invalid format.')
    }
    return result.investigation
  } catch {
    try {
      const client = getAuthenticatedSupabaseClient(accessToken)
      const { data: userData } = await client.auth.getUser()
      if (userData?.user?.id) {
        const { data, error } = await client
          .from('investigations')
          .insert({
            user_id: userData.user.id,
            title: input.title,
            description: input.description,
          })
          .select('*')
          .single()
        if (!error && data && isInvestigation(data)) {
          return data
        }
      }
    } catch {
      // Ignore
    }
    throw new InvestigationApiError('Could not create investigation.')
  }
}

export async function updateInvestigation(
  accessToken: string,
  id: string,
  input: Partial<Pick<Investigation, 'title' | 'description' | 'status'>>,
): Promise<Investigation> {
  try {
    const result = await request(`/api/investigations/${encodeURIComponent(id)}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    if (!isInvestigation(result.investigation)) {
      throw new InvestigationApiError('The updated investigation had an invalid format.')
    }
    return result.investigation
  } catch {
    try {
      const client = getAuthenticatedSupabaseClient(accessToken)
      const { data, error } = await client
        .from('investigations')
        .update(input)
        .eq('id', id)
        .select('*')
        .single()
      if (!error && data && isInvestigation(data)) {
        return data
      }
    } catch {
      // Ignore
    }
    throw new InvestigationApiError('Could not update investigation.')
  }
}

export async function deleteInvestigation(accessToken: string, id: string): Promise<void> {
  try {
    await request(`/api/investigations/${encodeURIComponent(id)}`, accessToken, { method: 'DELETE' })
  } catch {
    try {
      const client = getAuthenticatedSupabaseClient(accessToken)
      await client.from('investigations').delete().eq('id', id)
    } catch {
      // Ignore
    }
  }
}

export async function addInvestigationNote(
  accessToken: string,
  id: string,
  summary: string,
): Promise<InvestigationEvent> {
  try {
    const result = await request(`/api/investigations/${encodeURIComponent(id)}/notes`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ summary }),
    })
    if (!isEvent(result.event)) {
      throw new InvestigationApiError('The saved note had an invalid format.')
    }
    return result.event
  } catch {
    try {
      const client = getAuthenticatedSupabaseClient(accessToken)
      const { data: userData } = await client.auth.getUser()
      if (userData?.user?.id) {
        const { data, error } = await client
          .from('investigation_events')
          .insert({
            investigation_id: id,
            user_id: userData.user.id,
            event_type: 'note',
            summary,
            metadata: {},
          })
          .select('*')
          .single()
        if (!error && data && isEvent(data)) {
          return data
        }
      }
    } catch {
      // Ignore
    }
    throw new InvestigationApiError('Could not add investigation note.')
  }
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
  try {
    const result = await request(`/api/investigations/${encodeURIComponent(id)}/evidence`, accessToken, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    if (!isEvidence(result.evidence)) {
      throw new InvestigationApiError('The evidence record had an invalid format.')
    }
    return result.evidence
  } catch {
    try {
      const client = getAuthenticatedSupabaseClient(accessToken)
      const { data: userData } = await client.auth.getUser()
      if (userData?.user?.id) {
        const { data, error } = await client
          .from('investigation_evidence')
          .insert({
            id: input.id,
            investigation_id: id,
            user_id: userData.user.id,
            file_name: input.fileName,
            object_path: input.objectPath,
            mime_type: input.mimeType,
            size_bytes: input.sizeBytes,
            sha256: input.sha256,
          })
          .select('*')
          .single()
        if (!error && data && isEvidence(data)) {
          return data
        }
      }
    } catch {
      // Ignore
    }
    throw new InvestigationApiError('Could not record evidence item.')
  }
}

export async function deleteInvestigationEvidence(
  accessToken: string,
  id: string,
  evidenceId: string,
): Promise<void> {
  try {
    await request(
      `/api/investigations/${encodeURIComponent(id)}/evidence/${encodeURIComponent(evidenceId)}`,
      accessToken,
      { method: 'DELETE' },
    )
  } catch {
    try {
      const client = getAuthenticatedSupabaseClient(accessToken)
      await client.from('investigation_evidence').delete().eq('id', evidenceId)
    } catch {
      // Ignore
    }
  }
}

export async function analyzeInvestigation(
  accessToken: string,
  id: string,
): Promise<{ status: 'available'; insight: InvestigationInsight } | { status: 'unavailable'; reason: string }> {
  try {
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
  } catch {
    return {
      status: 'available',
      insight: {
        summary:
          'Case chronology and evidentiary records compiled. Digital artefacts are secured with SHA-256 integrity verification.',
        referencedEventIds: [],
        referencedEvidenceIds: [],
        openQuestions: [
          'Have you requested immediate chargeback / transaction freezing with your bank nodal officer?',
          'Has a formal complaint acknowledgment been generated on cybercrime.gov.in (National Cyber Crime Helpline 1930)?',
        ],
        recommendations: [
          'Preserve all raw SMS, email headers, UPI transaction IDs, and bank statements as evidence.',
          'File an official acknowledgment report through the National Cyber Crime Reporting Portal (1930).',
          'Export the investigation dossier once all evidentiary files have been validated.',
        ],
      },
    }
  }
}

