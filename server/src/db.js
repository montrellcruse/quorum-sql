import pkg from 'pg';
const { Pool } = pkg;

export function createPool() {
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    const host = process.env.PGHOST;
    const port = process.env.PGPORT || '5432';
    const db = process.env.PGDATABASE;
    const user = process.env.PGUSER;
    const pass = process.env.PGPASSWORD;
    if (host && db && user) {
      connectionString = pass
        ? `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${db}`
        : `postgresql://${encodeURIComponent(user)}@${host}:${port}/${db}`;
    }
  }
  if (!connectionString) throw new Error('DATABASE_URL or PG* env vars are not set');
  return new Pool({ connectionString });
}
