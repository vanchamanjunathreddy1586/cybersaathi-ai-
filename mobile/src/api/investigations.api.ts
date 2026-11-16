import { apiClient } from './client';

export interface EvidenceItem {
  id: string;
  fileName: string;
  objectPath: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  created_at?: string;
}

export interface InvestigationEvent {
  id: string;
  type: string;
  summary: string;
  created_at: string;
}

export interface Investigation {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  updated_at: string;
  events?: InvestigationEvent[];
  evidence?: EvidenceItem[];
}

export interface InvestigationAnalysis {
  riskAssessment: string;
  recommendedActions: string[];
  suggestedTimeline: string[];
}

export async function listInvestigations(): Promise<Investigation[]> {
  try {
    const res = await apiClient<{ success: boolean; investigations: Investigation[] }>('/investigations');
    return res.investigations || [];
  } catch (err) {
    console.warn('[InvestigationsAPI] listInvestigations failed:', err);
    return [];
  }
}

export async function createInvestigation(params: { title: string; description?: string }): Promise<Investigation> {
  const res = await apiClient<{ success: boolean; investigation: Investigation }>('/investigations', {
    method: 'POST',
    body: JSON.stringify({
      title: params.title,
      description: params.description || '',
    }),
  });
  return res.investigation;
}

export async function getInvestigation(id: string): Promise<Investigation | null> {
  try {
    const res = await apiClient<{ success: boolean; investigation: Investigation }>(`/investigations/${id}`);
    return res.investigation;
  } catch (err) {
    console.warn('[InvestigationsAPI] getInvestigation failed:', err);
    return null;
  }
}

export async function updateInvestigation(id: string, updates: { title?: string; description?: string; status?: 'open' | 'in_progress' | 'resolved' }): Promise<Investigation> {
  const res = await apiClient<{ success: boolean; investigation: Investigation }>(`/investigations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return res.investigation;
}

export async function deleteInvestigation(id: string): Promise<boolean> {
  try {
    await apiClient(`/investigations/${id}`, { method: 'DELETE' });
    return true;
  } catch (err) {
    console.warn('[InvestigationsAPI] deleteInvestigation failed:', err);
    return false;
  }
}

export async function addCaseNote(investigationId: string, summary: string): Promise<InvestigationEvent> {
  const res = await apiClient<{ success: boolean; event: InvestigationEvent }>(`/investigations/${investigationId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ summary }),
  });
  return res.event;
}

export async function addCaseEvidence(investigationId: string, evidence: EvidenceItem): Promise<EvidenceItem> {
  const res = await apiClient<{ success: boolean; evidence: EvidenceItem }>(`/investigations/${investigationId}/evidence`, {
    method: 'POST',
    body: JSON.stringify(evidence),
  });
  return res.evidence;
}

export async function analyzeCase(investigationId: string): Promise<InvestigationAnalysis> {
  const res = await apiClient<{ success: boolean; analysis: InvestigationAnalysis }>(`/investigations/${investigationId}/analyze`, {
    method: 'POST',
    body: JSON.stringify({ allowExternalAnalysis: true }),
  });
  return res.analysis;
}
