import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Config Module', () => {
  const originalEnv = process.env;
  const originalExit = process.exit;

  beforeEach(() => {
    vi.resetModules();
    // Create a fresh copy of process.env for each test
    process.env = { ...originalEnv };
    // Mock process.exit to prevent test termination
    process.exit = vi.fn() as never;
  });

  afterEach(() => {
    process.env = originalEnv;
    process.exit = originalExit;
    vi.clearAllMocks();
  });

  describe('Environment Validation', () => {
    it('validates with minimal required environment', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';

      const config = await import('./config.js');

      expect(config.serverConfig).toBeDefined();
      expect(config.dbConfig).toBeDefined();
      expect(config.securityConfig).toBeDefined();
    });

    it('uses default port 8787', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';

      const config = await import('./config.js');

      expect(config.serverConfig.port).toBe(8787);
    });

    it('uses custom port when specified', async () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';

      const config = await import('./config.js');

      expect(config.serverConfig.port).toBe(3000);
    });

    it('parses CORS_ORIGIN as comma-separated list', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';
      process.env.CORS_ORIGIN = 'http://localhost:3000, https://example.com';

      const config = await import('./config.js');

      expect(config.securityConfig.corsOrigins).toEqual([
        'http://localhost:3000',
        'https://example.com',
      ]);
    });

    it('handles empty CORS_ORIGIN', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';
      process.env.CORS_ORIGIN = '';

      const config = await import('./config.js');

      expect(config.securityConfig.corsOrigins).toEqual([]);
    });

    it('parses rate limit configuration', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';
      process.env.RATE_LIMIT_MAX = '50';
      process.env.RATE_LIMIT_WINDOW = '5 minutes';

      const config = await import('./config.js');

      expect(config.securityConfig.rateLimitMax).toBe(50);
      expect(config.securityConfig.rateLimitWindow).toBe('5 minutes');
    });

    it('parses database pool configuration', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';
      process.env.PGPOOL_MAX = '20';
      process.env.PGPOOL_IDLE_TIMEOUT_MS = '60000';
      process.env.PGPOOL_CONN_TIMEOUT_MS = '5000';

      const config = await import('./config.js');

      expect(config.dbConfig.poolMax).toBe(20);
      expect(config.dbConfig.poolIdleTimeoutMs).toBe(60000);
      expect(config.dbConfig.poolConnTimeoutMs).toBe(5000);
    });

    it('parses observability configuration', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';
      process.env.ENABLE_METRICS = 'true';
      process.env.METRICS_AUTH_TOKEN = 'secret-token';
      process.env.QUERY_COUNT_WARN_THRESHOLD = '100';

      const config = await import('./config.js');

      expect(config.observabilityConfig.metricsEnabled).toBe(true);
      expect(config.observabilityConfig.metricsAuthToken).toBe('secret-token');
      expect(config.observabilityConfig.queryCountWarnThreshold).toBe(100);
    });

    it('parses Supabase configuration', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';
      process.env.SUPABASE_URL = 'https://myproject.supabase.co';

      const config = await import('./config.js');

      expect(config.supabaseConfig.url).toBe('https://myproject.supabase.co');
      expect(config.supabaseConfig.jwksUrl).toBe(
        'https://myproject.supabase.co/auth/v1/keys'
      );
    });

    it('uses custom JWKS URL when provided', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';
      process.env.SUPABASE_URL = 'https://myproject.supabase.co';
      process.env.SUPABASE_JWKS_URL = 'https://custom-jwks.example.com/keys';

      const config = await import('./config.js');

      expect(config.supabaseConfig.jwksUrl).toBe('https://custom-jwks.example.com/keys');
    });

    it('handles trailing slash in Supabase URL', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';
      process.env.SUPABASE_URL = 'https://myproject.supabase.co/';

      const config = await import('./config.js');

      // Should not have double slashes
      expect(config.supabaseConfig.jwksUrl).toBe(
        'https://myproject.supabase.co/auth/v1/keys'
      );
    });
  });

  describe('Environment Flags', () => {
    it('sets isProd true in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';

      const config = await import('./config.js');

      expect(config.isProd).toBe(true);
      expect(config.isDev).toBe(false);
      expect(config.isTest).toBe(false);
    });

    it('sets isDev true in development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';

      const config = await import('./config.js');

      expect(config.isProd).toBe(false);
      expect(config.isDev).toBe(true);
      expect(config.isTest).toBe(false);
    });

    it('sets isTest true in test', async () => {
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';

      const config = await import('./config.js');

      expect(config.isProd).toBe(false);
      expect(config.isDev).toBe(false);
      expect(config.isTest).toBe(true);
    });
  });

  describe('Dev Auth Configuration', () => {
    it('enables dev auth only in development when explicitly enabled', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';
      process.env.ENABLE_DEV_AUTH = 'true';

      const config = await import('./config.js');

      expect(config.securityConfig.devAuthEnabled).toBe(true);
    });

    it('disables dev auth in production even when explicitly enabled', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';
      process.env.ENABLE_DEV_AUTH = 'true';

      const config = await import('./config.js');

      expect(config.securityConfig.devAuthEnabled).toBe(false);
    });

    it('parses DEV_FAKE_USER_ID as UUID', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';
      process.env.DEV_FAKE_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

      const config = await import('./config.js');

      expect(config.securityConfig.devFakeUserId).toBe(
        '550e8400-e29b-41d4-a716-446655440000'
      );
    });
  });

  describe('OpenTelemetry Configuration', () => {
    it('parses OpenTelemetry configuration', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
      process.env.OTEL_SERVICE_NAME = 'my-service';

      const config = await import('./config.js');

      expect(config.observabilityConfig.otelEndpoint).toBe('http://localhost:4318');
      expect(config.observabilityConfig.otelServiceName).toBe('my-service');
    });

    it('uses default service name when not provided', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';

      const config = await import('./config.js');

      expect(config.observabilityConfig.otelServiceName).toBe('quorum-sql-server');
    });
  });

  describe('Sentry Configuration', () => {
    it('parses Sentry DSN', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';
      process.env.SENTRY_DSN = 'https://abc123@o123.ingest.sentry.io/456';

      const config = await import('./config.js');

      expect(config.observabilityConfig.sentryDsn).toBe(
        'https://abc123@o123.ingest.sentry.io/456'
      );
    });
  });

  describe('Feature Flags', () => {
    it('parses feature flags string', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';
      process.env.FEATURE_FLAGS = 'feature1,feature2:50,feature3';

      const config = await import('./config.js');

      expect(config.observabilityConfig.featureFlags).toBe('feature1,feature2:50,feature3');
    });
  });

  describe('Database Configuration', () => {
    it('supports PG* environment variables', async () => {
      process.env.NODE_ENV = 'development';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';
      process.env.PGHOST = 'db.example.com';
      process.env.PGPORT = '5433';
      process.env.PGDATABASE = 'mydb';
      process.env.PGUSER = 'admin';
      process.env.PGPASSWORD = 'secret';

      const config = await import('./config.js');

      expect(config.dbConfig.host).toBe('db.example.com');
      expect(config.dbConfig.port).toBe('5433');
      expect(config.dbConfig.database).toBe('mydb');
      expect(config.dbConfig.user).toBe('admin');
      expect(config.dbConfig.password).toBe('secret');
    });

    it('prefers DATABASE_URL over PG* variables', async () => {
      process.env.NODE_ENV = 'development';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/primary';
      process.env.PGHOST = 'db.example.com';
      process.env.PGDATABASE = 'secondary';

      const config = await import('./config.js');

      expect(config.dbConfig.connectionString).toBe(
        'postgresql://user:pass@localhost:5432/primary'
      );
    });
  });

  describe('Validation Errors', () => {
    it('generates random SESSION_SECRET in development if not set', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      delete process.env.SESSION_SECRET;

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const config = await import('./config.js');

      expect(config.securityConfig.sessionSecret).toBeDefined();
      expect(config.securityConfig.sessionSecret.length).toBeGreaterThanOrEqual(32);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SESSION_SECRET not set')
      );

      consoleSpy.mockRestore();
    });

    it('exits in production without SESSION_SECRET', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      delete process.env.SESSION_SECRET;

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await import('./config.js').catch(() => {});

      expect(process.exit).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
    });

    it('exits without database configuration', async () => {
      process.env.NODE_ENV = 'development';
      process.env.SESSION_SECRET = 'a-very-long-session-secret-at-least-32-chars';
      delete process.env.DATABASE_URL;
      delete process.env.PGHOST;
      delete process.env.PGDATABASE;
      delete process.env.PGUSER;

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await import('./config.js').catch(() => {});

      expect(process.exit).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
    });
  });
});
