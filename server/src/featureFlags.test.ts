import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Feature Flags', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('with empty flags (allowAll)', () => {
    it('enables all flags when FEATURE_FLAGS is empty', async () => {
      vi.doMock('./config.js', () => ({
        observabilityConfig: { featureFlags: '' },
      }));

      const { isFeatureEnabled, getEnabledFlags } = await import('./featureFlags.js');

      expect(isFeatureEnabled('any_flag')).toBe(true);
      expect(isFeatureEnabled('another_flag')).toBe(true);
      expect(getEnabledFlags()).toEqual(['*']);
    });
  });

  describe('with specific flags', () => {
    it('enables only specified flags', async () => {
      vi.doMock('./config.js', () => ({
        observabilityConfig: { featureFlags: 'enabled_flag,other_flag' },
      }));

      const { isFeatureEnabled, getEnabledFlags } = await import('./featureFlags.js');

      expect(isFeatureEnabled('enabled_flag')).toBe(true);
      expect(isFeatureEnabled('other_flag')).toBe(true);
      expect(isFeatureEnabled('disabled_flag')).toBe(false);
      expect(getEnabledFlags()).toContain('enabled_flag');
      expect(getEnabledFlags()).toContain('other_flag');
    });
  });

  describe('with percentage rollout', () => {
    it('returns percentage for flag with rollout', async () => {
      vi.doMock('./config.js', () => ({
        observabilityConfig: { featureFlags: 'new_ui:25' },
      }));

      const { getFlagPercentage } = await import('./featureFlags.js');

      expect(getFlagPercentage('new_ui')).toBe(25);
    });

    it('returns 100 for flag without percentage', async () => {
      vi.doMock('./config.js', () => ({
        observabilityConfig: { featureFlags: 'full_rollout' },
      }));

      const { getFlagPercentage } = await import('./featureFlags.js');

      expect(getFlagPercentage('full_rollout')).toBe(100);
    });

    it('returns null for unknown flag', async () => {
      vi.doMock('./config.js', () => ({
        observabilityConfig: { featureFlags: 'known_flag' },
      }));

      const { getFlagPercentage } = await import('./featureFlags.js');

      expect(getFlagPercentage('unknown_flag')).toBe(null);
    });

    it('clamps percentage to 0-100 range', async () => {
      vi.doMock('./config.js', () => ({
        observabilityConfig: { featureFlags: 'high:150,low:-10' },
      }));

      const { getFlagPercentage } = await import('./featureFlags.js');

      expect(getFlagPercentage('high')).toBe(100);
      expect(getFlagPercentage('low')).toBe(0);
    });
  });

  describe('isFeatureEnabled with context', () => {
    it('uses stable bucketing for percentage rollout', async () => {
      vi.doMock('./config.js', () => ({
        observabilityConfig: { featureFlags: 'test_flag:50' },
      }));

      const { isFeatureEnabled } = await import('./featureFlags.js');

      // Same context key should always return same result
      const result1 = isFeatureEnabled('test_flag', 'user-123');
      const result2 = isFeatureEnabled('test_flag', 'user-123');
      expect(result1).toBe(result2);

      // Different users may get different results
      // (we can't test exact values without knowing the hash)
    });

    it('returns false for percentage flag without context', async () => {
      vi.doMock('./config.js', () => ({
        observabilityConfig: { featureFlags: 'test_flag:50' },
      }));

      const { isFeatureEnabled } = await import('./featureFlags.js');

      // Without context key, should return false for non-100% flags
      expect(isFeatureEnabled('test_flag')).toBe(false);
    });
  });
});
