#!/usr/bin/env node
/**
 * Generates a single SQL file from all Supabase migrations
 * for easy execution in Supabase Studio SQL Editor
 *
 * Usage: npm run migrations:combine
 * Output: supabase/combined-migrations.sql
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const migrationsDir = path.join(projectRoot, 'supabase/migrations');
const outputFile = path.join(projectRoot, 'supabase/combined-migrations.sql');

// Check if migrations directory exists
if (!fs.existsSync(migrationsDir)) {
  console.error(`Error: Migrations directory not found: ${migrationsDir}`);
  process.exit(1);
}

// Read all migration files in order
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error('Error: No migration files found');
  process.exit(1);
}

console.log(`Found ${files.length} migration files`);

let combined = `-- Combined Supabase Migrations
-- Generated: ${new Date().toISOString()}
-- Total files: ${files.length}
--
-- Instructions:
-- 1. Open your Supabase project dashboard
-- 2. Go to SQL Editor (left sidebar)
-- 3. Click "New query"
-- 4. Paste this entire file
-- 5. Click "Run" to execute all migrations
--
-- Note: This script is idempotent - safe to run multiple times
-- ============================================================

`;

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  combined += `\n-- ============================================\n`;
  combined += `-- Migration: ${file}\n`;
  combined += `-- ============================================\n\n`;
  combined += content.trim();
  combined += '\n';
}

// Add completion message
combined += `
-- ============================================
-- All migrations complete!
-- ============================================
`;

fs.writeFileSync(outputFile, combined);

console.log(`\nGenerated: supabase/combined-migrations.sql`);
console.log(`Combined ${files.length} migration files`);
console.log(`\nNext steps:`);
console.log(`  1. Open Supabase SQL Editor`);
console.log(`  2. Paste contents of supabase/combined-migrations.sql`);
console.log(`  3. Click "Run"`);
