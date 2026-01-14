import pkg from 'pg';
import { dbConfig } from './config.js';
const { Pool } = pkg;

export function createPool() {
  let connectionString = dbConfig.connectionString;
  if (!connectionString) {
    const host = dbConfig.host;
    const port = dbConfig.port || '5432';
    const db = dbConfig.database;
    const user = dbConfig.user;
    const pass = dbConfig.password;
    if (host && db && user) {
      connectionString = pass
        ? `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${db}`
        : `postgresql://${encodeURIComponent(user)}@${host}:${port}/${db}`;
    }
  }
  if (!connectionString) throw new Error('DATABASE_URL or PG* env vars are not set');
  return new Pool({
    connectionString,
    max: dbConfig.poolMax,
    idleTimeoutMillis: dbConfig.poolIdleTimeoutMs,
    connectionTimeoutMillis: dbConfig.poolConnTimeoutMs,
  });
}
