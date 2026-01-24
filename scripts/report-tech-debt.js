#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const patterns = [/TODO\b/i, /FIXME\b/i, /XXX\b/i];
const includeExtensions = new Set([
  '.js', '.mjs', '.cjs',
  '.ts', '.tsx',
  '.md', '.json', '.yml', '.yaml',
  '.sql', '.sh',
]);

function listTrackedFiles() {
  const output = execSync('git ls-files -z', { encoding: 'utf8' });
  return output.split('\0').filter(Boolean);
}

function shouldScan(filePath) {
  const ext = path.extname(filePath);
  if (!includeExtensions.has(ext)) return false;
  return true;
}

function findMatches(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n');
  const matches = [];
  lines.forEach((line, index) => {
    if (patterns.some((pattern) => pattern.test(line))) {
      matches.push({ line: index + 1, text: line.trim() });
    }
  });
  return matches;
}

let files = [];
try {
  files = listTrackedFiles();
} catch (err) {
  console.error('Failed to list git tracked files:', err.message);
  process.exit(2);
}

const findings = [];
for (const file of files) {
  if (!shouldScan(file)) continue;
  const matches = findMatches(file);
  if (matches.length > 0) {
    findings.push({ file, matches });
  }
}

if (findings.length === 0) {
  console.log('No TODO/FIXME/XXX markers found.');
  process.exit(0);
}

let total = 0;
for (const item of findings) {
  for (const match of item.matches) {
    total += 1;
    console.log(`${item.file}:${match.line} ${match.text}`);
  }
}
console.log(`\nTotal markers: ${total}`);
process.exit(0);
