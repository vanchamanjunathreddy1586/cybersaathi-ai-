import { API_BASE_URL } from '../services/apiBaseUrl.ts'

export interface FamilyCircleSummary {
  id: string
  name: string
  owner_user_id: string
  invite_code: string
  created_at: string
  role: 'guardian' | 'member'
  memberCount: number
  alertCount: number
}

export interface FamilyCircleMember {
  id: string
  circle_id: string
  user_id: string
  role: 'guardian' | 'member'
  display_name: string | null
  joined_at: string
}

export interface FamilyCircleAlert {
  id: string
  circle_id: string
  triggered_by_user_id: string
  threat_type: string
  severity: 'high' | 'critical'
  summary: string
  advice: string
  resolved: boolean
  created_at: string
}

export interface CircleDetails {
  circle: {
    id: string
    name: string
    owner_user_id: string
    invite_code: string
    created_at: string
  }
  members: FamilyCircleMember[]
  alerts: FamilyCircleAlert[]
}

export class FamilySafetyApiError extends Error {
  readonly status?: number
  readonly code?: string

  constructor(message: string, status?: number, code?: string) {
    super(message)
    this.name = 'FamilySafetyApiError'
    this.status = status
    this.code = code
  }
}

export function isDatabaseMigrationPendingError(err: unknown): boolean {
  if (!err) return false
  if (err instanceof FamilySafetyApiError && err.code === 'DATABASE_SETUP_PENDING') return true
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  return (
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('database_setup_pending') ||
    msg.includes('family_circle_members') ||
    msg.includes('family_circles')
  )
}

export function sanitizeUserFacingError(
  err: unknown,
  defaultMessage = 'An error occurred.',
): { message: string; isDatabasePending: boolean } {
  if (isDatabaseMigrationPendingError(err)) {
    return {
      message: 'Family Safety database tables are not yet initialized in Supabase. The database migration script must be applied.',
      isDatabasePending: true,
    }
  }

  if (err instanceof FamilySafetyApiError) {
    if (err.status === 401) {
      return { message: 'Authentication required. Please sign in again.', isDatabasePending: false }
    }
    if (err.status === 404) {
      return { message: 'Family safety circle not found or access denied.', isDatabasePending: false }
    }
    if (err.status === 429) {
      return { message: 'Too many requests. Please wait a moment and try again.', isDatabasePending: false }
    }
    if (err.message) {
      return { message: err.message, isDatabasePending: false }
    }
  }

  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return { message: 'Request timed out. Please check your internet connection.', isDatabasePending: false }
    }
    return { message: err.message, isDatabasePending: false }
  }

  return { message: defaultMessage, isDatabasePending: false }
}

/**
 * Fetch all family circles the authenticated user belongs to.
 */
export async function fetchUserCircles(accessToken: string): Promise<FamilyCircleSummary[]> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12_000)

  try {
    const res = await fetch(`${API_BASE_URL}/api/family-safety/circles`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
      credentials: 'omit',
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string; code?: string }
      throw new FamilySafetyApiError(err.message || 'Failed to fetch family circles.', res.status, err.code)
    }

    const payload = (await res.json()) as { success: boolean; data: FamilyCircleSummary[] }
    return payload.data || []
  } finally {
    window.clearTimeout(timeout)
  }
}

/**
 * Create a new family safety circle.
 */
export async function createFamilyCircle(
  accessToken: string,
  name: string,
  displayName?: string,
): Promise<{ id: string; name: string; invite_code: string }> {
  const res = await fetch(`${API_BASE_URL}/api/family-safety/circles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ name, displayName: displayName || undefined }),
    credentials: 'omit',
  })

  const json = await res.json().catch(() => ({})) as { success: boolean; data?: { id: string; name: string; invite_code: string }; message?: string; code?: string }
  if (!res.ok || !json.success) {
    throw new FamilySafetyApiError(json.message || 'Failed to create family circle.', res.status, json.code)
  }

  return json.data!
}

/**
 * Join an existing family safety circle using an invite code.
 */
export async function joinFamilyCircle(
  accessToken: string,
  inviteCode: string,
  displayName?: string,
): Promise<{ circle: { id: string; name: string; created_at?: string; invite_code?: string }; member: FamilyCircleMember }> {
  const res = await fetch(`${API_BASE_URL}/api/family-safety/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ inviteCode, displayName: displayName || undefined }),
    credentials: 'omit',
  })

  const json = await res.json().catch(() => ({})) as {
    success: boolean
    data?: { circle: { id: string; name: string; created_at?: string; invite_code?: string }; member: FamilyCircleMember }
    message?: string
    code?: string
  }
  if (!res.ok || !json.success) {
    throw new FamilySafetyApiError(json.message || 'Failed to join family circle.', res.status, json.code)
  }

  return json.data!
}

/**
 * Get full circle details: metadata, member roster, and threat alert feed.
 */
export async function fetchCircleDetails(accessToken: string, circleId: string): Promise<CircleDetails> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12_000)

  try {
    const res = await fetch(`${API_BASE_URL}/api/family-safety/circles/${circleId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
      credentials: 'omit',
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string; code?: string }
      throw new FamilySafetyApiError(err.message || 'Failed to load circle details.', res.status, err.code)
    }

    const payload = (await res.json()) as { success: boolean; data: CircleDetails }
    return payload.data
  } finally {
    window.clearTimeout(timeout)
  }
}

/**
 * Broadcast an emergency threat alert to all members of the circle.
 */
export async function broadcastCircleAlert(
  accessToken: string,
  circleId: string,
  alert: {
    threatType: string
    severity: 'high' | 'critical'
    summary: string
    advice: string
  },
): Promise<FamilyCircleAlert> {
  const res = await fetch(`${API_BASE_URL}/api/family-safety/circles/${circleId}/alerts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(alert),
    credentials: 'omit',
  })

  const json = await res.json().catch(() => ({})) as {
    success: boolean
    data?: FamilyCircleAlert
    message?: string
    code?: string
  }
  if (!res.ok || !json.success) {
    throw new FamilySafetyApiError(json.message || 'Failed to broadcast threat alert.', res.status, json.code)
  }

  return json.data!
}

/**
 * Leave a family circle.
 */
export async function leaveFamilyCircle(accessToken: string, circleId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/family-safety/circles/${circleId}/leave`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'omit',
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string; code?: string }
    throw new FamilySafetyApiError(err.message || 'Failed to leave family circle.', res.status, err.code)
  }
}
