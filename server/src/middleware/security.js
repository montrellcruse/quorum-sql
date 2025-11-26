import { isProd } from '../config.js';
import crypto from 'crypto';

export function securityHeaders(fastify) {
  fastify.addHook('onRequest', (req, reply, done) => {
    // Generate request ID for tracing
    req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
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
    
    if (isProd) {
      // HSTS only in production (requires HTTPS)
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      // Stricter CSP in production
      reply.header('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'");
    }
    
    done();
  });
}

export function sanitizeError(err, includeStack = false) {
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

export function errorHandler(fastify) {
  fastify.setErrorHandler((err, req, reply) => {
    err.requestId = req.requestId;
    
    // Log the full error server-side
    req.log.error({
      err,
      requestId: req.requestId,
      path: req.url,
      method: req.method,
      userId: req.user?.id,
    }, 'Request error');
    
    const statusCode = err.statusCode || 500;
    const sanitized = sanitizeError(err);
    
    reply.code(statusCode).send(sanitized);
  });
}

export function requestLogger(fastify) {
  fastify.addHook('onResponse', (req, reply, done) => {
    const duration = reply.getResponseTime();
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
