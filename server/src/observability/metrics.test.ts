import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

describe('Metrics Module', () => {
  beforeEach(async () => {
    vi.resetModules();
    // Clear prom-client's global registry to avoid "already registered" errors
    const client = await import('prom-client');
    client.register.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('setupMetrics', () => {
    it('does nothing when metrics are disabled', async () => {
      vi.doMock('../config.js', () => ({
        observabilityConfig: {
          metricsEnabled: false,
          metricsAuthToken: null,
        },
      }));

      const { setupMetrics } = await import('./metrics.js');

      const addHook = vi.fn();
      const get = vi.fn();
      const mockFastify = { addHook, get } as unknown as FastifyInstance;

      setupMetrics(mockFastify);

      // When metrics are disabled, no hooks should be registered
      expect(addHook).not.toHaveBeenCalled();
      expect(get).not.toHaveBeenCalled();
    });

    it('rejects requests that only provide token in query string', async () => {
      vi.doMock('../config.js', () => ({
        observabilityConfig: {
          metricsEnabled: true,
          metricsAuthToken: 'secret-token',
        },
      }));

      const { setupMetrics } = await import('./metrics.js');

      const addHook = vi.fn();
      const get = vi.fn();
      const mockFastify = { addHook, get } as unknown as FastifyInstance;

      setupMetrics(mockFastify);

      const [, , handler] = get.mock.calls[0];
      const req = {
        headers: {},
        query: { token: 'secret-token' },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
        header: vi.fn().mockReturnThis(),
      };

      await handler(req, reply);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(reply.header).not.toHaveBeenCalled();
    });

    it('accepts metrics token from Authorization header', async () => {
      vi.doMock('../config.js', () => ({
        observabilityConfig: {
          metricsEnabled: true,
          metricsAuthToken: 'secret-token',
        },
      }));

      const { setupMetrics } = await import('./metrics.js');

      const addHook = vi.fn();
      const get = vi.fn();
      const mockFastify = { addHook, get } as unknown as FastifyInstance;

      setupMetrics(mockFastify);

      const [, , handler] = get.mock.calls[0];
      const req = {
        headers: { authorization: 'Bearer secret-token' },
        query: { token: 'wrong-token' },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
        header: vi.fn().mockReturnThis(),
      };

      const body = await handler(req, reply);

      expect(reply.code).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
      expect(reply.header).toHaveBeenCalledWith('Content-Type', expect.any(String));
      expect(typeof body).toBe('string');
      expect(body).toContain('http_request_duration_ms');
    });
  });
});
