import { analyzeScam, getScanHistory } from '../src/api/scanner.api';
import { apiClient } from '../src/api/client';

// Mock apiClient
jest.mock('../src/api/client', () => ({
  apiClient: jest.fn(),
}));

describe('Scanner API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('correctly maps backend nested report structure and high-risk score to DANGEROUS verdict', async () => {
    (apiClient as jest.Mock).mockResolvedValueOnce({
      success: true,
      report: {
        scanId: 'scan-uuid-123',
        riskScore: 88,
        riskLevel: 'HIGH',
        verdict: 'Likely Malicious',
        findings: [
          { title: 'Typosquatting', points: 40, detail: 'Domain mimics SBI', severity: 'high' },
          { title: 'Urgency', points: 30, detail: 'Urgent panic triggers', severity: 'high' },
        ],
        aiSummary: {
          summary: 'Critical phishing syndicate domain.',
          reasoning: ['Impersonation detected'],
        },
        recommendations: ['Do not share OTP', 'Report to 1930'],
        createdAt: '2026-11-16T10:00:00.000Z',
      },
    });

    const result = await analyzeScam('url', 'http://kyc-blocked-sbi.xyz/update');

    expect(apiClient).toHaveBeenCalledWith('/scanner/analyze', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        type: 'url',
        content: 'http://kyc-blocked-sbi.xyz/update',
        allowExternalChecks: true,
      }),
    }));

    expect(result.id).toBe('scan-uuid-123');
    expect(result.verdict).toBe('DANGEROUS');
    expect(result.riskScore).toBe(88);
    expect(result.threatLevel).toBe('high');
    expect(result.summary).toBe('Critical phishing syndicate domain.');
    expect(result.factors?.length).toBe(2);
  });

  it('maps "text" type to "sms" to conform to backend scanRequestSchema', async () => {
    (apiClient as jest.Mock).mockResolvedValueOnce({
      success: true,
      report: {
        scanId: 'scan-sms-456',
        riskScore: 75,
        riskLevel: 'HIGH',
        verdict: 'Suspicious',
        findings: [],
        summary: 'Electricity disconnection threat SMS',
        recommendations: ['Verify with electricity provider'],
      },
    });

    const result = await analyzeScam('text', 'Electricity power will be cut tonight at 9:30 PM. Call 9876543210.');

    expect(apiClient).toHaveBeenCalledWith('/scanner/analyze', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        type: 'sms',
        content: 'Electricity power will be cut tonight at 9:30 PM. Call 9876543210.',
        allowExternalChecks: true,
      }),
    }));

    expect(result.riskScore).toBe(75);
    expect(result.verdict).toBe('DANGEROUS');
  });

  it('attaches email metadata when scan type is email', async () => {
    (apiClient as jest.Mock).mockResolvedValueOnce({
      success: true,
      report: {
        scanId: 'scan-email-789',
        riskScore: 10,
        riskLevel: 'LOW',
        verdict: 'Likely Safe',
        findings: [],
        summary: 'Legitimate sender',
      },
    });

    await analyzeScam('email', 'Subject: Your Monthly Statement\nFrom: alerts@hdfcbank.net');

    expect(apiClient).toHaveBeenCalledWith('/scanner/analyze', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        type: 'email',
        content: 'Subject: Your Monthly Statement\nFrom: alerts@hdfcbank.net',
        allowExternalChecks: true,
        metadata: {
          sender: 'inspection-request@cybersaathi.local',
          subject: 'Scam Inspection',
        },
      }),
    }));
  });

  it('unpacks backend { success: true, records: [...] } scan history', async () => {
    (apiClient as jest.Mock).mockResolvedValueOnce({
      success: true,
      records: [
        {
          id: 'hist-1',
          scan_type: 'sms',
          submittedContentRedacted: 'Electricity bill warning...',
          risk_score: 82,
          risk_level: 'High Risk',
          verdict: 'Likely Malicious',
          findings: [{ title: 'Urgency trigger', detail: 'Threatens power cut', severity: 'high' }],
          recommendations: ['Ignore SMS'],
          created_at: '2026-11-16T09:00:00.000Z',
        },
      ],
    });

    const history = await getScanHistory();

    expect(history.length).toBe(1);
    expect(history[0].id).toBe('hist-1');
    expect(history[0].type).toBe('text');
    expect(history[0].riskScore).toBe(82);
    expect(history[0].verdict).toBe('DANGEROUS');
    expect(history[0].explanation).toContain('Threatens power cut');
  });
});
