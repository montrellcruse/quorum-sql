#!/usr/bin/env node

/**
 * Validates AGENTS.md file structure and content.
 * Ensures required sections exist and commands are documented.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED_SECTIONS = [
  'Quick Start',
  'Repo Layout',
  'Common Commands',
];

const REQUIRED_COMMANDS = [
  'npm run dev',
  'npm run build',
  'npm run lint',
  'npm run test',
];

function validateAgentsMd() {
  const agentsPath = join(process.cwd(), 'AGENTS.md');

  if (!existsSync(agentsPath)) {
    console.error('❌ AGENTS.md not found at repository root');
    process.exit(1);
  }

  const content = readFileSync(agentsPath, 'utf-8');
  const errors = [];

  // Check required sections
  for (const section of REQUIRED_SECTIONS) {
    if (!content.includes(`## ${section}`) && !content.includes(`# ${section}`)) {
      errors.push(`Missing required section: "${section}"`);
    }
  }

  // Check for command documentation
  for (const cmd of REQUIRED_COMMANDS) {
    if (!content.includes(cmd)) {
      errors.push(`Missing documentation for command: "${cmd}"`);
    }
  }

  // Check minimum length (should be substantive)
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 20) {
    errors.push(`AGENTS.md is too short (${lines.length} lines). Should be at least 20 lines.`);
  }

  if (errors.length > 0) {
    console.error('❌ AGENTS.md validation failed:');
    errors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }

  console.log('✅ AGENTS.md validation passed');
  console.log(`   - ${REQUIRED_SECTIONS.length} required sections found`);
  console.log(`   - ${REQUIRED_COMMANDS.length} required commands documented`);
  console.log(`   - ${lines.length} lines of content`);
}

validateAgentsMd();
