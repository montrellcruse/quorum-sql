import fs from 'fs';
import path from 'path';
import url from 'url';
import { createPool } from './db.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

function readSqlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ name: f, fullPath: path.join(dir, f), sql: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists public.__migrations (
      id serial primary key,
      filename text not null unique,
      applied_at timestamptz not null default now()
    );
  `);
}

async function applyMigrations(pool, migrations) {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = new Set(
      (await client.query('select filename from public.__migrations order by id')).rows.map((r) => r.filename)
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
        console.error(`Failed migration ${m.name}:`, err.message);
        throw err;
      }
    }
  } finally {
    client.release();
  }
}

async function applySeed(pool, file) {
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

async function main() {
  const seed = process.argv.includes('--seed');
  const pool = createPool();
  try {
    const compatDir = path.join(__dirname, '../migrations');
    const supaDir = path.join(__dirname, '../../supabase/migrations');
    const applySupabase = (process.env.APPLY_SUPABASE_MIGRATIONS || 'true').toLowerCase() !== 'false';
    const compatMigrations = readSqlFiles(compatDir);
    const supabaseMigrations = applySupabase ? readSqlFiles(supaDir) : [];
    console.log(
      `Applying migrations from: server/migrations${applySupabase ? ' + supabase/migrations' : ' (supabase skipped)'} `,
    );
    const migrations = [...compatMigrations, ...supabaseMigrations];
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
