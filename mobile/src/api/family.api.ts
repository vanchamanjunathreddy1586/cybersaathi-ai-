import { apiClient, ApiError } from './client';

export interface FamilyCircleMember {
  id: string;
  circleId?: string;
  circle_id?: string;
  userId: string;
  user_id?: string;
  displayName: string;
  display_name?: string | null;
  role: 'guardian' | 'member';
  joinedAt: string;
  joined_at?: string;
}

export interface FamilyAlert {
  id: string;
  circleId: string;
  circle_id?: string;
  threatType: string;
  threat_type?: string;
  severity: 'high' | 'critical';
  summary: string;
  advice: string;
  senderName?: string;
  resolved?: boolean;
  createdAt: string;
  created_at?: string;
}

export interface FamilyCircle {
  id: string;
  name: string;
  inviteCode?: string;
  invite_code?: string;
  ownerUserId?: string;
  owner_user_id?: string;
  role?: 'guardian' | 'member';
  memberCount?: number;
  alertCount?: number;
  members?: FamilyCircleMember[];
  alerts?: FamilyAlert[];
  createdAt: string;
  created_at?: string;
}

export interface FamilyCirclesResponse {
  isPendingMigration: boolean;
  errorMessage?: string;
  circles: FamilyCircle[];
}

export function isMissingTableOrPendingError(err: any): boolean {
  if (!err) return false;
  if (err.status === 503 || err.data?.code === 'DATABASE_SETUP_PENDING') return true;
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.data?.code || err.code || '').toLowerCase();
  return (
    code === 'pgrst205' ||
    code === 'pgrst200' ||
    code === '42p01' ||
    code === 'database_setup_pending' ||
    msg.includes('database_setup_pending') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('family_circle_members') ||
    msg.includes('family_circles') ||
    msg.includes('family_circle_alerts')
  );
}

export function normalizeMember(raw: any): FamilyCircleMember {
  if (!raw) {
    return {
      id: '',
      userId: '',
      user_id: '',
      displayName: 'Member',
      display_name: 'Member',
      role: 'member',
      joinedAt: new Date().toISOString(),
      joined_at: new Date().toISOString(),
    };
  }
  const id = String(raw.id || '');
  const circleId = String(raw.circleId || raw.circle_id || '');
  const userId = String(raw.userId || raw.user_id || '');
  const displayName = String(raw.displayName || raw.display_name || 'Member');
  const role: 'guardian' | 'member' = raw.role === 'guardian' ? 'guardian' : 'member';
  const joinedAt = String(raw.joinedAt || raw.joined_at || new Date().toISOString());

  return {
    id,
    circleId,
    circle_id: circleId,
    userId,
    user_id: userId,
    displayName,
    display_name: displayName,
    role,
    joinedAt,
    joined_at: joinedAt,
  };
}

export function normalizeAlert(raw: any): FamilyAlert {
  if (!raw) {
    return {
      id: '',
      circleId: '',
      circle_id: '',
      threatType: 'Cyber Threat',
      threat_type: 'Cyber Threat',
      severity: 'high',
      summary: '',
      advice: '',
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }
  const id = String(raw.id || '');
  const circleId = String(raw.circleId || raw.circle_id || '');
  const threatType = String(raw.threatType || raw.threat_type || 'Scam Alert');
  const severity: 'high' | 'critical' = raw.severity === 'critical' ? 'critical' : 'high';
  const summary = String(raw.summary || '');
  const advice = String(raw.advice || '');
  const senderName = raw.senderName || (raw.triggered_by_user_id ? 'Circle Member' : undefined);
  const createdAt = String(raw.createdAt || raw.created_at || new Date().toISOString());

  return {
    id,
    circleId,
    circle_id: circleId,
    threatType,
    threat_type: threatType,
    severity,
    summary,
    advice,
    senderName,
    resolved: Boolean(raw.resolved),
    createdAt,
    created_at: createdAt,
  };
}

export function normalizeCircle(raw: any): FamilyCircle {
  if (!raw) {
    return {
      id: '',
      name: '',
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }
  const id = String(raw.id || '');
  const name = String(raw.name || '');
  const inviteCode = raw.inviteCode || raw.invite_code || '';
  const ownerUserId = raw.ownerUserId || raw.owner_user_id;
  const role: 'guardian' | 'member' | undefined =
    raw.role === 'guardian' ? 'guardian' : raw.role === 'member' ? 'member' : undefined;
  const createdAt = String(raw.createdAt || raw.created_at || new Date().toISOString());

  const members = Array.isArray(raw.members) ? raw.members.map(normalizeMember) : undefined;
  const alerts = Array.isArray(raw.alerts) ? raw.alerts.map(normalizeAlert) : undefined;
  const memberCount = typeof raw.memberCount === 'number' ? raw.memberCount : members?.length;
  const alertCount = typeof raw.alertCount === 'number' ? raw.alertCount : alerts?.length;

  return {
    id,
    name,
    inviteCode,
    invite_code: inviteCode,
    ownerUserId,
    owner_user_id: ownerUserId,
    role,
    memberCount,
    alertCount,
    members,
    alerts,
    createdAt,
    created_at: createdAt,
  };
}

export async function listFamilyCircles(): Promise<FamilyCirclesResponse> {
  try {
    const res = await apiClient<{ success: boolean; data: any[] }>('/family-safety/circles');
    const rawList = Array.isArray(res.data) ? res.data : [];
    return {
      isPendingMigration: false,
      circles: rawList.map(normalizeCircle),
    };
  } catch (err: any) {
    const isPending = isMissingTableOrPendingError(err);
    if (isPending) {
      console.warn('[FamilySafetyAPI] Remote database tables not initialized yet (pending migration):', err.message);
      return {
        isPendingMigration: true,
        errorMessage: 'Family Safety database tables are not initialized in Supabase. The migration script must be applied.',
        circles: [],
      };
    }

    console.warn('[FamilySafetyAPI] listCircles failed:', err.message);
    return {
      isPendingMigration: false,
      errorMessage: err.message || 'Failed to load family circles.',
      circles: [],
    };
  }
}

export async function createFamilyCircle(name: string, displayName?: string): Promise<FamilyCircle> {
  const res = await apiClient<{ success: boolean; data: any }>('/family-safety/circles', {
    method: 'POST',
    body: JSON.stringify({ name: name.trim(), displayName: displayName?.trim() || undefined }),
  });
  return normalizeCircle(res.data);
}

export async function joinFamilyCircle(
  inviteCode: string,
  displayName?: string
): Promise<{ circle: FamilyCircle; member: FamilyCircleMember }> {
  const res = await apiClient<{ success: boolean; data: { circle: any; member: any } }>('/family-safety/join', {
    method: 'POST',
    body: JSON.stringify({
      inviteCode: inviteCode.trim().toUpperCase(),
      displayName: displayName?.trim() || undefined,
    }),
  });
  return {
    circle: normalizeCircle(res.data?.circle),
    member: normalizeMember(res.data?.member),
  };
}

export async function getCircleDetails(circleId: string): Promise<FamilyCircle | null> {
  try {
    const res = await apiClient<{
      success: boolean;
      data: {
        circle: any;
        members: any[];
        alerts: any[];
      };
    }>(`/family-safety/circles/${circleId}`);

    if (!res.data || !res.data.circle) {
      return null;
    }

    const circle = normalizeCircle(res.data.circle);
    const members = (res.data.members || []).map(normalizeMember);
    const alerts = (res.data.alerts || []).map(normalizeAlert);

    circle.members = members;
    circle.alerts = alerts;
    circle.memberCount = members.length;
    circle.alertCount = alerts.length;

    return circle;
  } catch (err) {
    console.warn(`[FamilySafetyAPI] getCircleDetails failed for ${circleId}:`, err);
    return null;
  }
}

export async function broadcastThreatAlert(
  circleId: string,
  alert: { threatType: string; severity: 'high' | 'critical'; summary: string; advice: string }
): Promise<FamilyAlert> {
  const res = await apiClient<{ success: boolean; data: any }>(`/family-safety/circles/${circleId}/alerts`, {
    method: 'POST',
    body: JSON.stringify(alert),
  });
  return normalizeAlert(res.data);
}

export async function leaveCircle(circleId: string): Promise<boolean> {
  try {
    await apiClient(`/family-safety/circles/${circleId}/leave`, { method: 'DELETE' });
    return true;
  } catch (err) {
    console.warn('[FamilySafetyAPI] leaveCircle failed:', err);
    return false;
  }
}
