import CircuitBreaker from 'opossum';

/**
 * Circuit Breaker Configuration
 *
 * Wraps external service calls to prevent cascade failures.
 * When a service fails repeatedly, the circuit "opens" and fails fast
 * instead of waiting for timeouts.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service unhealthy, requests fail immediately
 * - HALF-OPEN: Testing if service recovered
 */

export interface CircuitBreakerOptions {
  /** Timeout for each request in ms (default: 3000) */
  timeout?: number;
  /** Number of failures before opening circuit (default: 5) */
  errorThresholdPercentage?: number;
  /** Time to wait before testing if service recovered (default: 30000) */
  resetTimeout?: number;
  /** Name for logging/metrics */
  name?: string;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};

// Registry of circuit breakers for monitoring
const breakers = new Map<string, CircuitBreaker<unknown[], unknown>>();

/**
 * Create a circuit breaker for an async function
 */
export function createCircuitBreaker<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: CircuitBreakerOptions = {}
): CircuitBreaker<TArgs, TResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const name = opts.name || fn.name || 'anonymous';

  const breaker = new CircuitBreaker(fn, {
    timeout: opts.timeout,
    errorThresholdPercentage: opts.errorThresholdPercentage,
    resetTimeout: opts.resetTimeout,
    name,
  });

  // Log state changes
  breaker.on('open', () => {
    console.warn(`Circuit breaker [${name}] OPENED - failing fast`);
  });

  breaker.on('halfOpen', () => {
    console.log(`Circuit breaker [${name}] HALF-OPEN - testing recovery`);
  });

  breaker.on('close', () => {
    console.log(`Circuit breaker [${name}] CLOSED - service recovered`);
  });

  breaker.on('timeout', () => {
    console.warn(`Circuit breaker [${name}] timeout`);
  });

  breaker.on('reject', () => {
    console.warn(`Circuit breaker [${name}] rejected (circuit open)`);
  });

  // Register for monitoring
  breakers.set(name, breaker as CircuitBreaker<unknown[], unknown>);

  return breaker;
}

/**
 * Get circuit breaker statistics for monitoring
 */
export function getCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
  const stats: Record<string, CircuitBreakerStats> = {};

  for (const [name, breaker] of breakers) {
    const breakerStats = breaker.stats;
    stats[name] = {
      state: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF-OPEN' : 'CLOSED',
      failures: breakerStats.failures,
      successes: breakerStats.successes,
      timeouts: breakerStats.timeouts,
      rejects: breakerStats.rejects,
      fallbacks: breakerStats.fallbacks,
    };
  }

  return stats;
}

export interface CircuitBreakerStats {
  state: 'OPEN' | 'HALF-OPEN' | 'CLOSED';
  failures: number;
  successes: number;
  timeouts: number;
  rejects: number;
  fallbacks: number;
}

/**
 * Pre-configured circuit breaker for HTTP fetch calls
 */
export function createFetchCircuitBreaker(
  name: string,
  options: CircuitBreakerOptions = {}
): CircuitBreaker<[string, globalThis.RequestInit?], globalThis.Response> {
  return createCircuitBreaker(
    async (url: string, init?: globalThis.RequestInit) => {
      const response = await fetch(url, init);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    },
    { name, ...options }
  );
}
