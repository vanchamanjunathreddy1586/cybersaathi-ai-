import crypto from 'node:crypto';
import { z } from 'zod';
import { getUserSupabaseClient } from '../../config/supabase.js';

export interface FamilyCircle {
  id: string;
  name: string;
  owner_user_id?: string;
  invite_code?: string;
  created_at: string;
}

export interface FamilyCircleMember {
  id: string;
  circle_id: string;
  user_id: string;
  role: 'guardian' | 'member';
  display_name: string | null;
  joined_at: string;
}

export interface FamilyCircleAlert {
  id: string;
  circle_id: string;
  triggered_by_user_id: string;
  threat_type: string;
  severity: 'high' | 'critical';
  summary: string;
  advice: string;
  resolved: boolean;
  created_at: string;
}

export class DatabaseMigrationPendingError extends Error {
  readonly code = 'DATABASE_SETUP_PENDING';
  constructor(message = 'Family Safety database tables are not yet initialized. Please apply the migration script in Supabase.') {
    super(message);
    this.name = 'DatabaseMigrationPendingError';
  }
}

export function isMissingTableError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || '').toLowerCase();
  const code = String(error.code || '');
  return (
    code === 'PGRST205' ||
    code === 'PGRST200' ||
    code === '42P01' ||
    code === '42883' ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('relation "family_circles"') ||
    msg.includes('relation "family_circle_members"') ||
    msg.includes('relation "family_circle_alerts"') ||
    msg.includes('relation "public.family_')
  );
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CS-';
  for (let i = 0; i < 6; i++) {
    const idx = crypto.randomInt(0, chars.length);
    code += chars[idx];
  }
  return code;
}

export class FamilySafetyService {
  async createCircle(
    accessToken: string,
    ownerUserId: string,
    name: string,
    displayName?: string,
  ): Promise<FamilyCircle> {
    const client = getUserSupabaseClient(accessToken);
    const inviteCode = generateInviteCode();

    const { data: circle, error: circleError } = await client
      .from('family_circles')
      .insert({
        name: name.trim(),
        owner_user_id: ownerUserId,
        invite_code: inviteCode,
      })
      .select('id, name, owner_user_id, invite_code, created_at')
      .single();

    if (circleError || !circle) {
      if (isMissingTableError(circleError)) {
        throw new DatabaseMigrationPendingError();
      }
      throw new Error(`Failed to create family circle: ${circleError?.message ?? 'Unknown'}`);
    }

    // The database trigger tr_family_circles_add_guardian automatically inserts the owner as guardian.
    // If trigger has not yet executed (pre-migration fallback), ensure member record exists.
    const { data: existingMember } = await client
      .from('family_circle_members')
      .select('id')
      .eq('circle_id', circle.id)
      .eq('user_id', ownerUserId)
      .maybeSingle();

    if (!existingMember) {
      const { error: insertErr } = await client
        .from('family_circle_members')
        .insert({
          circle_id: circle.id,
          user_id: ownerUserId,
          role: 'guardian',
          display_name: displayName?.trim() || 'Circle Guardian',
        });
      if (insertErr && insertErr.code !== '23505') {
        // Fallback silently if RLS strictly requires role = 'member' and trigger ran asynchronously
      }
    } else if (displayName && displayName.trim() && displayName.trim() !== 'Circle Guardian') {
      await client
        .from('family_circle_members')
        .update({ display_name: displayName.trim() })
        .eq('circle_id', circle.id)
        .eq('user_id', ownerUserId);
    }

    return circle as FamilyCircle;
  }

  async joinCircleWithInvite(
    accessToken: string,
    userId: string,
    inviteCode: string,
    displayName?: string,
  ): Promise<{ circle: FamilyCircle; member: FamilyCircleMember }> {
    const client = getUserSupabaseClient(accessToken);
    const cleanCode = inviteCode.trim().toUpperCase();

    // 1. Attempt joining via hardened RPC function (atomic and RLS-compliant)
    try {
      const { data: rpcData, error: rpcError } = await client.rpc('join_family_circle_with_invite', {
        p_invite_code: cleanCode,
        p_display_name: displayName?.trim() || 'Family Member',
      });

      if (!rpcError && rpcData && typeof rpcData === 'object' && 'circle' in rpcData) {
        return {
          circle: (rpcData as any).circle as FamilyCircle,
          member: (rpcData as any).member as FamilyCircleMember,
        };
      }

      if (rpcError) {
        // If error is expected business logic error (invalid code or already member), rethrow directly
        const msg = rpcError.message || '';
        if (msg.includes('already a member')) {
          throw new Error('You are already a member of this family safety circle.');
        }
        if (msg.includes('Invalid or expired')) {
          throw new Error('Invalid or expired family circle invite code.');
        }
        // If the error is not "function does not exist", throw the message
        if (rpcError.code !== 'PGRST202' && rpcError.code !== '42883') {
          throw new Error(rpcError.message || 'Failed to join family circle.');
        }
      }
    } catch (rpcErr) {
      if (rpcErr instanceof Error && !rpcErr.message.includes('PGRST202') && !rpcErr.message.includes('42883')) {
        throw rpcErr;
      }
    }

    // 2. Fallback to direct query if RPC is not present
    const { data: circle, error: circleError } = await client
      .from('family_circles')
      .select('id, name, created_at')
      .eq('invite_code', cleanCode)
      .maybeSingle();

    if (circleError) {
      if (isMissingTableError(circleError)) {
        throw new DatabaseMigrationPendingError();
      }
      throw new Error('Invalid or expired family circle invite code.');
    }
    if (!circle) {
      throw new Error('Invalid or expired family circle invite code.');
    }

    // Insert membership
    const { data: member, error: memberError } = await client
      .from('family_circle_members')
      .insert({
        circle_id: circle.id,
        user_id: userId,
        role: 'member',
        display_name: displayName?.trim() || 'Family Member',
      })
      .select('id, circle_id, user_id, role, display_name, joined_at')
      .single();

    if (memberError) {
      if (isMissingTableError(memberError)) {
        throw new DatabaseMigrationPendingError();
      }
      if (memberError.code === '23505') {
        throw new Error('You are already a member of this family safety circle.');
      }
      throw new Error(`Failed to join family circle: ${memberError.message}`);
    }

    return {
      circle: circle as FamilyCircle,
      member: member as FamilyCircleMember,
    };
  }

  async listUserCircles(accessToken: string, userId: string): Promise<Array<FamilyCircle & { role: string; memberCount: number; alertCount: number }>> {
    const client = getUserSupabaseClient(accessToken);

    const { data: memberships, error } = await client
      .from('family_circle_members')
      .select('role, circle_id, family_circles(id, name, owner_user_id, invite_code, created_at)')
      .eq('user_id', userId);

    if (error || !memberships) {
      if (isMissingTableError(error)) {
        throw new DatabaseMigrationPendingError();
      }
      throw new Error(`Failed to list family safety circles: ${error?.message ?? 'Unknown'}`);
    }

    const circlesList = [];
    for (const m of memberships) {
      const circleData = (m as any).family_circles;
      if (!circleData) continue;

      const [memberCountRes, alertCountRes] = await Promise.all([
        client.from('family_circle_members').select('id', { count: 'exact', head: true }).eq('circle_id', circleData.id),
        client.from('family_circle_alerts').select('id', { count: 'exact', head: true }).eq('circle_id', circleData.id).eq('resolved', false),
      ]);

      circlesList.push({
        ...circleData,
        role: m.role,
        memberCount: memberCountRes.count ?? 1,
        alertCount: alertCountRes.count ?? 0,
      });
    }

    return circlesList;
  }

  async getCircleDetails(
    accessToken: string,
    circleId: string,
  ): Promise<{
    circle: FamilyCircle;
    members: FamilyCircleMember[];
    alerts: FamilyCircleAlert[];
  }> {
    const client = getUserSupabaseClient(accessToken);

    const [circleRes, membersRes, alertsRes] = await Promise.all([
      client.from('family_circles').select('*').eq('id', circleId).single(),
      client.from('family_circle_members').select('*').eq('circle_id', circleId).order('joined_at', { ascending: true }),
      client.from('family_circle_alerts').select('*').eq('circle_id', circleId).order('created_at', { ascending: false }).limit(20),
    ]);

    if (circleRes.error || !circleRes.data) {
      if (isMissingTableError(circleRes.error) || isMissingTableError(membersRes.error) || isMissingTableError(alertsRes.error)) {
        throw new DatabaseMigrationPendingError();
      }
      throw new Error('Family circle not found or access denied.');
    }

    return {
      circle: circleRes.data as FamilyCircle,
      members: (membersRes.data ?? []) as FamilyCircleMember[],
      alerts: (alertsRes.data ?? []) as FamilyCircleAlert[],
    };
  }

  async broadcastCircleAlert(
    accessToken: string,
    circleId: string,
    userId: string,
    threatType: string,
    severity: 'high' | 'critical',
    summary: string,
    advice: string,
  ): Promise<FamilyCircleAlert> {
    const client = getUserSupabaseClient(accessToken);

    const { data: alert, error } = await client
      .from('family_circle_alerts')
      .insert({
        circle_id: circleId,
        triggered_by_user_id: userId,
        threat_type: threatType,
        severity,
        summary: summary.trim(),
        advice: advice.trim(),
      })
      .select('*')
      .single();

    if (error || !alert) {
      if (isMissingTableError(error)) {
        throw new DatabaseMigrationPendingError();
      }
      throw new Error(`Failed to dispatch family safety alert: ${error?.message ?? 'Unknown'}`);
    }

    return alert as FamilyCircleAlert;
  }

  async leaveCircle(accessToken: string, circleId: string, userId: string): Promise<boolean> {
    const client = getUserSupabaseClient(accessToken);

    const { error } = await client
      .from('family_circle_members')
      .delete()
      .eq('circle_id', circleId)
      .eq('user_id', userId);

    if (error) {
      if (isMissingTableError(error)) {
        throw new DatabaseMigrationPendingError();
      }
      throw new Error(`Failed to leave circle: ${error.message}`);
    }

    return true;
  }

  async updateMemberProfile(
    accessToken: string,
    circleId: string,
    userId: string,
    updates: { displayName?: string },
  ): Promise<FamilyCircleMember> {
    const client = getUserSupabaseClient(accessToken);

    // Whitelist only display_name. Protected fields (role, circle_id, user_id) cannot be modified.
    const sanitizedUpdates: { display_name?: string } = {};
    if (typeof updates.displayName === 'string') {
      const trimmed = updates.displayName.trim();
      if (trimmed.length < 1 || trimmed.length > 64) {
        throw new Error('Display name must be between 1 and 64 characters.');
      }
      sanitizedUpdates.display_name = trimmed;
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      throw new Error('No valid update fields provided.');
    }

    const { data: member, error } = await client
      .from('family_circle_members')
      .update(sanitizedUpdates)
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .select('id, circle_id, user_id, role, display_name, joined_at')
      .single();

    if (error || !member) {
      if (isMissingTableError(error)) {
        throw new DatabaseMigrationPendingError();
      }
      throw new Error(`Failed to update member profile: ${error?.message ?? 'Unknown'}`);
    }

    return member as FamilyCircleMember;
  }
}

export const familySafetyService = new FamilySafetyService();
