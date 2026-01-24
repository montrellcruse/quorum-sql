#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const results = [];

function addResult(name, durationMs, source) {
  if (!Number.isFinite(durationMs)) return;
  results.push({ name, durationMs, source });
}

function walkSuite(suite, parentTitles = []) {
  const suiteTitle = suite.title ? [suite.title] : [];
  const titles = [...parentTitles, ...suiteTitle].filter(Boolean);

  for (const spec of suite.specs || []) {
    const specTitle = spec.title ? [spec.title] : [];
    const fullTitle = [...titles, ...specTitle].filter(Boolean).join(' › ');
    for (const test of spec.tests || []) {
      const durations = (test.results || [])
        .map((r) => r.duration)
        .filter((d) => Number.isFinite(d));
      if (durations.length === 0) continue;
      const maxDuration = Math.max(...durations);
      const project = test.projectName ? ` [${test.projectName}]` : '';
      addResult(`${fullTitle}${project}`, maxDuration, 'playwright');
    }
  }

  for (const child of suite.suites || []) {
    walkSuite(child, titles);
  }
}

function parsePlaywright() {
  const inputPath = process.env.PLAYWRIGHT_JSON_PATH || 'test-results/playwright.json';
  if (!fs.existsSync(inputPath)) return;
  try {
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    for (const suite of data.suites || []) {
      walkSuite(suite, []);
    }
  } catch (err) {
    console.error('Failed to parse Playwright JSON:', err.message);
  }
}

function parseVitest() {
  const inputPath = process.env.VITEST_JUNIT_PATH || 'test-results/vitest.xml';
  if (!fs.existsSync(inputPath)) return;
  const xml = fs.readFileSync(inputPath, 'utf8');
  const testcaseRegex = /<testcase\b([^>]+)>/g;
  let match;
  while ((match = testcaseRegex.exec(xml))) {
    const attrs = match[1];
    const attrRegex = /(\w+)="([^"]*)"/g;
    let name = '';
    let classname = '';
    let time = '';
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrs))) {
      const key = attrMatch[1];
      const value = attrMatch[2];
      if (key === 'name') name = value;
      if (key === 'classname') classname = value;
      if (key === 'time') time = value;
    }
    if (!time) continue;
    const durationMs = Number.parseFloat(time) * 1000;
    const label = classname ? `${classname} › ${name}` : name;
    addResult(label, durationMs, 'vitest');
  }
}

parsePlaywright();
parseVitest();

if (results.length === 0) {
  console.log('No test timing data found (Playwright/Vitest outputs missing).');
  process.exit(0);
}

const limit = Number.parseInt(process.env.SLOW_TEST_LIMIT || '10', 10);
results.sort((a, b) => b.durationMs - a.durationMs);
const top = results.slice(0, Number.isFinite(limit) ? limit : 10);

const reportDir = path.resolve('reports');
fs.mkdirSync(reportDir, { recursive: true });

const jsonPath = path.join(reportDir, 'slow-tests.json');
fs.writeFileSync(jsonPath, JSON.stringify({ results: top }, null, 2));

const mdLines = ['# Slow Test Report', '', `Total samples: ${results.length}`, ''];
for (const item of top) {
  mdLines.push(`- ${item.name} (${item.source}: ${Math.round(item.durationMs)} ms)`);
}
const mdPath = path.join(reportDir, 'slow-tests.md');
fs.writeFileSync(mdPath, mdLines.join('\n'));

console.log(`Test timing report written to ${jsonPath} and ${mdPath}.`);
