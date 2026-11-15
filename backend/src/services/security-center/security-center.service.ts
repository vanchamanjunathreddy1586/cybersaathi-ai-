import { z } from 'zod';
import { getUserSupabaseClient } from '../../config/supabase.js';
import { env } from '../../config/env.js';

const scanSchema = z.object({
  id: z.string().uuid(),
  scan_type: z.enum(['url', 'sms', 'email', 'qr']),
  risk_score: z.number().int().min(0).max(100),
  risk_level: z.enum(['Low Risk', 'Medium Risk', 'High Risk', 'Critical Risk']),
  verdict: z.enum(['Likely Safe', 'Suspicious', 'Likely Malicious', 'Inconclusive']),
  findings: z.array(z.object({
    id: z.string(),
    title: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    source: z.string(),
    verified: z.boolean(),
  })),
  created_at: z.string(),
});

const eventSchema = z.object({
  id: z.string().uuid(),
  investigation_id: z.string().uuid(),
  event_type: z.enum([
    'created',
    'updated',
    'status_changed',
    'note',
    'evidence_added',
    'evidence_removed',
  ]),
  summary: z.string(),
  created_at: z.string(),
});

const lessonSchema = z.object({
  lesson_id: z.string(),
  completed_at: z.string(),
});

const alertSchema = z.object({
  id: z.string().uuid(),
  category: z.enum(['suspicious_url', 'high_risk_scan', 'investigation_update', 'evidence_added']),
  severity: z.enum(['medium', 'high', 'critical']),
  title: z.string(),
  summary: z.string(),
  entity_type: z.enum(['scan', 'investigation']),
  entity_id: z.string(),
  read_at: z.string().nullable(),
  created_at: z.string(),
});

const preferencesSchema = z.object({
  critical_alerts: z.boolean(),
  high_risk_alerts: z.boolean(),
  investigation_updates: z.boolean(),
  community_notifications: z.boolean(),
  learning_reminders: z.boolean(),
  browser_notifications: z.boolean(),
});

function assertQuery<T>(data: unknown, schema: z.ZodType<T>, operation: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(operation);
  return parsed.data;
}

function asDateKey(iso: string, granularity: 'day' | 'month') {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error('INVALID_SECURITY_ACTIVITY_DATE');
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  if (granularity === 'month') return `${year}-${month}`;
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfUtcPeriod(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days + 1);
  return date.toISOString();
}

export async function getSecurityDashboard(accessToken: string, days: number) {
  const client = getUserSupabaseClient(accessToken);
  const start = startOfUtcPeriod(days);
  const [totalScans, safeScans, suspiciousScans, maliciousScans, openCases, activeCases,
    resolvedCases, scansResult, investigationResult, lessonsResult, alertsResult,
    unreadAlertsResult] = await Promise.all([
    client.from('scan_results').select('id', { count: 'exact', head: true }),
    client.from('scan_results').select('id', { count: 'exact', head: true }).eq('verdict', 'Likely Safe'),
    client.from('scan_results').select('id', { count: 'exact', head: true }).eq('verdict', 'Suspicious'),
    client.from('scan_results').select('id', { count: 'exact', head: true }).eq('verdict', 'Likely Malicious'),
    client.from('investigations').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    client.from('investigations').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
    client.from('investigations').select('id', { count: 'exact', head: true }).eq('status', 'resolved'),
    client.from('scan_results')
      .select('id, scan_type, risk_score, risk_level, verdict, findings, created_at')
      .gte('created_at', start).order('created_at', { ascending: true }).limit(5000),
    client.from('investigation_events')
      .select('id, investigation_id, event_type, summary, created_at')
      .gte('created_at', start).order('created_at', { ascending: true }).limit(5000),
    client.from('user_lesson_progress')
      .select('lesson_id, completed_at')
      .gte('completed_at', start).order('completed_at', { ascending: true }).limit(5000),
    client.from('security_alerts')
      .select('id, category, severity, title, summary, entity_type, entity_id, read_at, created_at')
      .order('created_at', { ascending: false }).limit(30),
    client.from('security_alerts').select('id', { count: 'exact', head: true }).is('read_at', null),
  ]);
  const errors = [
    totalScans.error, safeScans.error, suspiciousScans.error, maliciousScans.error,
    openCases.error, activeCases.error, resolvedCases.error, scansResult.error,
    investigationResult.error, lessonsResult.error, alertsResult.error, unreadAlertsResult.error,
  ];
  if (errors.some(Boolean)) throw new Error('SECURITY_DASHBOARD_UNAVAILABLE');

  const scans = assertQuery(scansResult.data, z.array(scanSchema), 'INVALID_SECURITY_SCAN_DATA');
  const investigationEvents = assertQuery(
    investigationResult.data,
    z.array(eventSchema),
    'INVALID_INVESTIGATION_ACTIVITY',
  );
  const lessons = assertQuery(lessonsResult.data, z.array(lessonSchema), 'INVALID_LEARNING_ACTIVITY');
  const alerts = assertQuery(alertsResult.data, z.array(alertSchema), 'INVALID_SECURITY_ALERTS');

  const chartGranularity = days > 90 ? 'month' : 'day';
  const bucketMap = new Map<string, { scans: number; investigations: number; lessons: number }>();
  const ensureBucket = (timestamp: string) => {
    const key = asDateKey(timestamp, chartGranularity);
    const bucket = bucketMap.get(key) ?? { scans: 0, investigations: 0, lessons: 0 };
    bucketMap.set(key, bucket);
    return bucket;
  };
  for (const scan of scans) ensureBucket(scan.created_at).scans += 1;
  for (const event of investigationEvents) ensureBucket(event.created_at).investigations += 1;
  for (const lesson of lessons) ensureBucket(lesson.completed_at).lessons += 1;

  const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const scan of scans) {
    const category = scan.risk_level.replace(' Risk', '').toLowerCase() as keyof typeof riskCounts;
    riskCounts[category] += 1;
  }
  const observationMap = new Map<string, { title: string; category: string; count: number; verified: number }>();
  for (const scan of scans) {
    for (const finding of scan.findings) {
      const current = observationMap.get(finding.id) ?? {
        title: finding.title,
        category: finding.id,
        count: 0,
        verified: 0,
      };
      current.count += 1;
      if (finding.verified) current.verified += 1;
      observationMap.set(finding.id, current);
    }
  }
  const observations = [...observationMap.values()]
    .filter((item) => item.count > 0)
    .sort((first, second) => second.count - first.count || first.title.localeCompare(second.title))
    .slice(0, 8)
    .map((item) => ({
      ...item,
      basis: 'Observed in saved scan findings during the selected period.',
      lessonId: item.category.includes('otp') || item.category.includes('phishing')
        ? 'phishing-beginner'
        : item.category.includes('remote-access') || item.category.includes('payment')
          ? 'phishing-intermediate'
          : item.category.startsWith('url-')
            ? 'web-security-beginner'
            : null,
    }));

  const recentEvents = [
    ...scans.map((scan) => ({
      id: `scan:${scan.id}`,
      kind: 'scan' as const,
      title: `${scan.scan_type.toUpperCase()} scan · ${scan.verdict}`,
      detail: `Risk score ${scan.risk_score}/100`,
      created_at: scan.created_at,
      severity: scan.risk_score >= 80 ? 'critical' : scan.risk_score >= 30 ? 'high' : 'low',
    })),
    ...investigationEvents.map((event) => ({
      id: `investigation:${event.id}`,
      kind: 'investigation' as const,
      title: event.summary,
      detail: 'Investigation event',
      created_at: event.created_at,
      severity: 'info',
    })),
    ...lessons.map((lesson) => ({
      id: `lesson:${lesson.lesson_id}:${lesson.completed_at}`,
      kind: 'learning' as const,
      title: 'Academy lesson completed',
      detail: 'Saved learning activity',
      created_at: lesson.completed_at,
      severity: 'info',
    })),
  ].sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at)).slice(0, 12);

  const truncated = scans.length === 5000 || investigationEvents.length === 5000 || lessons.length === 5000;
  return {
    generatedAt: new Date().toISOString(),
    days,
    start,
    summary: {
      totalScans: totalScans.count ?? 0,
      safeScans: safeScans.count ?? 0,
      suspiciousScans: suspiciousScans.count ?? 0,
      maliciousScans: maliciousScans.count ?? 0,
      inconclusiveScans: Math.max(
        0,
        (totalScans.count ?? 0) - (safeScans.count ?? 0) -
        (suspiciousScans.count ?? 0) - (maliciousScans.count ?? 0),
      ),
      activeInvestigations: (openCases.count ?? 0) + (activeCases.count ?? 0),
      openInvestigations: openCases.count ?? 0,
      inProgressInvestigations: activeCases.count ?? 0,
      resolvedInvestigations: resolvedCases.count ?? 0,
      lessonsCompleted: lessons.length,
      lessonsInSelectedPeriodMayBeTruncated: lessons.length === 5000,
    },
    activity: [...bucketMap.entries()].sort(([first], [second]) => first.localeCompare(second))
      .map(([date, counts]) => ({ date, ...counts })),
    chartGranularity,
    riskDistribution: Object.entries(riskCounts).map(([name, value]) => ({ name, value })),
    investigationDistribution: [
      { name: 'Open', value: openCases.count ?? 0 },
      { name: 'In progress', value: activeCases.count ?? 0 },
      { name: 'Resolved', value: resolvedCases.count ?? 0 },
    ],
    observations,
    recentEvents,
    alerts,
    unreadAlertCount: unreadAlertsResult.count ?? 0,
    dataLimits: { truncated, chartRecordLimit: 5000 },
    communityActivity: {
      available: false,
      reason: 'Nexconn does not expose a user-specific security activity feed to this application.',
    },
  };
}

export async function getNotificationPreferences(accessToken: string, userId: string) {
  const client = getUserSupabaseClient(accessToken);
  const { data, error } = await client.from('user_notification_preferences')
    .select('critical_alerts, high_risk_alerts, investigation_updates, community_notifications, learning_reminders, browser_notifications')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('NOTIFICATION_PREFERENCES_UNAVAILABLE');
  if (!data) {
    return {
      critical_alerts: true,
      high_risk_alerts: true,
      investigation_updates: true,
      community_notifications: true,
      learning_reminders: false,
      browser_notifications: false,
    };
  }
  return assertQuery(data, preferencesSchema, 'INVALID_NOTIFICATION_PREFERENCES');
}

export async function saveNotificationPreferences(
  accessToken: string,
  userId: string,
  input: z.infer<typeof preferencesSchema>,
) {
  const client = getUserSupabaseClient(accessToken);
  const { error } = await client.from('user_notification_preferences').upsert({
    ...preferencesSchema.parse(input),
    user_id: userId,
  }, { onConflict: 'user_id' });
  if (error) throw new Error('NOTIFICATION_PREFERENCES_SAVE_FAILED');
  return input;
}

export async function listSecurityAlerts(accessToken: string, severity?: string) {
  const client = getUserSupabaseClient(accessToken);
  let query = client.from('security_alerts')
    .select('id, category, severity, title, summary, entity_type, entity_id, read_at, created_at')
    .order('created_at', { ascending: false }).limit(100);
  if (severity && severity !== 'all') query = query.eq('severity', severity);
  const { data, error } = await query;
  if (error) throw new Error('SECURITY_ALERTS_UNAVAILABLE');
  return assertQuery(data, z.array(alertSchema), 'INVALID_SECURITY_ALERTS');
}

export async function markSecurityAlertRead(accessToken: string, alertId: string) {
  const client = getUserSupabaseClient(accessToken);
  const { data, error } = await client.from('security_alerts')
    .update({ read_at: new Date().toISOString() })
    .eq('id', alertId)
    .is('read_at', null)
    .select('id')
    .maybeSingle();
  if (error) throw new Error('SECURITY_ALERT_UPDATE_FAILED');
  return data !== null;
}

export async function markAllSecurityAlertsRead(accessToken: string) {
  const client = getUserSupabaseClient(accessToken);
  const { error } = await client.from('security_alerts')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw new Error('SECURITY_ALERT_UPDATE_FAILED');
}

export async function deleteSecurityAlert(accessToken: string, alertId: string) {
  const client = getUserSupabaseClient(accessToken);
  const { data, error } = await client.from('security_alerts')
    .delete().eq('id', alertId).select('id').maybeSingle();
  if (error) throw new Error('SECURITY_ALERT_DELETE_FAILED');
  return data !== null;
}

export function getProviderConfiguration() {
  return [
    { name: 'Google Safe Browsing', configured: Boolean(env.googleSafeBrowsingApiKey) },
    { name: 'VirusTotal', configured: Boolean(env.virusTotalApiKey) },
  ];
}
