import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyRequest } from 'fastify';

describe('Request Context', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('runWithRequestContext', () => {
    it('runs callback within request context', async () => {
      const { runWithRequestContext, getQueryCount } = await import('./requestContext.js');

      const mockReq = {
        requestId: 'test-request-123',
      } as unknown as FastifyRequest;

      let queryCountInContext: number | undefined;

      runWithRequestContext(mockReq, () => {
        queryCountInContext = getQueryCount();
      });

      expect(queryCountInContext).toBe(0);
    });

    it('initializes query count to 0', async () => {
      const { runWithRequestContext, getQueryCount } = await import('./requestContext.js');

      const mockReq = {
        requestId: 'test-request-456',
      } as unknown as FastifyRequest;

      let count: number | undefined;

      runWithRequestContext(mockReq, () => {
        count = getQueryCount();
      });

      expect(count).toBe(0);
    });
  });

  describe('incrementQueryCount', () => {
    it('increments query count within context', async () => {
      const { runWithRequestContext, incrementQueryCount, getQueryCount } =
        await import('./requestContext.js');

      const mockReq = {
        requestId: 'test-request-789',
      } as unknown as FastifyRequest;

      let finalCount: number | undefined;

      runWithRequestContext(mockReq, () => {
        incrementQueryCount();
        incrementQueryCount();
        incrementQueryCount();
        finalCount = getQueryCount();
      });

      expect(finalCount).toBe(3);
    });

    it('does nothing when called outside of context', async () => {
      const { incrementQueryCount, getQueryCount } = await import('./requestContext.js');

      // Call outside of any context - should not throw
      expect(() => incrementQueryCount()).not.toThrow();

      // Query count should be 0 outside context
      expect(getQueryCount()).toBe(0);
    });
  });

  describe('getQueryCount', () => {
    it('returns 0 when called outside of context', async () => {
      const { getQueryCount } = await import('./requestContext.js');

      const count = getQueryCount();

      expect(count).toBe(0);
    });

    it('isolates counts between different request contexts', async () => {
      const { runWithRequestContext, incrementQueryCount, getQueryCount } =
        await import('./requestContext.js');

      const results: number[] = [];

      const mockReq1 = { requestId: 'req-1' } as unknown as FastifyRequest;
      const mockReq2 = { requestId: 'req-2' } as unknown as FastifyRequest;

      // First request context
      runWithRequestContext(mockReq1, () => {
        incrementQueryCount();
        incrementQueryCount();
        results.push(getQueryCount());
      });

      // Second request context (should start fresh)
      runWithRequestContext(mockReq2, () => {
        incrementQueryCount();
        results.push(getQueryCount());
      });

      expect(results).toEqual([2, 1]);
    });
  });

  describe('context isolation', () => {
    it('provides isolated storage per request', async () => {
      const { runWithRequestContext, incrementQueryCount, getQueryCount } =
        await import('./requestContext.js');

      const countsInsideContext: number[] = [];

      // Simulate multiple requests
      for (let i = 0; i < 3; i++) {
        const mockReq = { requestId: `req-${i}` } as unknown as FastifyRequest;

        runWithRequestContext(mockReq, () => {
          // Each context starts fresh
          for (let j = 0; j <= i; j++) {
            incrementQueryCount();
          }
          countsInsideContext.push(getQueryCount());
        });
      }

      // Each request should have its own isolated count
      expect(countsInsideContext).toEqual([1, 2, 3]);
    });
  });
});
