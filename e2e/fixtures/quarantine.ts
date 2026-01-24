import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type QuarantineEntry = {
  title: string;
  reason?: string;
  owner?: string;
  expires?: string;
};

type QuarantineFile = {
  tests?: QuarantineEntry[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const quarantinePath = path.resolve(__dirname, '..', 'quarantine.json');

function loadQuarantine(): QuarantineEntry[] {
  try {
    const raw = fs.readFileSync(quarantinePath, 'utf8');
    const data = JSON.parse(raw) as QuarantineFile;
    return Array.isArray(data.tests) ? data.tests : [];
  } catch {
    return [];
  }
}

const quarantined = new Map(loadQuarantine().map((entry) => [entry.title, entry]));
const shouldRunQuarantined = process.env.RUN_QUARANTINE === '1';

function isQuarantined(title: string) {
  return quarantined.has(title);
}

const test = ((title: string, fn: Parameters<typeof base>[1], ...rest: unknown[]) => {
  if (isQuarantined(title) && !shouldRunQuarantined) {
    return base.fixme(title, fn, ...rest);
  }
  return base(title, fn, ...rest);
}) as typeof base;

Object.assign(test, base);

test.only = ((title: string, fn: Parameters<typeof base.only>[1], ...rest: unknown[]) => {
  if (isQuarantined(title) && !shouldRunQuarantined) {
    return base.fixme(title, fn, ...rest);
  }
  return base.only(title, fn, ...rest);
}) as typeof base.only;

export { test, expect };
