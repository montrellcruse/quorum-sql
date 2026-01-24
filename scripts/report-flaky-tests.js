#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const inputPath = process.env.PLAYWRIGHT_JSON_PATH || 'test-results/playwright.json';
if (!fs.existsSync(inputPath)) {
  console.log(`No Playwright JSON found at ${inputPath}. Skipping flaky test report.`);
  process.exit(0);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
} catch (err) {
  console.error('Failed to parse Playwright JSON:', err.message);
  process.exit(2);
}

const flakyTests = [];

function walkSuite(suite, parentTitles = []) {
  const suiteTitle = suite.title ? [suite.title] : [];
  const titles = [...parentTitles, ...suiteTitle].filter(Boolean);

  for (const spec of suite.specs || []) {
    const specTitle = spec.title ? [spec.title] : [];
    const fullTitle = [...titles, ...specTitle].filter(Boolean).join(' › ');
    for (const test of spec.tests || []) {
      const results = test.results || [];
      const statuses = results.map((r) => r.status).filter(Boolean);
      const filtered = statuses.filter((status) => status !== 'skipped');
      if (filtered.length === 0) continue;
      const unique = new Set(filtered);
      if (unique.size > 1) {
        const project = test.projectName ? ` [${test.projectName}]` : '';
        flakyTests.push({
          title: `${fullTitle}${project}`,
          statuses: Array.from(unique),
          attempts: filtered.length,
        });
      }
    }
  }

  for (const child of suite.suites || []) {
    walkSuite(child, titles);
  }
}

for (const suite of data.suites || []) {
  walkSuite(suite, []);
}

const reportDir = path.resolve('reports');
fs.mkdirSync(reportDir, { recursive: true });

const jsonPath = path.join(reportDir, 'flaky-tests.json');
fs.writeFileSync(jsonPath, JSON.stringify({ flakyTests }, null, 2));

const mdLines = ['# Flaky Test Report', '', `Total flaky tests: ${flakyTests.length}`, ''];
for (const test of flakyTests) {
  mdLines.push(`- ${test.title} (${test.statuses.join(', ')}, attempts: ${test.attempts})`);
}
const mdPath = path.join(reportDir, 'flaky-tests.md');
fs.writeFileSync(mdPath, mdLines.join('\n'));

console.log(`Flaky test report written to ${jsonPath} and ${mdPath}.`);

if (process.env.FAIL_ON_FLAKY === '1' && flakyTests.length > 0) {
  process.exit(1);
}
