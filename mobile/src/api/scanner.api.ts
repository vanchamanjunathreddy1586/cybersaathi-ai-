import { apiClient } from './client';

export type ScanType = 'url' | 'text' | 'email' | 'qr';

export type ThreatLevel = 'safe' | 'low' | 'suspicious' | 'medium' | 'dangerous' | 'high' | 'critical';

export interface ScanFactor {
  name: string;
  score: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ScanResult {
  id?: string;
  type: ScanType;
  target: string;
  riskScore: number; // 0 - 100
  verdict: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS';
  threatLevel: ThreatLevel;
  summary: string;
  explanation: string[];
  factors?: ScanFactor[];
  recommendations: string[];
  timestamp: string;
}

export async function analyzeScam(type: ScanType, content: string): Promise<ScanResult> {
  const backendType = type === 'text' ? 'sms' : type;
  const payload: Record<string, any> = {
    type: backendType,
    content: content.trim(),
    allowExternalChecks: true,
  };

  if (backendType === 'email') {
    payload.metadata = {
      sender: 'inspection-request@cybersaathi.local',
      subject: 'Scam Inspection',
    };
  }

  const response = await apiClient<any>('/scanner/analyze', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  // Extract report from backend response structure: { success: true, report: { ... } }
  const report = response.report || response;
  const riskScore = report.riskScore ?? report.score ?? 0;

  let verdict: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' = 'SAFE';
  if (riskScore >= 70 || report.verdict === 'Likely Malicious' || report.verdict === 'DANGEROUS') {
    verdict = 'DANGEROUS';
  } else if (riskScore >= 35 || report.verdict === 'Suspicious') {
    verdict = 'SUSPICIOUS';
  }

  const factors: ScanFactor[] = report.findings?.map((f: any) => ({
    name: f.title,
    score: f.points,
    description: f.detail,
    severity: f.severity,
  })) || report.factors || [];

  return {
    id: report.scanId || report.id || `scan-${Date.now()}`,
    type,
    target: content,
    riskScore,
    verdict,
    threatLevel: report.riskLevel?.toLowerCase() || (verdict === 'DANGEROUS' ? 'high' : verdict === 'SUSPICIOUS' ? 'medium' : 'safe'),
    summary: report.aiSummary?.summary || report.summary || report.verdictReason || 'Analysis completed successfully.',
    explanation: Array.isArray(report.explanation)
      ? report.explanation
      : typeof report.explanation === 'string'
      ? [report.explanation]
      : factors.map((f) => f.description),
    factors,
    recommendations: report.recommendations || [
      'Do not click unknown links or share OTPs.',
      'Verify the sender identity directly through official channels.',
    ],
    timestamp: report.createdAt || report.timestamp || new Date().toISOString(),
  };
}

export async function getScanHistory(): Promise<ScanResult[]> {
  try {
    const res = await apiClient<any>('/scanner/history');
    const records = res?.records || (Array.isArray(res) ? res : []);
    if (!Array.isArray(records)) return [];

    return records.map((item: any) => {
      const riskScore = item.risk_score ?? item.riskScore ?? item.score ?? 0;
      let verdict: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' = 'SAFE';
      if (riskScore >= 70 || item.verdict === 'Likely Malicious') {
        verdict = 'DANGEROUS';
      } else if (riskScore >= 35 || item.verdict === 'Suspicious') {
        verdict = 'SUSPICIOUS';
      }

      return {
        id: item.id,
        type: (item.scan_type === 'sms' ? 'text' : item.scan_type) || item.type || 'url',
        target: item.submittedContentRedacted || item.target || item.url || item.content || 'Target Scanned',
        riskScore,
        verdict: item.verdict ? (verdict) : verdict,
        threatLevel: item.risk_level?.toLowerCase() || item.threatLevel || (verdict === 'DANGEROUS' ? 'high' : 'low'),
        summary: item.verdict ? `${item.verdict} (${riskScore}/100)` : 'Scan performed',
        explanation: item.findings?.map((f: any) => f.detail || f.title) || item.explanation || [],
        recommendations: item.recommendations || [],
        timestamp: item.created_at || item.timestamp || new Date().toISOString(),
      };
    });
  } catch (err) {
    console.warn('[ScannerAPI] Failed to fetch scan history:', err);
    return [];
  }
}

export async function deleteScanHistory(id: string): Promise<boolean> {
  try {
    await apiClient(`/scanner/history/${id}`, { method: 'DELETE' });
    return true;
  } catch (err) {
    console.warn('[ScannerAPI] Failed to delete scan item:', err);
    return false;
  }
}
