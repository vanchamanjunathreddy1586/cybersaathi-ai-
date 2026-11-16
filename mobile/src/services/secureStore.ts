import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Hardware-backed secure storage adapter for Supabase client.
 * Falls back to memory/session storage on web where SecureStore is not supported.
 */
class SecureStoreAdapter {
  private memoryFallback: Map<string, string> = new Map();

  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
      } catch {
        // Fall back to in-memory map
      }
      return this.memoryFallback.get(key) ?? null;
    }

    try {
      const result = await SecureStore.getItemAsync(key);
      return result ?? null;
    } catch (error) {
      console.warn(`[SecureStore] Failed to read key "${key}":`, error);
      return this.memoryFallback.get(key) ?? null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
          return;
        }
      } catch {
        // Fall back to in-memory map
      }
      this.memoryFallback.set(key, value);
      return;
    }

    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    } catch (error) {
      console.warn(`[SecureStore] Failed to save key "${key}":`, error);
      this.memoryFallback.set(key, value);
    }
  }

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
          return;
        }
      } catch {
        // Fall back to in-memory map
      }
      this.memoryFallback.delete(key);
      return;
    }

    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn(`[SecureStore] Failed to delete key "${key}":`, error);
      this.memoryFallback.delete(key);
    }
  }
}

export const secureStorage = new SecureStoreAdapter();
