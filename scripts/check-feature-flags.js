#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const configPath = path.resolve('feature-flags.json');
if (!fs.existsSync(configPath)) {
  console.error('Missing feature-flags.json at repo root.');
  process.exit(2);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  console.error('Failed to parse feature-flags.json:', err.message);
  process.exit(2);
}

const flags = Array.isArray(config.flags) ? config.flags : [];
const allowPatterns = Array.isArray(config.allowPatterns) ? config.allowPatterns : [];
const allowRegexes = allowPatterns.map((pattern) => {
  try {
    return new RegExp(pattern);
  } catch (err) {
    console.error(`Invalid allowPatterns regex "${pattern}":`, err.message);
    process.exit(2);
  }
});

const registry = new Map();
const errors = [];
const now = new Date();

for (const flag of flags) {
  if (!flag || typeof flag.name !== 'string' || flag.name.trim() === '') {
    errors.push('Invalid flag entry: missing name.');
    continue;
  }
  const name = flag.name.trim();
  if (registry.has(name)) {
    errors.push(`Duplicate flag name in registry: "${name}".`);
    continue;
  }
  if (flag.removeBy) {
    const parsed = new Date(flag.removeBy);
    if (Number.isNaN(parsed.getTime())) {
      errors.push(`Flag "${name}" has invalid removeBy date: "${flag.removeBy}".`);
    } else if (parsed < now && flag.status !== 'retired') {
      errors.push(`Flag "${name}" removeBy date has passed (${flag.removeBy}).`);
    }
  }
  registry.set(name, flag);
}

function listTrackedFiles() {
  const output = execSync('git ls-files -z', { encoding: 'utf8' });
  return output.split('\0').filter(Boolean);
}

function shouldScan(filePath) {
  if (!filePath.startsWith('src/') && !filePath.startsWith('server/')) return false;
  if (filePath.includes('/e2e/')) return false;
  if (/\.(test|spec)\.[tj]sx?$/.test(filePath)) return false;
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath);
}

const usedFlags = new Set();
const flagRegex = /\b(?:isFeatureEnabled|getFlagPercentage)\(\s*['"`]([^'"`]+)['"`]/g;

let files = [];
try {
  files = listTrackedFiles();
} catch (err) {
  console.error('Failed to list git tracked files:', err.message);
  process.exit(2);
}

for (const file of files) {
  if (!shouldScan(file)) continue;
  const contents = fs.readFileSync(file, 'utf8');
  for (const match of contents.matchAll(flagRegex)) {
    const flagName = match[1];
    if (flagName) usedFlags.add(flagName);
  }
}

function isAllowed(flagName) {
  return allowRegexes.some((regex) => regex.test(flagName));
}

for (const flagName of usedFlags) {
  if (!registry.has(flagName) && !isAllowed(flagName)) {
    errors.push(`Feature flag "${flagName}" is used in code but missing from feature-flags.json.`);
  }
}

for (const [name, flag] of registry.entries()) {
  if (flag.status === 'retired') continue;
  if (!usedFlags.has(name)) {
    errors.push(`Feature flag "${name}" is in registry but not referenced in code.`);
  }
}

if (errors.length > 0) {
  console.error('Feature flag validation failed:');
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log(`Feature flag validation passed (${usedFlags.size} flag(s) referenced).`);
