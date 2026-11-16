import { Platform } from 'react-native';
import { supabase } from '../services/supabase';

// Resolve appropriate default URL based on execution environment
function getDefaultApiBase(): string {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  // Android Emulator maps host machine's localhost to 10.0.2.2
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001/api';
  }
  return 'http://localhost:3001/api';
}

export const API_BASE_URL = getDefaultApiBase();

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  skipAuth?: boolean;
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 20000, skipAuth = false, headers = {}, ...rest } = options;

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };

  if (!(rest.body instanceof FormData) && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  if (!skipAuth) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // Proceed without token if auth retrieval fails
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...rest,
      headers: requestHeaders,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorBody: any = null;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      const message = errorBody?.error || errorBody?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new ApiError(message, response.status, errorBody);
    }

    // Check if response has content
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new ApiError(`Request timed out after ${timeoutMs}ms`, 408);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || 'Network connectivity error', 0, error);
  }
}
