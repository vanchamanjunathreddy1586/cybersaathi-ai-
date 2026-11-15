import crypto from 'node:crypto';
import { z } from 'zod';
import { getUserSupabaseClient } from '../../config/supabase.js';

export interface FamilyCircle {
  id: string;
  name: string;
  owner_user_id: string;
  invite_code: string;
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
      throw new Error(`Failed to create family circle: ${circleError?.message ?? 'Unknown'}`);
    }

    // Automatically add owner as guardian
    const { error: memberError } = await client
      .from('family_circle_members')
      .insert({
        circle_id: circle.id,
        user_id: ownerUserId,
        role: 'guardian',
        display_name: displayName?.trim() || 'Circle Guardian',
      });

    if (memberError) {
      throw new Error(`Failed to initialize circle guardian: ${memberError.message}`);
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

    const { data: circle, error: circleError } = await client
      .from('family_circles')
      .select('id, name, owner_user_id, invite_code, created_at')
      .eq('invite_code', cleanCode)
      .maybeSingle();

    if (circleError || !circle) {
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
      throw new Error(`Failed to leave circle: ${error.message}`);
    }

    return true;
  }
}

export const familySafetyService = new FamilySafetyService();
