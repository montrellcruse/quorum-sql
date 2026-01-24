import client from 'prom-client';
import { observabilityConfig } from '../config.js';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [25, 50, 100, 200, 500, 1000, 2000, 5000],
});

register.registerMetric(httpRequestDuration);

function isAuthorized(req) {
  if (!observabilityConfig.metricsAuthToken) return true;
  const header = req.headers?.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  const queryToken = req.query?.token;
  return token === observabilityConfig.metricsAuthToken || queryToken === observabilityConfig.metricsAuthToken;
}

export function setupMetrics(fastify) {
  if (!observabilityConfig.metricsEnabled) return;

  fastify.addHook('onResponse', (req, reply, done) => {
    const route = req.routerPath || req.url;
    const duration = reply.getResponseTime();
    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: reply.statusCode,
      },
      duration,
    );
    done();
  });

  fastify.get('/metrics', async (req, reply) => {
    if (!isAuthorized(req)) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });
}
