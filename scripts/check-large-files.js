#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const maxBytes = Number(process.env.MAX_LARGE_FILE_BYTES || 5 * 1024 * 1024);
const cwd = process.cwd();

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

let files = [];
try {
  const output = execSync('git ls-files -z', { encoding: 'utf8' });
  files = output.split('\0').filter(Boolean);
} catch (err) {
  console.error('Failed to list git tracked files:', err.message);
  process.exit(2);
}

const largeFiles = [];
for (const file of files) {
  const fullPath = path.join(cwd, file);
  let stat;
  try {
    stat = fs.statSync(fullPath);
  } catch {
    continue;
  }
  if (!stat.isFile()) continue;
  if (stat.size > maxBytes) {
    largeFiles.push({ file, size: stat.size });
  }
}

if (largeFiles.length === 0) {
  console.log(`No tracked files exceed ${formatBytes(maxBytes)}.`);
  process.exit(0);
}

console.error(`Tracked files exceeding ${formatBytes(maxBytes)}:`);
for (const entry of largeFiles.sort((a, b) => b.size - a.size)) {
  console.error(`- ${entry.file} (${formatBytes(entry.size)})`);
}
process.exit(1);
