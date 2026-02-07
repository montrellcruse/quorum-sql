import type { Pool, PoolClient } from 'pg';

export type WithClient = <T>(
  userId: string | null,
  fn: (client: PoolClient) => Promise<T>,
) => Promise<T>;

// Wrap each request in a transaction and set RLS context when a user is present.
export function createWithClient(pool: Pool): WithClient {
  return async <T>(userId: string | null, fn: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (userId) {
        await client.query("select set_config('app.user_id', $1, true)", [userId]);
        await client.query("select set_config('app.role', 'authenticated', true)");
      }
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
