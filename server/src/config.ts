import { z } from 'zod';
import { randomBytes } from 'node:crypto';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('8787').transform(Number),
  
  // Database - at least one connection method required
  DATABASE_URL: z.string().optional(),
  PGHOST: z.string().optional(),
  PGPORT: z.string().default('5432'),
  PGDATABASE: z.string().optional(),
  PGUSER: z.string().optional(),
  PGPASSWORD: z.string().optional(),
  PGPOOL_MAX: z.string().default('10').transform(Number),
  PGPOOL_IDLE_TIMEOUT_MS: z.string().default('30000').transform(Number),
  PGPOOL_CONN_TIMEOUT_MS: z.string().default('2000').transform(Number),
  
  // Security - required in production
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  
  // CORS
  CORS_ORIGIN: z.string().default(''),
  
  // Rate limiting
  RATE_LIMIT_MAX: z.string().default('100').transform(Number),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),

  // Feature flags
  FEATURE_FLAGS: z.string().default(''),

  // Supabase JWT (optional)
  SUPABASE_URL: z.string().optional(),
  SUPABASE_JWKS_URL: z.string().optional(),

  // Observability
  ENABLE_METRICS: z.string().default('false').transform(v => v === 'true'),
  METRICS_AUTH_TOKEN: z.string().optional(),
  QUERY_COUNT_WARN_THRESHOLD: z.string().default('50').transform(Number),

  // OpenTelemetry
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default('quorum-sql-server'),

  // Sentry
  SENTRY_DSN: z.string().optional(),

  // Dev-only settings
  ENABLE_DEV_AUTH: z.string().default('false').transform(v => v === 'true'),
  DEV_FAKE_USER_ID: z.string().uuid().optional(),
});

type EnvConfig = z.infer<typeof envSchema>;

function validateEnv(): EnvConfig {
  const isProd = process.env.NODE_ENV === 'production';
  
  // In production, SESSION_SECRET is absolutely required
  if (isProd && !process.env.SESSION_SECRET) {
    console.error('FATAL: SESSION_SECRET is required in production');
    process.exit(1);
  }
  
  // Provide a generated secret for development if not set
  if (!isProd && !process.env.SESSION_SECRET) {
    console.warn('WARNING: SESSION_SECRET not set, using random secret (sessions will not persist across restarts)');
    process.env.SESSION_SECRET = randomBytes(32).toString('hex');
  }
  
  // Validate database connection
  const hasDbUrl = !!process.env.DATABASE_URL;
  const hasPgVars = process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER;
  
  if (!hasDbUrl && !hasPgVars) {
    console.error('FATAL: Database connection not configured. Set DATABASE_URL or PGHOST/PGDATABASE/PGUSER');
    process.exit(1);
  }
  
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('FATAL: Environment validation failed:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  
  return result.data;
}

const config = validateEnv();

export const isProd = config.NODE_ENV === 'production';
export const isDev = config.NODE_ENV === 'development';
export const isTest = config.NODE_ENV === 'test';

export const serverConfig = {
  port: config.PORT,
  nodeEnv: config.NODE_ENV,
};

export const securityConfig = {
  sessionSecret: config.SESSION_SECRET,
  corsOrigins: config.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean),
  rateLimitMax: config.RATE_LIMIT_MAX,
  rateLimitWindow: config.RATE_LIMIT_WINDOW,
  devAuthEnabled: config.ENABLE_DEV_AUTH && isDev,
  devFakeUserId: config.DEV_FAKE_USER_ID,
};

export const dbConfig = {
  connectionString: config.DATABASE_URL,
  host: config.PGHOST,
  port: config.PGPORT,
  database: config.PGDATABASE,
  user: config.PGUSER,
  password: config.PGPASSWORD,
  poolMax: config.PGPOOL_MAX,
  poolIdleTimeoutMs: config.PGPOOL_IDLE_TIMEOUT_MS,
  poolConnTimeoutMs: config.PGPOOL_CONN_TIMEOUT_MS,
};

export const supabaseConfig = {
  url: config.SUPABASE_URL,
  jwksUrl: config.SUPABASE_JWKS_URL || (config.SUPABASE_URL ? `${config.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/keys` : null),
};

export const observabilityConfig = {
  featureFlags: config.FEATURE_FLAGS,
  metricsEnabled: config.ENABLE_METRICS,
  metricsAuthToken: config.METRICS_AUTH_TOKEN,
  queryCountWarnThreshold: config.QUERY_COUNT_WARN_THRESHOLD,
  otelEndpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
  otelServiceName: config.OTEL_SERVICE_NAME,
  sentryDsn: config.SENTRY_DSN,
};

export default config;
