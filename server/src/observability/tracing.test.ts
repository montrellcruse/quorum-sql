import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Tracing Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('initTracing', () => {
    it('logs message when OTEL_EXPORTER_OTLP_ENDPOINT is not set', async () => {
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Import fresh module without the environment variable
      const { initTracing } = await import('./tracing.js');

      initTracing();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('OTEL_EXPORTER_OTLP_ENDPOINT not set')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getTracingEnabled', () => {
    it('returns false when tracing is not initialized', async () => {
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

      const { initTracing, getTracingEnabled } = await import('./tracing.js');

      initTracing();

      expect(getTracingEnabled()).toBe(false);
    });
  });
});
