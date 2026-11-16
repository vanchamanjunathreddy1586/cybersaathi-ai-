import {
  listInvestigations,
  createInvestigation,
  addCaseEvidence,
  analyzeCase,
} from '../src/api/investigations.api';
import { apiClient } from '../src/api/client';

jest.mock('../src/api/client', () => ({
  apiClient: jest.fn(),
}));

describe('Investigations API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists existing investigations from backend', async () => {
    (apiClient as jest.Mock).mockResolvedValueOnce({
      success: true,
      investigations: [
        {
          id: 'case-101',
          title: 'SBI Phishing Scam',
          description: 'Fake SMS phishing incident',
          status: 'open',
          created_at: '2026-11-16T08:00:00.000Z',
          updated_at: '2026-11-16T08:00:00.000Z',
        },
      ],
    });

    const list = await listInvestigations();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('case-101');
    expect(list[0].title).toBe('SBI Phishing Scam');
  });

  it('creates a new investigation with title and description', async () => {
    (apiClient as jest.Mock).mockResolvedValueOnce({
      success: true,
      investigation: {
        id: 'case-102',
        title: 'Electricity Bill Extortion',
        description: 'Threat call received',
        status: 'open',
        created_at: '2026-11-16T09:00:00.000Z',
        updated_at: '2026-11-16T09:00:00.000Z',
      },
    });

    const created = await createInvestigation({
      title: 'Electricity Bill Extortion',
      description: 'Threat call received',
    });

    expect(apiClient).toHaveBeenCalledWith('/investigations', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        title: 'Electricity Bill Extortion',
        description: 'Threat call received',
      }),
    }));

    expect(created.id).toBe('case-102');
    expect(created.title).toBe('Electricity Bill Extortion');
  });

  it('submits verified evidence with SHA-256 hash', async () => {
    const evidenceItem = {
      id: 'evd-555',
      fileName: 'bank_alert.png',
      objectPath: 'evidence/case-102/bank_alert.png',
      mimeType: 'image/png',
      sizeBytes: 409600,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    };

    (apiClient as jest.Mock).mockResolvedValueOnce({
      success: true,
      evidence: evidenceItem,
    });

    const result = await addCaseEvidence('case-102', evidenceItem);

    expect(apiClient).toHaveBeenCalledWith('/investigations/case-102/evidence', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(evidenceItem),
    }));

    expect(result.id).toBe('evd-555');
    expect(result.sha256).toBe(evidenceItem.sha256);
  });

  it('requests AI investigation analysis', async () => {
    (apiClient as jest.Mock).mockResolvedValueOnce({
      success: true,
      analysis: {
        riskAssessment: 'High probability of organized scam.',
        recommendedActions: ['Freeze destination account'],
        suggestedTimeline: ['T+00: SMS received'],
      },
    });

    const result = await analyzeCase('case-102');

    expect(apiClient).toHaveBeenCalledWith('/investigations/case-102/analyze', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ allowExternalAnalysis: true }),
    }));

    expect(result.riskAssessment).toContain('organized scam');
    expect(result.recommendedActions).toContain('Freeze destination account');
  });
});
