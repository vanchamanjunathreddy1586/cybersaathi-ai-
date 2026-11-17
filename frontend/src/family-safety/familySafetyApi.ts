import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  supabase,
  supabaseUrl,
  supabasePublishableKey,
  supabaseConfigurationError,
} from '../auth/supabase.ts'
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
      message:
        'Family Safety database tables are not yet initialized in Supabase. The database migration script must be applied.',
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

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'CS-'
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(6)
    crypto.getRandomValues(bytes)
    for (let i = 0; i < 6; i++) {
      code += chars[bytes[i] % chars.length]
    }
  } else {
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
  }
  return code
}

function getSupabaseClient(accessToken?: string): SupabaseClient {
  if (accessToken && supabaseUrl && supabasePublishableKey) {
    return createClient(supabaseUrl, supabasePublishableKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false },
    })
  }
  if (supabase) {
    return supabase
  }
  throw new FamilySafetyApiError(
    supabaseConfigurationError ?? 'Supabase is not configured.',
    500,
  )
}

const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

// ---------------------------------------------------------------------------
// HTTP API Fallbacks (Used if Supabase client is not configured)
// ---------------------------------------------------------------------------

async function fetchUserCirclesFromApi(accessToken: string): Promise<FamilyCircleSummary[]> {
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
      const err = (await res.json().catch(() => ({}))) as { message?: string; code?: string }
      throw new FamilySafetyApiError(
        err.message || 'Failed to fetch family circles.',
        res.status,
        err.code,
      )
    }

    const payload = (await res.json()) as { success: boolean; data: FamilyCircleSummary[] }
    return payload.data || []
  } finally {
    window.clearTimeout(timeout)
  }
}

async function createFamilyCircleFromApi(
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

  const json = (await res.json().catch(() => ({}))) as {
    success: boolean
    data?: { id: string; name: string; invite_code: string }
    message?: string
    code?: string
  }
  if (!res.ok || !json.success) {
    throw new FamilySafetyApiError(
      json.message || 'Failed to create family circle.',
      res.status,
      json.code,
    )
  }

  return json.data!
}

async function joinFamilyCircleFromApi(
  accessToken: string,
  inviteCode: string,
  displayName?: string,
): Promise<{
  circle: { id: string; name: string; created_at?: string; invite_code?: string }
  member: FamilyCircleMember
}> {
  const res = await fetch(`${API_BASE_URL}/api/family-safety/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ inviteCode, displayName: displayName || undefined }),
    credentials: 'omit',
  })

  const json = (await res.json().catch(() => ({}))) as {
    success: boolean
    data?: {
      circle: { id: string; name: string; created_at?: string; invite_code?: string }
      member: FamilyCircleMember
    }
    message?: string
    code?: string
  }
  if (!res.ok || !json.success) {
    throw new FamilySafetyApiError(
      json.message || 'Failed to join family circle.',
      res.status,
      json.code,
    )
  }

  return json.data!
}

async function fetchCircleDetailsFromApi(
  accessToken: string,
  circleId: string,
): Promise<CircleDetails> {
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
      const err = (await res.json().catch(() => ({}))) as { message?: string; code?: string }
      throw new FamilySafetyApiError(
        err.message || 'Failed to load circle details.',
        res.status,
        err.code,
      )
    }

    const payload = (await res.json()) as { success: boolean; data: CircleDetails }
    return payload.data
  } finally {
    window.clearTimeout(timeout)
  }
}

async function broadcastCircleAlertFromApi(
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

  const json = (await res.json().catch(() => ({}))) as {
    success: boolean
    data?: FamilyCircleAlert
    message?: string
    code?: string
  }
  if (!res.ok || !json.success) {
    throw new FamilySafetyApiError(
      json.message || 'Failed to broadcast threat alert.',
      res.status,
      json.code,
    )
  }

  return json.data!
}

async function leaveFamilyCircleFromApi(accessToken: string, circleId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/family-safety/circles/${circleId}/leave`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'omit',
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string; code?: string }
    throw new FamilySafetyApiError(
      err.message || 'Failed to leave family circle.',
      res.status,
      err.code,
    )
  }
}

// ---------------------------------------------------------------------------
// Primary Direct Supabase Implementation
// ---------------------------------------------------------------------------

/**
 * Fetch all family circles the authenticated user belongs to.
 */
export async function fetchUserCircles(accessToken: string): Promise<FamilyCircleSummary[]> {
  if (!isSupabaseConfigured) {
    return fetchUserCirclesFromApi(accessToken)
  }

  try {
    const client = getSupabaseClient(accessToken)
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser(accessToken)

    if (userError || !user) {
      throw new FamilySafetyApiError('Authentication required. Please sign in again.', 401)
    }

    const { data: memberships, error } = await client
      .from('family_circle_members')
      .select('role, circle_id, family_circles(id, name, owner_user_id, invite_code, created_at)')
      .eq('user_id', user.id)

    if (error) {
      throw new FamilySafetyApiError(error.message, 500, error.code)
    }

    if (!memberships || memberships.length === 0) {
      return []
    }

    const circlesList: FamilyCircleSummary[] = []
    for (const m of memberships) {
      const circleData = (m as unknown as {
        family_circles: {
          id: string
          name: string
          owner_user_id: string
          invite_code: string
          created_at: string
        } | null
      }).family_circles

      if (!circleData) continue

      const [memberCountRes, alertCountRes] = await Promise.all([
        client
          .from('family_circle_members')
          .select('id', { count: 'exact', head: true })
          .eq('circle_id', circleData.id),
        client
          .from('family_circle_alerts')
          .select('id', { count: 'exact', head: true })
          .eq('circle_id', circleData.id)
          .eq('resolved', false),
      ])

      circlesList.push({
        id: circleData.id,
        name: circleData.name,
        owner_user_id: circleData.owner_user_id,
        invite_code: circleData.invite_code,
        created_at: circleData.created_at,
        role: m.role as 'guardian' | 'member',
        memberCount: memberCountRes.count ?? 1,
        alertCount: alertCountRes.count ?? 0,
      })
    }

    return circlesList
  } catch (err) {
    if (err instanceof FamilySafetyApiError) throw err
    if (API_BASE_URL) {
      return fetchUserCirclesFromApi(accessToken)
    }
    throw new FamilySafetyApiError(
      err instanceof Error ? err.message : 'Failed to fetch family circles.',
      500,
    )
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
  if (!isSupabaseConfigured) {
    return createFamilyCircleFromApi(accessToken, name, displayName)
  }

  try {
    const client = getSupabaseClient(accessToken)
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser(accessToken)

    if (userError || !user) {
      throw new FamilySafetyApiError('Authentication required. Please sign in again.', 401)
    }

    const inviteCode = generateInviteCode()
    const { data: circle, error: circleError } = await client
      .from('family_circles')
      .insert({
        name: name.trim(),
        owner_user_id: user.id,
        invite_code: inviteCode,
      })
      .select('id, name, owner_user_id, invite_code, created_at')
      .single()

    if (circleError || !circle) {
      throw new FamilySafetyApiError(
        circleError?.message || 'Failed to create family circle.',
        500,
        circleError?.code,
      )
    }

    // If displayName provided and different from default, update display_name
    if (displayName && displayName.trim() && displayName.trim() !== 'Circle Guardian') {
      await client
        .from('family_circle_members')
        .update({ display_name: displayName.trim() })
        .eq('circle_id', circle.id)
        .eq('user_id', user.id)
    }

    return {
      id: circle.id,
      name: circle.name,
      invite_code: circle.invite_code,
    }
  } catch (err) {
    if (err instanceof FamilySafetyApiError) throw err
    if (API_BASE_URL) {
      return createFamilyCircleFromApi(accessToken, name, displayName)
    }
    throw new FamilySafetyApiError(
      err instanceof Error ? err.message : 'Failed to create family circle.',
      500,
    )
  }
}

/**
 * Join an existing family safety circle using an invite code.
 */
export async function joinFamilyCircle(
  accessToken: string,
  inviteCode: string,
  displayName?: string,
): Promise<{
  circle: { id: string; name: string; created_at?: string; invite_code?: string }
  member: FamilyCircleMember
}> {
  if (!isSupabaseConfigured) {
    return joinFamilyCircleFromApi(accessToken, inviteCode, displayName)
  }

  try {
    const client = getSupabaseClient(accessToken)
    const cleanCode = inviteCode.trim().toUpperCase()

    const { data: rpcData, error: rpcError } = await client.rpc(
      'join_family_circle_with_invite',
      {
        p_invite_code: cleanCode,
        p_display_name: displayName?.trim() || 'Family Member',
      },
    )

    if (rpcError) {
      const msg = rpcError.message || ''
      if (msg.includes('already a member')) {
        throw new FamilySafetyApiError('You are already a member of this family safety circle.', 400)
      }
      if (msg.includes('Invalid or expired')) {
        throw new FamilySafetyApiError('Invalid or expired family circle invite code.', 404)
      }
      throw new FamilySafetyApiError(
        rpcError.message || 'Failed to join family circle.',
        400,
        rpcError.code,
      )
    }

    if (rpcData && typeof rpcData === 'object' && 'circle' in rpcData) {
      return {
        circle: (rpcData as { circle: { id: string; name: string; created_at?: string; invite_code?: string } }).circle,
        member: (rpcData as { member: FamilyCircleMember }).member,
      }
    }

    throw new FamilySafetyApiError('Unexpected response from server while joining family circle.', 500)
  } catch (err) {
    if (err instanceof FamilySafetyApiError) throw err
    if (API_BASE_URL) {
      return joinFamilyCircleFromApi(accessToken, inviteCode, displayName)
    }
    throw new FamilySafetyApiError(
      err instanceof Error ? err.message : 'Failed to join family circle.',
      500,
    )
  }
}

/**
 * Get full circle details: metadata, member roster, and threat alert feed.
 */
export async function fetchCircleDetails(
  accessToken: string,
  circleId: string,
): Promise<CircleDetails> {
  if (!isSupabaseConfigured) {
    return fetchCircleDetailsFromApi(accessToken, circleId)
  }

  try {
    const client = getSupabaseClient(accessToken)

    const [circleRes, membersRes, alertsRes] = await Promise.all([
      client.from('family_circles').select('*').eq('id', circleId).single(),
      client
        .from('family_circle_members')
        .select('*')
        .eq('circle_id', circleId)
        .order('joined_at', { ascending: true }),
      client
        .from('family_circle_alerts')
        .select('*')
        .eq('circle_id', circleId)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    if (circleRes.error || !circleRes.data) {
      throw new FamilySafetyApiError(
        circleRes.error?.message || 'Family safety circle not found or access denied.',
        circleRes.error?.code === 'PGRST116' ? 404 : 403,
        circleRes.error?.code,
      )
    }

    return {
      circle: {
        id: circleRes.data.id,
        name: circleRes.data.name,
        owner_user_id: circleRes.data.owner_user_id,
        invite_code: circleRes.data.invite_code,
        created_at: circleRes.data.created_at,
      },
      members: (membersRes.data ?? []) as FamilyCircleMember[],
      alerts: (alertsRes.data ?? []) as FamilyCircleAlert[],
    }
  } catch (err) {
    if (err instanceof FamilySafetyApiError) throw err
    if (API_BASE_URL) {
      return fetchCircleDetailsFromApi(accessToken, circleId)
    }
    throw new FamilySafetyApiError(
      err instanceof Error ? err.message : 'Failed to load circle details.',
      500,
    )
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
  if (!isSupabaseConfigured) {
    return broadcastCircleAlertFromApi(accessToken, circleId, alert)
  }

  try {
    const client = getSupabaseClient(accessToken)
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser(accessToken)

    if (userError || !user) {
      throw new FamilySafetyApiError('Authentication required. Please sign in again.', 401)
    }

    const { data: createdAlert, error } = await client
      .from('family_circle_alerts')
      .insert({
        circle_id: circleId,
        triggered_by_user_id: user.id,
        threat_type: alert.threatType,
        severity: alert.severity,
        summary: alert.summary.trim(),
        advice: alert.advice.trim(),
      })
      .select('*')
      .single()

    if (error || !createdAlert) {
      throw new FamilySafetyApiError(
        error?.message || 'Failed to broadcast threat alert.',
        500,
        error?.code,
      )
    }

    return createdAlert as FamilyCircleAlert
  } catch (err) {
    if (err instanceof FamilySafetyApiError) throw err
    if (API_BASE_URL) {
      return broadcastCircleAlertFromApi(accessToken, circleId, alert)
    }
    throw new FamilySafetyApiError(
      err instanceof Error ? err.message : 'Failed to broadcast threat alert.',
      500,
    )
  }
}

/**
 * Leave a family circle.
 */
export async function leaveFamilyCircle(accessToken: string, circleId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    return leaveFamilyCircleFromApi(accessToken, circleId)
  }

  try {
    const client = getSupabaseClient(accessToken)
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser(accessToken)

    if (userError || !user) {
      throw new FamilySafetyApiError('Authentication required. Please sign in again.', 401)
    }

    const { error } = await client
      .from('family_circle_members')
      .delete()
      .eq('circle_id', circleId)
      .eq('user_id', user.id)

    if (error) {
      throw new FamilySafetyApiError(error.message || 'Failed to leave family circle.', 500, error.code)
    }
  } catch (err) {
    if (err instanceof FamilySafetyApiError) throw err
    if (API_BASE_URL) {
      return leaveFamilyCircleFromApi(accessToken, circleId)
    }
    throw new FamilySafetyApiError(
      err instanceof Error ? err.message : 'Failed to leave family circle.',
      500,
    )
  }
}
