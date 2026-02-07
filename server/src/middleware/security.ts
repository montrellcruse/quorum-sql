import { isProd } from '../config.js';
import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

const PROD_CSP = [
  "default-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const DEV_CSP = [
  "default-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-eval' http://localhost:* http://127.0.0.1:* https://localhost:* https://127.0.0.1:*",
  "style-src 'self' 'unsafe-inline' http://localhost:* http://127.0.0.1:* https://localhost:* https://127.0.0.1:*",
  "connect-src 'self' http://localhost:* http://127.0.0.1:* https://localhost:* https://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*",
  "img-src 'self' data: blob: http://localhost:* http://127.0.0.1:* https://localhost:* https://127.0.0.1:*",
  "font-src 'self' data: http://localhost:* http://127.0.0.1:* https://localhost:* https://127.0.0.1:*",
].join('; ');

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * CSRF protection middleware using double-submit cookie pattern.
 * Validates that X-CSRF-Token header matches the csrf cookie.
 * Only applies to state-changing methods (POST, PUT, PATCH, DELETE).
 */
export function csrfProtection(fastify: FastifyInstance) {
  fastify.addHook('preHandler', (req, reply, done) => {
    // Skip CSRF check for safe methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
      return done();
    }

    // Skip CSRF check for login (no token yet) and health endpoints
    const skipPaths = ['/auth/login', '/health', '/health/live', '/health/ready', '/health/db', '/setup/'];
    if (skipPaths.some(path => req.url.startsWith(path))) {
      return done();
    }

    const csrfCookie = req.cookies?.csrf;
    const csrfHeader = req.headers['x-csrf-token'];
    const sessionCookie = req.cookies?.session;

    // Only skip CSRF validation when there's no session at all (user not logged in)
    if (!csrfCookie) {
      if (sessionCookie) {
        // Session exists but CSRF cookie is missing — reject to prevent bypass
        req.log.warn({
          path: req.url,
          method: req.method,
        }, 'CSRF bypass attempt: session cookie present but CSRF cookie missing');
        return reply.code(403).send({ error: 'CSRF token required' });
      }
      return done();
    }

    // Validate CSRF token
    if (!csrfHeader || csrfHeader !== csrfCookie) {
      req.log.warn({
        path: req.url,
        method: req.method,
        hasCookie: !!csrfCookie,
        hasHeader: !!csrfHeader
      }, 'CSRF validation failed');
      return reply.code(403).send({ error: 'CSRF token validation failed' });
    }

    done();
  });
}

export function securityHeaders(fastify: FastifyInstance) {
  fastify.addHook('onRequest', (req, reply, done) => {
    // Generate request ID for tracing
    const header = req.headers['x-request-id'];
    const requestId = Array.isArray(header) ? header[0] : header;
    const sanitized = requestId?.replace(/[^A-Za-z0-9-]/g, '').slice(0, 64);
    req.requestId = sanitized || randomUUID();
    done();
  });

  fastify.addHook('onSend', (req, reply, payload, done) => {
    // Security headers
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Request tracing header
    reply.header('X-Request-Id', req.requestId);

    // Apply CSP in all environments. Development keeps local/HMR allowances.
    reply.header('Content-Security-Policy', isProd ? PROD_CSP : DEV_CSP);

    if (isProd) {
      // HSTS only in production (requires HTTPS)
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    done();
  });
}

type ErrorWithContext = Error & {
  statusCode?: number;
  expose?: boolean;
  requestId?: string;
};

export function sanitizeError(err: ErrorWithContext, includeStack = false) {
  if (isProd) {
    // In production, never expose internal details
    return {
      error: 'An error occurred',
      message: err.expose ? err.message : 'Internal server error',
      requestId: err.requestId,
    };
  }
  
  // In development, include more details
  return {
    error: err.name || 'Error',
    message: err.message,
    ...(includeStack && err.stack ? { stack: err.stack } : {}),
    requestId: err.requestId,
  };
}

export function errorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler((err, req, reply) => {
    const error = err as ErrorWithContext;
    error.requestId = req.requestId;
    
    // Log the full error server-side
    req.log.error({
      err: error,
      requestId: req.requestId,
      path: req.url,
      method: req.method,
      userId: req.user?.id,
    }, 'Request error');
    
    const statusCode = error.statusCode || 500;
    const sanitized = sanitizeError(error);
    
    reply.code(statusCode).send(sanitized);
  });
}

export function requestLogger(fastify: FastifyInstance) {
  fastify.addHook('onResponse', (req, reply, done) => {
    const duration = reply.elapsedTime;
    req.log.info({
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      statusCode: reply.statusCode,
      duration: Math.round(duration),
      userId: req.user?.id,
    }, 'Request completed');
    done();
  });
}
