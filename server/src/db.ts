import pkg from 'pg';
import type { Pool as PgPool, PoolClient } from 'pg';
import { dbConfig } from './config.js';
import { incrementQueryCount } from './observability/requestContext.js';
const { Pool } = pkg as typeof import('pg');

const instrumentedClients = new WeakSet<PoolClient>();

function instrumentClient(client: PoolClient): PoolClient {
  if (instrumentedClients.has(client)) return client;
  const originalQuery = client.query.bind(client);
  client.query = ((...args: Parameters<PoolClient['query']>) => {
    incrementQueryCount();
    return originalQuery(...args);
  }) as PoolClient['query'];
  instrumentedClients.add(client);
  return client;
}

export function createPool(): PgPool {
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
  const pool = new Pool({
    connectionString,
    max: dbConfig.poolMax,
    idleTimeoutMillis: dbConfig.poolIdleTimeoutMs,
    connectionTimeoutMillis: dbConfig.poolConnTimeoutMs,
  });
  const originalConnect = pool.connect.bind(pool);
  pool.connect = async () => {
    const client = await originalConnect();
    return instrumentClient(client);
  };
  return pool;
}
