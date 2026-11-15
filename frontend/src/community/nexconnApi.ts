import { API_BASE_URL } from '../services/apiBaseUrl'

export interface NexconnSession {
  appKey: string
  region: 'sg' | 'us'
  userId: string
  token: string
  callsEnabled: boolean
}

export class NexconnApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NexconnApiError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNexconnSession(value: unknown): value is NexconnSession {
  return isRecord(value) &&
    typeof value.appKey === 'string' &&
    ['sg', 'us'].includes(String(value.region)) &&
    typeof value.userId === 'string' &&
    typeof value.token === 'string' &&
    typeof value.callsEnabled === 'boolean'
}

export async function requestNexconnSession(accessToken: string): Promise<NexconnSession> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(`${API_BASE_URL}/api/nexconn/session`, {
      method: 'POST',
      credentials: 'omit',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })
    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new NexconnApiError('Nexconn returned an unreadable response.')
    }
    if (!response.ok) {
      const message = isRecord(body) && typeof body.message === 'string'
        ? body.message
        : 'Nexconn could not create a chat session.'
      throw new NexconnApiError(message)
    }
    if (!isRecord(body) || body.success !== true || !isNexconnSession(body.session)) {
      throw new NexconnApiError('Nexconn returned an invalid session response.')
    }
    return body.session
  } catch (error) {
    if (error instanceof NexconnApiError) throw error
    if (controller.signal.aborted) {
      throw new NexconnApiError('The Nexconn connection timed out. Try again.')
    }
    throw new NexconnApiError('Nexconn could not be reached. Check the backend connection.')
  } finally {
    window.clearTimeout(timeout)
  }
}
