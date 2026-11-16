const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, val: string) => {
    mockStore.set(key, val);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
}));

import { secureStorage } from '../src/services/secureStore';

describe('SecureStore Adapter', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('stores and retrieves a string value', async () => {
    await secureStorage.setItem('test_auth_token', 'sample-jwt-token-xyz');
    const retrieved = await secureStorage.getItem('test_auth_token');
    expect(retrieved).toBe('sample-jwt-token-xyz');
  });

  it('removes stored keys correctly', async () => {
    await secureStorage.setItem('temp_key', 'temp-value');
    await secureStorage.removeItem('temp_key');
    const value = await secureStorage.getItem('temp_key');
    expect(value).toBeNull();
  });

  it('returns null for non-existent keys', async () => {
    const value = await secureStorage.getItem('non_existent_key_999');
    expect(value).toBeNull();
  });
});
