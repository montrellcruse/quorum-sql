import type { Pool, PoolClient } from 'pg';

type WithDbClient = <T>(
  userId: string | null,
  fn: (client: PoolClient) => Promise<T>,
) => Promise<T>;

export type WithClient = WithDbClient;
export type WithReadClient = WithDbClient;

async function setRequestContext(client: PoolClient, userId: string | null): Promise<void> {
  if (!userId) return;
  await client.query("select set_config('app.user_id', $1, true)", [userId]);
  await client.query("select set_config('app.role', 'authenticated', true)");
}

// Wrap each request in a transaction and set RLS context when a user is present.
export function createWithClient(pool: Pool): WithClient {
  return async <T>(userId: string | null, fn: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await setRequestContext(client, userId);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignore rollback failures, surface original error.
      }
      throw error;
    } finally {
      client.release();
    }
  };
}

// Use a plain pooled client for read-only queries while preserving RLS context.
// Still uses set_config with `true` (transaction-local), so we wrap in a
// lightweight read-only transaction to scope the config properly.
export function createWithReadClient(pool: Pool): WithReadClient {
  return async <T>(userId: string | null, fn: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      await setRequestContext(client, userId);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignore rollback failures, surface original error.
      }
      throw error;
    } finally {
      client.release();
    }
  };
}
