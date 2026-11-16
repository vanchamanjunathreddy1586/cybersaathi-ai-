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

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///documents/',
  writeAsStringAsync: jest.fn(async () => {}),
  EncodingType: { UTF8: 'utf8' },
}));

// Mock Supabase
const mockUser = {
  id: 'usr_abc_123_uuid',
  email: 'ramesh@example.com',
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-11-15T12:00:00Z',
  email_confirmed_at: '2026-01-15T10:05:00Z',
  user_metadata: {
    full_name: 'Ramesh Kumar',
    display_name: 'RameshK',
    phone: '+919876543210',
    country: 'India',
    state: 'Telangana',
    city: 'Hyderabad',
    bio: 'Citizen Cyber Defender',
    preferred_language: 'te',
    avatar_url: 'https://example.com/avatar.jpg',
  },
};

const mockUpdateUser = jest.fn();
const mockGetUser = jest.fn();
const mockResend = jest.fn();
const mockSignOut = jest.fn();
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockSelect = jest.fn();

jest.mock('../src/services/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
      updateUser: (args: any) => {
        if (args?.data) {
          Object.assign(mockUser.user_metadata, args.data);
        }
        return mockUpdateUser(args);
      },
      resend: (args: any) => mockResend(args),
      signOut: () => mockSignOut(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => mockSelect(),
        }),
      }),
      update: () => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    }),
    storage: {
      from: () => ({
        upload: (...args: any[]) => mockUpload(...args),
        getPublicUrl: (...args: any[]) => mockGetPublicUrl(...args),
      }),
    },
  },
}));

import {
  getUserProfile,
  updateUserProfile,
  uploadProfilePhoto,
  removeProfilePhoto,
  changePassword,
  getUserPreferences,
  saveUserPreferences,
  exportUserData,
  resendEmailVerification,
  requestAccountDeletion,
  DEFAULT_PREFERENCES,
} from '../src/api/profile.api';

describe('Profile & Account API Service', () => {
  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
    mockUser.user_metadata = {
      full_name: 'Ramesh Kumar',
      display_name: 'RameshK',
      phone: '+919876543210',
      country: 'India',
      state: 'Telangana',
      city: 'Hyderabad',
      bio: 'Citizen Cyber Defender',
      preferred_language: 'te',
      avatar_url: 'https://example.com/avatar.jpg',
    };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockSelect.mockResolvedValue({
      data: {
        id: mockUser.id,
        full_name: 'Ramesh Kumar',
        email: 'ramesh@example.com',
        created_at: '2026-01-15T10:00:00Z',
        updated_at: '2026-11-15T12:00:00Z',
      },
      error: null,
    });
    mockUpdateUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockResend.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://storage.supabase.co/avatars/new.jpg' },
    });
  });

  describe('getUserProfile', () => {
    it('returns merged profile when authenticated', async () => {
      const profile = await getUserProfile();
      expect(profile).not.toBeNull();
      expect(profile?.id).toBe('usr_abc_123_uuid');
      expect(profile?.email).toBe('ramesh@example.com');
      expect(profile?.fullName).toBe('Ramesh Kumar');
      expect(profile?.displayName).toBe('RameshK');
      expect(profile?.emailVerified).toBe(true);
      expect(profile?.city).toBe('Hyderabad');
      expect(profile?.preferredLanguage).toBe('te');
      expect(profile?.membershipStatus).toBe('Verified Citizen');
    });

    it('returns null if authentication fails or user is missing', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Not authenticated' } });
      const profile = await getUserProfile();
      expect(profile).toBeNull();
    });

    it('falls back to auth metadata when profiles table record is missing', async () => {
      mockSelect.mockResolvedValueOnce({ data: null, error: null });
      const profile = await getUserProfile();
      expect(profile).not.toBeNull();
      expect(profile?.fullName).toBe('Ramesh Kumar');
    });
  });

  describe('updateUserProfile', () => {
    it('calls supabase.auth.updateUser and updates fields', async () => {
      mockSelect.mockResolvedValue({
        data: {
          id: mockUser.id,
          full_name: 'Ramesh Sharma',
          email: 'ramesh@example.com',
          created_at: '2026-01-15T10:00:00Z',
          updated_at: '2026-11-15T12:00:00Z',
        },
        error: null,
      });

      const updated = await updateUserProfile({
        fullName: 'Ramesh Sharma',
        displayName: 'RameshS',
        city: 'Bengaluru',
      });

      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: expect.objectContaining({
          full_name: 'Ramesh Sharma',
          display_name: 'RameshS',
          city: 'Bengaluru',
        }),
      });
      expect(updated.fullName).toBe('Ramesh Sharma');
      expect(updated.city).toBe('Bengaluru');
    });

    it('throws error when user is unauthenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
      await expect(updateUserProfile({ fullName: 'Nobody' })).rejects.toThrow(
        'Authentication required to update profile.'
      );
    });
  });

  describe('uploadProfilePhoto', () => {
    it('rejects photo exceeding 5MB limit', async () => {
      await expect(
        uploadProfilePhoto('file:///test.jpg', undefined, 6 * 1024 * 1024)
      ).rejects.toThrow('Profile photo size exceeds the 5 MB limit');
    });

    it('uploads photo successfully to storage bucket and updates profile', async () => {
      const result = await uploadProfilePhoto(
        'file:///test.jpg',
        'aGVsbG8gd29ybGQ=',
        1024 * 50
      );
      expect(result).toBe('https://storage.supabase.co/avatars/new.jpg');
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: expect.objectContaining({
          avatar_url: 'https://storage.supabase.co/avatars/new.jpg',
        }),
      });
    });
  });

  describe('removeProfilePhoto', () => {
    it('clears avatar_url in metadata', async () => {
      await removeProfilePhoto();
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: expect.objectContaining({
          avatar_url: null,
        }),
      });
    });
  });

  describe('changePassword', () => {
    it('enforces password length >= 8 characters', async () => {
      await expect(changePassword('short')).rejects.toThrow(
        'Password must be at least 8 characters long.'
      );
    });

    it('calls supabase.auth.updateUser with new password', async () => {
      await changePassword('StrongCyberSecret123!');
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: 'StrongCyberSecret123!',
      });
    });
  });

  describe('User Preferences Storage', () => {
    it('returns default preferences when nothing is stored', async () => {
      const prefs = await getUserPreferences();
      expect(prefs).toEqual(DEFAULT_PREFERENCES);
    });

    it('persists and retrieves updated preferences', async () => {
      const customPrefs = {
        ...DEFAULT_PREFERENCES,
        language: 'hi' as const,
        theme: 'oled' as const,
        notifications: {
          ...DEFAULT_PREFERENCES.notifications,
          productAnnouncements: true,
        },
      };

      await saveUserPreferences(customPrefs);
      const loaded = await getUserPreferences();
      expect(loaded.language).toBe('hi');
      expect(loaded.theme).toBe('oled');
      expect(loaded.notifications.productAnnouncements).toBe(true);
    });
  });

  describe('exportUserData', () => {
    it('generates valid JSON export containing user details and preferences', async () => {
      const profile = await getUserProfile();
      const { jsonString, fileUri } = await exportUserData(profile!, DEFAULT_PREFERENCES);

      expect(typeof jsonString).toBe('string');
      const parsed = JSON.parse(jsonString);
      expect(parsed.user.id).toBe('usr_abc_123_uuid');
      expect(parsed.user.email).toBe('ramesh@example.com');
      expect(parsed.preferences.theme).toBe('dark');
      expect(fileUri).toBeDefined();
    });
  });

  describe('resendEmailVerification', () => {
    it('calls supabase.auth.resend with signup type and email', async () => {
      const res = await resendEmailVerification('ramesh@example.com');
      expect(res.error).toBeUndefined();
      expect(mockResend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'ramesh@example.com',
      });
    });
  });

  describe('requestAccountDeletion', () => {
    it('sets deletion timestamp in user metadata and signs out user', async () => {
      const result = await requestAccountDeletion();
      expect(result).toBe(true);
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: expect.objectContaining({
          account_deletion_requested_at: expect.any(String),
        }),
      });
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
