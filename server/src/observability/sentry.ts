import * as Sentry from '@sentry/node';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const SENTRY_DSN = process.env.SENTRY_DSN;
const NODE_ENV = process.env.NODE_ENV || 'development';

export function initSentry(): void {
  if (!SENTRY_DSN) {
    console.log('Sentry: SENTRY_DSN not set, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: NODE_ENV,
    tracesSampleRate: NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      // Scrub sensitive data
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });

  console.log(`Sentry: Error tracking enabled for ${NODE_ENV} environment`);
}

export function setupSentryFastify(fastify: FastifyInstance): void {
  if (!SENTRY_DSN) return;

  // Add request context to Sentry
  fastify.addHook('onRequest', (request: FastifyRequest, _reply: FastifyReply, done) => {
    Sentry.setContext('request', {
      method: request.method,
      url: request.url,
      requestId: request.id,
    });
    done();
  });

  // Capture errors
  fastify.addHook('onError', (request: FastifyRequest, _reply: FastifyReply, error: Error, done) => {
    Sentry.withScope((scope) => {
      scope.setTag('requestId', request.id);
      scope.setTag('method', request.method);
      scope.setTag('url', request.url);
      scope.setUser({ ip_address: request.ip });
      Sentry.captureException(error);
    });
    done();
  });
}

export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('additional', context);
    }
    Sentry.captureException(error);
  });
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  if (!SENTRY_DSN) return;
  Sentry.captureMessage(message, level);
}
