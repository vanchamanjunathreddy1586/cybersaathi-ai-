import { sendChatMessage, analyzeVoiceAudio } from '../src/api/assistant.api';
import { apiClient } from '../src/api/client';

jest.mock('../src/api/client', () => ({
  apiClient: jest.fn(),
}));

describe('Assistant API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('correctly unpacks backend messages array response', async () => {
    (apiClient as jest.Mock).mockResolvedValueOnce({
      success: true,
      messages: [
        {
          id: 'user-msg-1',
          conversation_id: 'conv-123',
          role: 'user',
          content: 'What should I do if money was debited via fake UPI QR?',
          language: 'en',
          created_at: '2026-11-16T10:00:00.000Z',
        },
        {
          id: 'asst-msg-2',
          conversation_id: 'conv-123',
          role: 'assistant',
          content: 'Immediately dial 1930 to freeze the beneficiary account during the golden hour.',
          language: 'en',
          created_at: '2026-11-16T10:00:02.000Z',
        },
      ],
      contextUsed: [],
    });

    const result = await sendChatMessage({
      conversationId: 'conv-123',
      content: 'What should I do if money was debited via fake UPI QR?',
      language: 'en',
      mode: 'chat',
    });

    expect(apiClient).toHaveBeenCalledWith('/assistant/conversations/conv-123/messages', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        content: 'What should I do if money was debited via fake UPI QR?',
        language: 'en',
        mode: 'chat',
        context: {},
      }),
    }));

    expect(result.userMessage.id).toBe('user-msg-1');
    expect(result.userMessage.role).toBe('user');
    expect(result.assistantMessage.id).toBe('asst-msg-2');
    expect(result.assistantMessage.content).toContain('Immediately dial 1930');
  });

  it('submits voice audio using multipart/form-data to /call-scanner/analyze-audio', async () => {
    (apiClient as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        detectedLanguage: 'hi',
        fullTranscriptText: 'मेरे बैंक खाते से अनधिकृत UPI ट्रांजैक्शन हुआ है',
        riskScore: 85,
        verdict: 'Likely Scam',
        detectedTactics: [{ title: 'Financial Demand', severity: 'critical' }],
      },
    });

    const result = await analyzeVoiceAudio('file:///var/mobile/recording.m4a', 'hi');

    expect(apiClient).toHaveBeenCalledWith('/call-scanner/analyze-audio', expect.objectContaining({
      method: 'POST',
      body: expect.any(FormData),
      timeoutMs: 30000,
    }));

    expect(result.detectedLanguage).toBe('hi');
    expect(result.riskScore).toBe(85);
    expect(result.verdict).toBe('Likely Scam');
  });
});
