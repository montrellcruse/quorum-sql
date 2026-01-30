import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock opossum before importing the module
const mockBreakerInstance = {
  on: vi.fn().mockReturnThis(),
  fire: vi.fn(),
  stats: {
    failures: 0,
    successes: 0,
    timeouts: 0,
    rejects: 0,
    fallbacks: 0,
  },
  opened: false,
  halfOpen: false,
};

vi.mock('opossum', () => {
  return {
    default: class MockCircuitBreaker {
      on = mockBreakerInstance.on;
      fire = mockBreakerInstance.fire;
      get stats() { return mockBreakerInstance.stats; }
      get opened() { return mockBreakerInstance.opened; }
      get halfOpen() { return mockBreakerInstance.halfOpen; }
      constructor(public fn: unknown, public opts: unknown) {}
    },
  };
});

describe('Circuit Breaker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockBreakerInstance.opened = false;
    mockBreakerInstance.halfOpen = false;
    mockBreakerInstance.stats = {
      failures: 0,
      successes: 0,
      timeouts: 0,
      rejects: 0,
      fallbacks: 0,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createCircuitBreaker', () => {
    it('creates a circuit breaker and returns it', async () => {
      const { createCircuitBreaker } = await import('./circuitBreaker.js');

      const fn = vi.fn().mockResolvedValue('success');
      const breaker = createCircuitBreaker(fn);

      expect(breaker).toBeDefined();
    });

    it('registers event listeners for state changes', async () => {
      const { createCircuitBreaker } = await import('./circuitBreaker.js');

      const fn = vi.fn().mockResolvedValue('success');
      createCircuitBreaker(fn, { name: 'test-breaker' });

      expect(mockBreakerInstance.on).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockBreakerInstance.on).toHaveBeenCalledWith('halfOpen', expect.any(Function));
      expect(mockBreakerInstance.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockBreakerInstance.on).toHaveBeenCalledWith('timeout', expect.any(Function));
      expect(mockBreakerInstance.on).toHaveBeenCalledWith('reject', expect.any(Function));
    });

    it('logs when circuit opens', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { createCircuitBreaker } = await import('./circuitBreaker.js');

      const fn = vi.fn().mockResolvedValue('success');
      createCircuitBreaker(fn, { name: 'open-test' });

      // Find and call the 'open' event handler
      const openHandler = mockBreakerInstance.on.mock.calls.find((call) => call[0] === 'open')?.[1];
      openHandler?.();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('OPENED')
      );

      consoleSpy.mockRestore();
    });

    it('logs when circuit goes half-open', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { createCircuitBreaker } = await import('./circuitBreaker.js');

      const fn = vi.fn().mockResolvedValue('success');
      createCircuitBreaker(fn, { name: 'halfopen-test' });

      const halfOpenHandler = mockBreakerInstance.on.mock.calls.find(
        (call) => call[0] === 'halfOpen'
      )?.[1];
      halfOpenHandler?.();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('HALF-OPEN')
      );

      consoleSpy.mockRestore();
    });

    it('logs when circuit closes', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { createCircuitBreaker } = await import('./circuitBreaker.js');

      const fn = vi.fn().mockResolvedValue('success');
      createCircuitBreaker(fn, { name: 'close-test' });

      const closeHandler = mockBreakerInstance.on.mock.calls.find(
        (call) => call[0] === 'close'
      )?.[1];
      closeHandler?.();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('CLOSED')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getCircuitBreakerStats', () => {
    it('returns stats for all registered breakers', async () => {
      const { createCircuitBreaker, getCircuitBreakerStats } = await import(
        './circuitBreaker.js'
      );

      const fn1 = vi.fn().mockResolvedValue('success');
      createCircuitBreaker(fn1, { name: 'breaker-1' });

      mockBreakerInstance.stats = {
        failures: 5,
        successes: 100,
        timeouts: 2,
        rejects: 1,
        fallbacks: 0,
      };

      const stats = getCircuitBreakerStats();

      expect(stats['breaker-1']).toEqual({
        state: 'CLOSED',
        failures: 5,
        successes: 100,
        timeouts: 2,
        rejects: 1,
        fallbacks: 0,
      });
    });

    it('reports OPEN state correctly', async () => {
      const { createCircuitBreaker, getCircuitBreakerStats } = await import(
        './circuitBreaker.js'
      );

      const fn = vi.fn().mockResolvedValue('success');
      createCircuitBreaker(fn, { name: 'open-breaker' });

      mockBreakerInstance.opened = true;

      const stats = getCircuitBreakerStats();

      expect(stats['open-breaker'].state).toBe('OPEN');
    });

    it('reports HALF-OPEN state correctly', async () => {
      const { createCircuitBreaker, getCircuitBreakerStats } = await import(
        './circuitBreaker.js'
      );

      const fn = vi.fn().mockResolvedValue('success');
      createCircuitBreaker(fn, { name: 'halfopen-breaker' });

      mockBreakerInstance.halfOpen = true;

      const stats = getCircuitBreakerStats();

      expect(stats['halfopen-breaker'].state).toBe('HALF-OPEN');
    });
  });

  describe('createFetchCircuitBreaker', () => {
    it('creates a circuit breaker for HTTP fetch calls', async () => {
      const { createFetchCircuitBreaker } = await import('./circuitBreaker.js');

      const breaker = createFetchCircuitBreaker('api-fetch');

      expect(breaker).toBeDefined();
    });

    it('accepts custom options for fetch circuit breaker', async () => {
      const { createFetchCircuitBreaker } = await import('./circuitBreaker.js');

      const breaker = createFetchCircuitBreaker('custom-fetch', {
        timeout: 10000,
        errorThresholdPercentage: 25,
      });

      expect(breaker).toBeDefined();
    });
  });
});
