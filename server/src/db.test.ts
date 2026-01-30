import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock pg module
const mockClient = {
  query: vi.fn().mockResolvedValue({ rows: [] }),
  release: vi.fn(),
};

const mockPoolInstance = {
  connect: vi.fn().mockResolvedValue(mockClient),
  end: vi.fn(),
};

vi.mock('pg', () => {
  return {
    default: {
      Pool: class MockPool {
        connect = mockPoolInstance.connect;
        end = mockPoolInstance.end;
        constructor(public config: unknown) {}
      },
    },
  };
});

// Mock config
vi.mock('./config.js', () => ({
  dbConfig: {
    connectionString: 'postgresql://user:pass@localhost:5432/testdb',
    host: 'localhost',
    port: '5432',
    database: 'testdb',
    user: 'user',
    password: 'pass',
    poolMax: 10,
    poolIdleTimeoutMs: 30000,
    poolConnTimeoutMs: 2000,
  },
}));

// Mock observability
vi.mock('./observability/requestContext.js', () => ({
  incrementQueryCount: vi.fn(),
}));

describe('Database Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createPool', () => {
    it('creates a pool and returns it', async () => {
      const { createPool } = await import('./db.js');

      const pool = createPool();

      expect(pool).toBeDefined();
      expect(pool.connect).toBeDefined();
    });

    it('instruments clients to track query counts', async () => {
      const { incrementQueryCount } = await import('./observability/requestContext.js');
      const { createPool } = await import('./db.js');

      const pool = createPool();
      const client = await pool.connect();

      // Execute a query
      await client.query('SELECT 1');

      // Should have incremented the query count
      expect(incrementQueryCount).toHaveBeenCalled();
    });
  });

  describe('createPool error handling', () => {
    it('throws when no connection info is available', async () => {
      vi.resetModules();

      vi.doMock('./config.js', () => ({
        dbConfig: {
          connectionString: null,
          host: null,
          port: '5432',
          database: null,
          user: null,
          password: null,
          poolMax: 10,
          poolIdleTimeoutMs: 30000,
          poolConnTimeoutMs: 2000,
        },
      }));

      const { createPool } = await import('./db.js');

      expect(() => createPool()).toThrow('DATABASE_URL or PG* env vars are not set');
    });
  });
});
