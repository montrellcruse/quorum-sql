import type { FastifyInstance } from 'fastify';

import { getCircuitBreakerStats } from '../lib/circuitBreaker.js';

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', {
    config: { rateLimit: { max: 200, timeWindow: '1 minute' } },
  }, async () => ({ ok: true, version: '1.0.0' }));

  fastify.get('/health/live', {
    config: { rateLimit: { max: 200, timeWindow: '1 minute' } },
  }, async () => ({ ok: true }));

  fastify.get('/health/ready', {
    config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    try {
      const result = await fastify.withClient(null, async (client) => {
        const { rows } = await client.query('select now() as now');
        return { ok: true, database: 'connected', now: rows[0].now };
      });
      return result;
    } catch (err) {
      req.log.error({ err }, 'Health check failed');
      return reply.code(503).send({
        error: 'Service unavailable',
        details: { database: 'disconnected' },
      });
    }
  });

  // Legacy endpoint
  fastify.get('/health/db', {
    config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
  }, async () => {
    return fastify.withClient(null, async (client) => {
      const { rows } = await client.query('select now() as now');
      return { ok: true, now: rows[0].now };
    });
  });

  // Circuit breaker status endpoint
  fastify.get('/health/breakers', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async () => {
    return { ok: true, breakers: getCircuitBreakerStats() };
  });
}
