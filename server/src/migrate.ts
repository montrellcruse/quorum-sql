import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';
import { createPool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type SqlFile = { name: string; fullPath: string; sql: string };

function readSqlFiles(dir: string): SqlFile[] {
  if (!fs.existsSync(dir)) {
    throw new Error(`Migrations directory not found: ${dir}`);
  }

  const sqlFiles = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ name: f, fullPath: path.join(dir, f), sql: fs.readFileSync(path.join(dir, f), 'utf8') }));

  if (sqlFiles.length === 0) {
    throw new Error(`No SQL migrations found in: ${dir}`);
  }

  return sqlFiles;
}

async function ensureMigrationsTable(client: PoolClient) {
  await client.query(`
    create table if not exists public.__migrations (
      id serial primary key,
      filename text not null unique,
      applied_at timestamptz not null default now()
    );
  `);
}

async function applyMigrations(pool: Pool, migrations: SqlFile[]) {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = new Set(
      (await client.query('select filename from public.__migrations order by id')).rows.map(
        (r: { filename: string }) => r.filename,
      ),
    );
    for (const m of migrations) {
      if (applied.has(m.name)) continue;
      console.log(`Applying migration: ${m.name}`);
      await client.query('begin');
      try {
        await client.query(m.sql);
        await client.query('insert into public.__migrations(filename) values($1)', [m.name]);
        await client.query('commit');
      } catch (err) {
        await client.query('rollback');
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Failed migration ${m.name}:`, message);
        throw err;
      }
    }
  } finally {
    client.release();
  }
}

async function applySeed(pool: Pool, file: string) {
  if (!file || !fs.existsSync(file)) return;
  const sql = fs.readFileSync(file, 'utf8');
  const client = await pool.connect();
  try {
    console.log(`Applying seed: ${path.basename(file)}`);
    await client.query(sql);
  } finally {
    client.release();
  }
}

/**
 * When running against plain Postgres (non-Supabase), create the auth schema
 * shim so that Supabase migrations referencing auth.users, auth.uid(), etc. work.
 */
async function ensureAuthShim(pool: Pool) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth'`,
    );
    if (rows.length > 0) return; // auth schema exists (real Supabase), skip shim

    console.log('Auth schema not found — applying compatibility shim for plain Postgres');
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS auth.users (
        id uuid PRIMARY KEY,
        email text UNIQUE NOT NULL,
        full_name text,
        encrypted_password text,
        raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
      $$;

      CREATE OR REPLACE FUNCTION auth.role() RETURNS text
      LANGUAGE sql STABLE AS $$
        SELECT COALESCE(NULLIF(current_setting('app.role', true), ''), 'authenticated');
      $$;
    `);
  } finally {
    client.release();
  }
}

async function main() {
  const seed = process.argv.includes('--seed');
  const pool = createPool();
  try {
    await ensureAuthShim(pool);
    const migrationsDir = path.join(__dirname, '../../supabase/migrations');
    console.log('Applying migrations from: supabase/migrations');
    const migrations = readSqlFiles(migrationsDir);
    await applyMigrations(pool, migrations);
    if (seed) {
      const seedPath = path.join(__dirname, '../seed.sql');
      await applySeed(pool, seedPath);
    }
    console.log('Migrations complete');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
