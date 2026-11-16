import { apiClient, ApiError } from '../src/api/client';
import { supabase } from '../src/services/supabase';

// Mock supabase
jest.mock('../src/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
  },
}));

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('injects Bearer token from Supabase session into request headers', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'valid-jwt-token-xyz',
        },
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (h: string) => (h === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({ success: true }),
    });

    const res = await apiClient<{ success: boolean }>('/test-auth');
    expect(res.success).toBe(true);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/test-auth'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer valid-jwt-token-xyz',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }),
      })
    );
  });

  it('omits Content-Type application/json when body is FormData to allow boundary calculation', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: { session: null },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: () => 'application/json',
      },
      json: async () => ({ success: true }),
    });

    const formData = new FormData();
    formData.append('key', 'value');

    await apiClient('/upload', {
      method: 'POST',
      body: formData,
    });

    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.headers['Content-Type']).toBeUndefined();
    expect(callArgs.headers['Accept']).toBe('application/json');
  });

  it('throws ApiError with error status and message on HTTP failure', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: { session: null },
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: {
        get: () => 'application/json',
      },
      json: async () => ({
        success: false,
        message: 'Access denied: Guardian privileges required.',
      }),
    });

    try {
      await apiClient('/protected');
      throw new Error('Expected apiClient to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(403);
      expect(err.message).toBe('Access denied: Guardian privileges required.');
    }
  });
});
