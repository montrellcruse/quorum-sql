import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

describe('Metrics Module', () => {
  beforeEach(() => {
    vi.resetModules();
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

  });
});
