import { describe, it, expect, vi } from 'vitest';

async function loadFlags(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) {
    delete process.env.VITE_FEATURE_FLAGS;
  } else {
    process.env.VITE_FEATURE_FLAGS = value;
  }
  return await import('./featureFlags');
}

describe('feature flags', () => {
  it('enables all flags when allowlist is empty', async () => {
    const { isFeatureEnabled, getEnabledFlags } = await loadFlags('');
    expect(isFeatureEnabled('anything')).toBe(true);
    expect(getEnabledFlags()).toEqual(['*']);
  });

  it('enables only flags in the allowlist', async () => {
    const { isFeatureEnabled, getEnabledFlags } = await loadFlags('alpha, beta');
    expect(isFeatureEnabled('alpha')).toBe(true);
    expect(isFeatureEnabled('beta')).toBe(true);
    expect(isFeatureEnabled('gamma')).toBe(false);
    expect(getEnabledFlags()).toEqual(['alpha', 'beta']);
  });

  it('supports percentage rollouts with a stable context key', async () => {
    const { isFeatureEnabled, getFlagPercentage } = await loadFlags('rollout:50');
    const enabled = isFeatureEnabled('rollout', 'user-123');
    expect(getFlagPercentage('rollout')).toBe(50);
    expect(typeof enabled).toBe('boolean');
  });
});
