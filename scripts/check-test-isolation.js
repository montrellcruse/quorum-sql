#!/usr/bin/env node
import fs from 'fs';
import { execSync } from 'child_process';

function listSpecFiles() {
  const output = execSync('git ls-files -z', { encoding: 'utf8' });
  return output
    .split('\0')
    .filter(Boolean)
    .filter((file) => file.startsWith('e2e/') && file.endsWith('.spec.ts'));
}

function usesSerialMode(contents) {
  return (
    /test\.describe\.configure\(\s*\{[^}]*mode\s*:\s*['"]serial['"][^}]*\}\s*\)/.test(contents) ||
    /test\.describe\.serial\b/.test(contents)
  );
}

const violations = [];
for (const file of listSpecFiles()) {
  if (!fs.existsSync(file)) continue;
  const contents = fs.readFileSync(file, 'utf8');
  if (usesSerialMode(contents) && !file.includes('.serial.')) {
    violations.push(
      `${file} uses serial mode but is not named *.serial.spec.ts (rename or remove serial mode).`,
    );
  }
}

if (violations.length > 0) {
  console.error('Test isolation check failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Test isolation check passed.');
