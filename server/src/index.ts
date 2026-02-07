// Initialize observability first (before other imports)
import { initTracing } from './observability/tracing.js';
import { initSentry, setupSentryFastify } from './observability/sentry.js';
initTracing();
initSentry();

import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

import { createPool } from './db.js';
import { createWithClient, createWithReadClient } from './lib/db-helpers.js';
import { isProd, serverConfig, securityConfig, observabilityConfig } from './config.js';
import { securityHeaders, errorHandler, requestLogger, csrfProtection } from './middleware/security.js';
import { runWithRequestContext, getQueryCount } from './observability/requestContext.js';
import { setupMetrics } from './observability/metrics.js';
import healthRoutes from './routes/health.js';
import setupRoutes from './routes/setup.js';
import authRoutes from './routes/auth.js';
import teamRoutes from './routes/teams.js';
import memberRoutes from './routes/members.js';
import invitationRoutes from './routes/invitations.js';
import folderRoutes from './routes/folders.js';
import queryRoutes from './routes/queries.js';
import approvalRoutes from './routes/approvals.js';

// Initialize Fastify with body size limit
const fastify = Fastify({
  logger: {
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers.set-cookie',
        'req.headers["set-cookie"]',
        'req.body.password',
        'req.body.token',
        'req.body.refresh_token',
        'req.body.access_token',
      ],
      censor: '[REDACTED]',
    },
  },
  bodyLimit: 1048576, // 1MB default
});

// Register plugins
await fastify.register(cookie);

// Security headers and request logging
securityHeaders(fastify);
requestLogger(fastify);
errorHandler(fastify);
setupMetrics(fastify);
setupSentryFastify(fastify);

fastify.addHook('onRequest', (req, reply, done) => {
  runWithRequestContext(req, done);
});

// CORS configuration
await fastify.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (!isProd && securityConfig.corsOrigins.length === 0) return cb(null, true);
    if (securityConfig.corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS not allowed'), false);
  },
  credentials: true,
});

// Rate limiting
await fastify.register(rateLimit, {
  max: securityConfig.rateLimitMax,
  timeWindow: securityConfig.rateLimitWindow,
});

// CSRF protection
csrfProtection(fastify);

fastify.addHook('onResponse', (req, reply, done) => {
  const queryCount = getQueryCount();
  if (queryCount > observabilityConfig.queryCountWarnThreshold) {
    req.log.warn(
      { queryCount, threshold: observabilityConfig.queryCountWarnThreshold, path: req.url },
      'High query count detected (possible N+1)',
    );
  }
  done();
});

const pool = createPool();
const withClient = createWithClient(pool);
const withReadClient = createWithReadClient(pool);

fastify.decorate('pool', pool);
fastify.decorate('withClient', withClient);
fastify.decorate('withReadClient', withReadClient);

await fastify.register(healthRoutes);
await fastify.register(setupRoutes);
await fastify.register(authRoutes);
await fastify.register(teamRoutes);
await fastify.register(memberRoutes);
await fastify.register(invitationRoutes);
await fastify.register(folderRoutes);
await fastify.register(queryRoutes);
await fastify.register(approvalRoutes);

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function gracefulShutdown(signal: string) {
  fastify.log.info({ signal }, 'Received shutdown signal');

  try {
    await fastify.close();
    fastify.log.info('HTTP server closed');

    await pool.end();
    fastify.log.info('Database pool closed');

    process.exit(0);
  } catch (err) {
    fastify.log.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// START SERVER
// ============================================

const port = serverConfig.port;
fastify.listen({ port, host: '0.0.0.0' }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
