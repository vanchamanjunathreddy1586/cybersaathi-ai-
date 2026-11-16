import { evaluateDeviceSecurityPosture } from '../src/services/deviceSecurity';

describe('Device Security Posture Evaluator', () => {
  it('returns a calculated posture score and valid rating', async () => {
    const posture = await evaluateDeviceSecurityPosture();

    expect(typeof posture.score).toBe('number');
    expect(posture.score).toBeGreaterThanOrEqual(0);
    expect(posture.score).toBeLessThanOrEqual(100);
    expect(['SECURE', 'MODERATE', 'VULNERABLE']).toContain(posture.rating);
    expect(Array.isArray(posture.recommendations)).toBe(true);
  });

  it('populates device model and OS metadata', async () => {
    const posture = await evaluateDeviceSecurityPosture();
    expect(typeof posture.osName).toBe('string');
    expect(typeof posture.osVersion).toBe('string');
    expect(typeof posture.deviceModel).toBe('string');
  });
});
