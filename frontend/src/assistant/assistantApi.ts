import { API_BASE_URL } from '../services/apiBaseUrl.ts'
import { getAuthenticatedSupabaseClient } from '../auth/supabase.ts'

export type AssistantLanguage = 'en' | 'te' | 'hi'
export type AssistantMode = 'chat' | 'scan' | 'learning' | 'incident'

export interface AssistantConversation {
  id: string
  title: string
  language: AssistantLanguage
  created_at: string
  updated_at: string
}

export interface AssistantMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  language: AssistantLanguage
  context_used: Array<'scan' | 'investigation' | 'academy'>
  created_at: string
}

export interface AssistantContextOptions {
  scans: {
    id: string
    scan_type: string
    verdict: string
    risk_level: string
    created_at: string
  }[]
  investigations: {
    id: string
    title: string
    status: 'open' | 'in_progress' | 'resolved'
    updated_at: string
  }[]
  lessons: {
    id: string
    course_id: string
    title: string
    difficulty: 'beginner' | 'intermediate' | 'advanced'
  }[]
}

export class AssistantApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'AssistantApiError'
    this.status = status
  }
}

function isContextSource(value: unknown): value is AssistantMessage['context_used'][number] {
  return value === 'scan' || value === 'investigation' || value === 'academy'
}

function isInvestigationStatus(
  value: unknown,
): value is AssistantContextOptions['investigations'][number]['status'] {
  return value === 'open' || value === 'in_progress' || value === 'resolved'
}

function isDifficulty(
  value: unknown,
): value is AssistantContextOptions['lessons'][number]['difficulty'] {
  return value === 'beginner' || value === 'intermediate' || value === 'advanced'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringField(value: Record<string, unknown>, key: string): string {
  const field = value[key]
  if (typeof field !== 'string') throw new AssistantApiError('The assistant returned invalid data.')
  return field
}

function parseLanguage(value: unknown): AssistantLanguage {
  if (value !== 'en' && value !== 'te' && value !== 'hi') {
    throw new AssistantApiError('The assistant returned an unsupported language.')
  }
  return value
}

function parseConversation(value: unknown): AssistantConversation {
  if (!isRecord(value)) throw new AssistantApiError('The assistant returned invalid conversation data.')
  return {
    id: stringField(value, 'id'),
    title: stringField(value, 'title'),
    language: parseLanguage(value.language),
    created_at: stringField(value, 'created_at'),
    updated_at: stringField(value, 'updated_at'),
  }
}

function parseMessage(value: unknown): AssistantMessage {
  if (!isRecord(value) || (value.role !== 'user' && value.role !== 'assistant')) {
    throw new AssistantApiError('The assistant returned invalid message data.')
  }
  if (!Array.isArray(value.context_used) || !value.context_used.every(isContextSource)) {
    throw new AssistantApiError('The assistant returned invalid context metadata.')
  }
  return {
    id: stringField(value, 'id'),
    conversation_id: stringField(value, 'conversation_id'),
    role: value.role,
    content: stringField(value, 'content'),
    language: parseLanguage(value.language),
    context_used: value.context_used,
    created_at: stringField(value, 'created_at'),
  }
}

function parseContextOptions(value: unknown): AssistantContextOptions {
  if (!isRecord(value) || !Array.isArray(value.scans) ||
      !Array.isArray(value.investigations) || !Array.isArray(value.lessons)) {
    throw new AssistantApiError('The assistant returned invalid context options.')
  }
  const scans = value.scans.map((item) => {
    if (!isRecord(item)) throw new AssistantApiError('The assistant returned invalid scan context.')
    return {
      id: stringField(item, 'id'),
      scan_type: stringField(item, 'scan_type'),
      verdict: stringField(item, 'verdict'),
      risk_level: stringField(item, 'risk_level'),
      created_at: stringField(item, 'created_at'),
    }
  })
  const investigations = value.investigations.map((item) => {
    if (!isRecord(item) || !isInvestigationStatus(item.status)) {
      throw new AssistantApiError('The assistant returned invalid investigation context.')
    }
    return {
      id: stringField(item, 'id'),
      title: stringField(item, 'title'),
      status: item.status,
      updated_at: stringField(item, 'updated_at'),
    }
  })
  const lessons = value.lessons.map((item) => {
    if (!isRecord(item) || !isDifficulty(item.difficulty)) {
      throw new AssistantApiError('The assistant returned invalid Academy context.')
    }
    return {
      id: stringField(item, 'id'),
      course_id: stringField(item, 'course_id'),
      title: stringField(item, 'title'),
      difficulty: item.difficulty,
    }
  })
  return { scans, investigations, lessons }
}

async function request(
  path: string,
  accessToken: string,
  method = 'GET',
  body?: unknown,
): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 50_000)
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/assistant${path}`, {
      method,
      signal: controller.signal,
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch {
    if (controller.signal.aborted) {
      throw new AssistantApiError('The assistant request timed out while generating a response. Please retry.')
    }
    throw new AssistantApiError('The assistant API could not be reached. Check your connection and try again.')
  } finally {
    window.clearTimeout(timeout)
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new AssistantApiError('The assistant service returned an unreadable response.', response.status)
  }
  if (!isRecord(payload)) {
    throw new AssistantApiError('The assistant service returned invalid data.', response.status)
  }
  if (!response.ok || payload.success !== true) {
    let message = typeof payload.message === 'string'
      ? payload.message
      : `The assistant request failed (${response.status}).`
    if (response.status === 404 || payload.detail === 'Not Found') {
      message = 'The backend API returned 404. Ensure the Render backend deployment is active.'
    }
    throw new AssistantApiError(message, response.status)
  }
  return payload
}

export async function listAssistantConversations(accessToken: string): Promise<AssistantConversation[]> {
  try {
    const payload = await request('/conversations', accessToken)
    if (!Array.isArray(payload.conversations)) {
      throw new AssistantApiError('The assistant returned invalid conversation history.')
    }
    return payload.conversations.map(parseConversation)
  } catch {
    try {
      const client = getAuthenticatedSupabaseClient(accessToken)
      const { data, error } = await client
        .from('assistant_conversations')
        .select('*')
        .order('updated_at', { ascending: false })
      if (!error && Array.isArray(data)) {
        return data.map(parseConversation)
      }
    } catch {
      // Ignore
    }
    return []
  }
}

export async function createAssistantConversation(
  accessToken: string,
  language: AssistantLanguage,
): Promise<AssistantConversation> {
  try {
    const payload = await request('/conversations', accessToken, 'POST', { language })
    return parseConversation(payload.conversation)
  } catch {
    try {
      const client = getAuthenticatedSupabaseClient(accessToken)
      const { data: userData } = await client.auth.getUser()
      if (userData?.user?.id) {
        const { data, error } = await client
          .from('assistant_conversations')
          .insert({
            user_id: userData.user.id,
            title: 'New conversation',
            language,
          })
          .select('*')
          .single()
        if (!error && data) {
          return parseConversation(data)
        }
      }
    } catch {
      // Ignore
    }
    throw new AssistantApiError('Could not start assistant conversation.')
  }
}

export async function loadAssistantConversation(
  accessToken: string,
  conversationId: string,
): Promise<{ conversation: AssistantConversation; messages: AssistantMessage[] }> {
  try {
    const payload = await request(`/conversations/${encodeURIComponent(conversationId)}`, accessToken)
    if (!Array.isArray(payload.messages)) {
      throw new AssistantApiError('The assistant returned invalid messages.')
    }
    return {
      conversation: parseConversation(payload.conversation),
      messages: payload.messages.map(parseMessage),
    }
  } catch {
    try {
      const client = getAuthenticatedSupabaseClient(accessToken)
      const [convRes, msgRes] = await Promise.all([
        client.from('assistant_conversations').select('*').eq('id', conversationId).single(),
        client
          .from('assistant_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true }),
      ])
      if (convRes.data) {
        return {
          conversation: parseConversation(convRes.data),
          messages: (msgRes.data ?? []).map(parseMessage),
        }
      }
    } catch {
      // Ignore
    }
    throw new AssistantApiError('Could not load conversation.')
  }
}

export async function loadAssistantContextOptions(accessToken: string): Promise<AssistantContextOptions> {
  try {
    const payload = await request('/context-options', accessToken)
    return parseContextOptions(payload.options)
  } catch {
    try {
      const client = getAuthenticatedSupabaseClient(accessToken)
      const [scansRes, invRes, lessRes] = await Promise.all([
        client
          .from('scan_results')
          .select('id, scan_type, verdict, risk_level, created_at')
          .order('created_at', { ascending: false })
          .limit(10),
        client
          .from('investigations')
          .select('id, title, status, updated_at')
          .order('updated_at', { ascending: false })
          .limit(10),
        client.from('academy_lessons').select('id, course_id, title, difficulty').limit(10),
      ])
      return {
        scans: (scansRes.data ?? []).map((s) => ({
          id: String(s.id),
          scan_type: String(s.scan_type),
          verdict: String(s.verdict),
          risk_level: String(s.risk_level),
          created_at: String(s.created_at),
        })),
        investigations: (invRes.data ?? []).map((i) => ({
          id: String(i.id),
          title: String(i.title),
          status: i.status as 'open' | 'in_progress' | 'resolved',
          updated_at: String(i.updated_at),
        })),
        lessons: (lessRes.data ?? []).map((l) => ({
          id: String(l.id),
          course_id: String(l.course_id),
          title: String(l.title),
          difficulty: l.difficulty as 'beginner' | 'intermediate' | 'advanced',
        })),
      }
    } catch {
      return { scans: [], investigations: [], lessons: [] }
    }
  }
}

export async function sendAssistantMessage(
  accessToken: string,
  conversationId: string,
  input: {
    content: string
    language: AssistantLanguage
    mode: AssistantMode
    context: { scanId?: string; investigationId?: string; lessonId?: string }
  },
): Promise<{ messages: AssistantMessage[]; contextUsed: Array<'scan' | 'investigation' | 'academy'> }> {
  const payload = await request(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    accessToken,
    'POST',
    input,
  )
  if (
    !Array.isArray(payload.messages) ||
    !Array.isArray(payload.contextUsed) ||
    !payload.contextUsed.every(isContextSource)
  ) {
    throw new AssistantApiError('The assistant returned invalid message data.')
  }
  return {
    messages: payload.messages.map(parseMessage),
    contextUsed: payload.contextUsed,
  }
}

export async function deleteAssistantConversation(accessToken: string, conversationId: string): Promise<void> {
  try {
    await request(`/conversations/${encodeURIComponent(conversationId)}`, accessToken, 'DELETE')
  } catch {
    try {
      const client = getAuthenticatedSupabaseClient(accessToken)
      await client.from('assistant_conversations').delete().eq('id', conversationId)
    } catch {
      // Ignore
    }
  }
}

