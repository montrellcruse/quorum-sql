import { observabilityConfig } from './config.js';

const rawFlags = observabilityConfig.featureFlags || '';
const parsedFlags = rawFlags
  .split(',')
  .map((flag) => flag.trim())
  .filter(Boolean);

type FlagConfig = {
  percentage: number;
};

const flagMap = new Map<string, FlagConfig>();
for (const entry of parsedFlags) {
  const [name, percentRaw] = entry.split(':').map((part) => part.trim());
  if (!name) continue;
  const percent = percentRaw ? Number.parseInt(percentRaw, 10) : 100;
  const clamped = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 100;
  flagMap.set(name, { percentage: clamped });
}

const allowAll = flagMap.size === 0;

function stableBucket(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 100;
}

export function isFeatureEnabled(flag: string, contextKey?: string): boolean {
  if (allowAll) return true;
  const config = flagMap.get(flag);
  if (!config) return false;
  if (config.percentage >= 100) return true;
  if (!contextKey) return false;
  return stableBucket(`${flag}:${contextKey}`) < config.percentage;
}

export function getEnabledFlags(): string[] {
  return allowAll ? ['*'] : Array.from(flagMap.keys());
}

export function getFlagPercentage(flag: string): number | null {
  if (allowAll) return 100;
  const config = flagMap.get(flag);
  return config ? config.percentage : null;
}
