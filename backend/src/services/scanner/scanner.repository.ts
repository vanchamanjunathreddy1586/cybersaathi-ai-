import { z } from 'zod';
import { getUserSupabaseClient } from '../../config/supabase.js';
import type { ScanReport } from './scanner.service.js';
import { scanFindingSchema, scanTypes } from './scanner.schema.js';

const riskLevelSchema = z.enum(['Low Risk', 'Medium Risk', 'High Risk', 'Critical Risk']);
const verdictSchema = z.enum(['Likely Safe', 'Suspicious', 'Likely Malicious', 'Inconclusive']);

const scanHistoryRowSchema = z.object({
  id: z.string().uuid(),
  scan_type: z.enum(scanTypes),
  risk_score: z.number().int().min(0).max(100),
  risk_level: riskLevelSchema,
  verdict: verdictSchema,
  confidence: z.number().int().min(0).max(100),
  findings: z.array(scanFindingSchema),
  evidence: z.array(z.object({
    findingId: z.string(),
    source: z.string(),
    detail: z.string(),
  })),
  recommendations: z.array(z.string()),
  checks_performed: z.array(z.string()),
  checks_unavailable: z.array(z.string()),
  created_at: z.string(),
});

export type ScanHistoryRecord = z.infer<typeof scanHistoryRowSchema>;

export async function verifyAccessToken(accessToken: string): Promise<string | null> {
  const client = getUserSupabaseClient(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user?.id) return null;
  return data.user.id;
}

export async function saveScan(
  accessToken: string,
  userId: string,
  report: ScanReport,
): Promise<{ saved: true } | { saved: false; errorCode: string }> {
  const client = getUserSupabaseClient(accessToken);
  const { error } = await client.from('scan_results').insert({
    id: report.scanId,
    user_id: userId,
    scan_type: report.scanType,
    risk_score: report.riskScore,
    risk_level: report.riskLevel,
    verdict: report.verdict,
    confidence: report.confidence,
    findings: report.findings,
    evidence: report.evidence,
    recommendations: report.recommendations,
    checks_performed: report.checksPerformed,
    checks_unavailable: report.checksUnavailable,
  }).select('id').single();

  if (error) {
    return {
      saved: false,
      errorCode: /^[A-Z0-9_-]{1,32}$/i.test(error.code) ? error.code : 'SCAN_SAVE_FAILED',
    };
  }
  return { saved: true };
}

export async function listScans(
  accessToken: string,
  options: { limit: number; offset: number; type?: string },
): Promise<ScanHistoryRecord[]> {
  const client = getUserSupabaseClient(accessToken);
  let query = client.from('scan_results')
    .select('id, scan_type, risk_score, risk_level, verdict, confidence, findings, evidence, recommendations, checks_performed, checks_unavailable, created_at')
    .order('created_at', { ascending: false })
    .range(options.offset, options.offset + options.limit - 1);
  if (options.type) query = query.eq('scan_type', options.type);
  const { data, error } = await query;
  if (error) throw new Error('SCAN_HISTORY_UNAVAILABLE');
  const parsed = z.array(scanHistoryRowSchema).safeParse(data);
  if (!parsed.success) throw new Error('INVALID_SCAN_HISTORY');
  return parsed.data;
}

export async function getScan(
  accessToken: string,
  scanId: string,
): Promise<ScanHistoryRecord | null> {
  const client = getUserSupabaseClient(accessToken);
  const { data, error } = await client.from('scan_results')
    .select('id, scan_type, risk_score, risk_level, verdict, confidence, findings, evidence, recommendations, checks_performed, checks_unavailable, created_at')
    .eq('id', scanId)
    .maybeSingle();
  if (error) throw new Error('SCAN_HISTORY_UNAVAILABLE');
  if (!data) return null;
  const parsed = scanHistoryRowSchema.safeParse(data);
  if (!parsed.success) throw new Error('INVALID_SCAN_HISTORY');
  return parsed.data;
}

export async function deleteScan(
  accessToken: string,
  scanId: string,
): Promise<boolean> {
  const client = getUserSupabaseClient(accessToken);
  const { data, error } = await client.from('scan_results')
    .delete()
    .eq('id', scanId)
    .select('id')
    .maybeSingle();
  if (error) throw new Error('SCAN_DELETE_FAILED');
  return data !== null;
}
