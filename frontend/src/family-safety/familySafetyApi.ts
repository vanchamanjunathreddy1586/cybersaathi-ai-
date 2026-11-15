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
      const err = await res.json().catch(() => ({})) as { message?: string }
      throw new FamilySafetyApiError(err.message || 'Failed to fetch family circles.', res.status)
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

  const json = await res.json().catch(() => ({})) as { success: boolean; data?: { id: string; name: string; invite_code: string }; message?: string }
  if (!res.ok || !json.success) {
    throw new FamilySafetyApiError(json.message || 'Failed to create family circle.', res.status)
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
): Promise<{ circle: { id: string; name: string; invite_code: string }; member: FamilyCircleMember }> {
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
    data?: { circle: { id: string; name: string; invite_code: string }; member: FamilyCircleMember }
    message?: string
  }
  if (!res.ok || !json.success) {
    throw new FamilySafetyApiError(json.message || 'Failed to join family circle.', res.status)
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
      const err = await res.json().catch(() => ({})) as { message?: string }
      throw new FamilySafetyApiError(err.message || 'Failed to load circle details.', res.status)
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
  }
  if (!res.ok || !json.success) {
    throw new FamilySafetyApiError(json.message || 'Failed to broadcast threat alert.', res.status)
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
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new FamilySafetyApiError(err.message || 'Failed to leave family circle.', res.status)
  }
}
