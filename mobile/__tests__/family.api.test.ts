import {
  listFamilyCircles,
  getCircleDetails,
  normalizeCircle,
  normalizeMember,
  normalizeAlert,
  isMissingTableOrPendingError,
} from '../src/api/family.api';
import { apiClient } from '../src/api/client';

jest.mock('../src/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

jest.mock('../src/api/client');

const mockedApiClient = apiClient as jest.MockedFunction<typeof apiClient>;

describe('Family Safety API & Normalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isMissingTableOrPendingError', () => {
    it('detects schema cache missing table error', () => {
      const err = new Error("Could not find the table 'public.family_circle_members' in the schema cache");
      expect(isMissingTableOrPendingError(err)).toBe(true);
    });

    it('detects relation does not exist error', () => {
      const err = new Error('relation "family_circles" does not exist');
      expect(isMissingTableOrPendingError(err)).toBe(true);
    });

    it('detects HTTP 503 DATABASE_SETUP_PENDING', () => {
      const err: any = new Error('Service Unavailable');
      err.status = 503;
      err.data = { code: 'DATABASE_SETUP_PENDING' };
      expect(isMissingTableOrPendingError(err)).toBe(true);
    });

    it('returns false for unrelated errors', () => {
      const err = new Error('Invalid credentials');
      expect(isMissingTableOrPendingError(err)).toBe(false);
    });
  });

  describe('Normalizers', () => {
    it('normalizes snake_case circle properties to camelCase and retains snake_case', () => {
      const raw = {
        id: 'c1',
        name: 'Sharma Family',
        owner_user_id: 'u1',
        invite_code: 'CS-8F2A11',
        created_at: '2026-11-16T10:00:00Z',
        role: 'guardian',
        memberCount: 3,
        alertCount: 1,
      };
      const normalized = normalizeCircle(raw);
      expect(normalized.id).toBe('c1');
      expect(normalized.name).toBe('Sharma Family');
      expect(normalized.inviteCode).toBe('CS-8F2A11');
      expect(normalized.invite_code).toBe('CS-8F2A11');
      expect(normalized.ownerUserId).toBe('u1');
      expect(normalized.role).toBe('guardian');
      expect(normalized.memberCount).toBe(3);
    });

    it('normalizes member properties', () => {
      const raw = {
        id: 'm1',
        circle_id: 'c1',
        user_id: 'u2',
        role: 'member',
        display_name: 'Mom',
        joined_at: '2026-11-16T11:00:00Z',
      };
      const member = normalizeMember(raw);
      expect(member.id).toBe('m1');
      expect(member.circleId).toBe('c1');
      expect(member.userId).toBe('u2');
      expect(member.displayName).toBe('Mom');
      expect(member.display_name).toBe('Mom');
      expect(member.role).toBe('member');
    });

    it('normalizes alert properties', () => {
      const raw = {
        id: 'a1',
        circle_id: 'c1',
        triggered_by_user_id: 'u1',
        threat_type: 'Digital Arrest Call',
        severity: 'critical',
        summary: 'Fake Mumbai police Skype call.',
        advice: 'Hang up immediately.',
        created_at: '2026-11-16T12:00:00Z',
      };
      const alert = normalizeAlert(raw);
      expect(alert.id).toBe('a1');
      expect(alert.circleId).toBe('c1');
      expect(alert.threatType).toBe('Digital Arrest Call');
      expect(alert.threat_type).toBe('Digital Arrest Call');
      expect(alert.severity).toBe('critical');
      expect(alert.summary).toBe('Fake Mumbai police Skype call.');
    });
  });

  describe('listFamilyCircles', () => {
    it('handles pending remote migration gracefully when table is missing', async () => {
      const err: any = new Error('relation "family_circles" does not exist');
      err.status = 500;
      mockedApiClient.mockRejectedValueOnce(err);

      const res = await listFamilyCircles();
      expect(res.isPendingMigration).toBe(true);
      expect(res.circles).toEqual([]);
      expect(res.errorMessage).toContain('migration');
    });

    it('handles 503 DATABASE_SETUP_PENDING gracefully', async () => {
      const err: any = new Error('Family Safety database setup is pending');
      err.status = 503;
      err.data = { code: 'DATABASE_SETUP_PENDING' };
      mockedApiClient.mockRejectedValueOnce(err);

      const res = await listFamilyCircles();
      expect(res.isPendingMigration).toBe(true);
      expect(res.circles).toEqual([]);
    });

    it('returns normalized circles on success', async () => {
      mockedApiClient.mockResolvedValueOnce({
        success: true,
        data: [
          {
            id: 'c-100',
            name: 'Verma Circle',
            invite_code: 'CS-999999',
            role: 'guardian',
            created_at: '2026-11-16T10:00:00Z',
          },
        ],
      } as any);

      const res = await listFamilyCircles();
      expect(res.isPendingMigration).toBe(false);
      expect(res.circles.length).toBe(1);
      expect(res.circles[0].name).toBe('Verma Circle');
      expect(res.circles[0].inviteCode).toBe('CS-999999');
    });
  });

  describe('getCircleDetails', () => {
    it('unpacks backend { circle, members, alerts } and returns unified circle', async () => {
      mockedApiClient.mockResolvedValueOnce({
        success: true,
        data: {
          circle: {
            id: 'c-1',
            name: 'Home Defense',
            invite_code: 'CS-123456',
            created_at: '2026-11-16T10:00:00Z',
          },
          members: [
            { id: 'm1', circle_id: 'c-1', user_id: 'u1', role: 'guardian', display_name: 'Dad', joined_at: '2026-11-16T10:00:00Z' },
            { id: 'm2', circle_id: 'c-1', user_id: 'u2', role: 'member', display_name: 'Son', joined_at: '2026-11-16T10:05:00Z' },
          ],
          alerts: [
            {
              id: 'a1',
              circle_id: 'c-1',
              threat_type: 'Digital Arrest',
              severity: 'critical',
              summary: 'Suspicious Skype call',
              advice: 'Hang up',
              created_at: '2026-11-16T10:10:00Z',
            },
          ],
        },
      } as any);

      const details = await getCircleDetails('c-1');
      expect(details).not.toBeNull();
      expect(details?.id).toBe('c-1');
      expect(details?.name).toBe('Home Defense');
      expect(details?.inviteCode).toBe('CS-123456');
      expect(details?.members?.length).toBe(2);
      expect(details?.members?.[0].displayName).toBe('Dad');
      expect(details?.alerts?.length).toBe(1);
      expect(details?.alerts?.[0].threatType).toBe('Digital Arrest');
    });
  });
});
