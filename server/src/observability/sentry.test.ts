import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Event, EventHint } from '@sentry/node';

// Mock Sentry
const mockScope = {
  setTag: vi.fn(),
  setUser: vi.fn(),
  setContext: vi.fn(),
};

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  setContext: vi.fn(),
  withScope: vi.fn((callback) => callback(mockScope)),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

describe('Sentry Module', () => {
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

  describe('initSentry', () => {
    it('does nothing when SENTRY_DSN is not set', async () => {
      delete process.env.SENTRY_DSN;

      const Sentry = await import('@sentry/node');
      const { initSentry } = await import('./sentry.js');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      initSentry();

      expect(Sentry.init).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SENTRY_DSN not set')
      );

      consoleSpy.mockRestore();
    });

    it('initializes Sentry when DSN is set', async () => {
      process.env.SENTRY_DSN = 'https://abc@sentry.io/123';
      process.env.NODE_ENV = 'production';

      const Sentry = await import('@sentry/node');
      const { initSentry } = await import('./sentry.js');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://abc@sentry.io/123',
          environment: 'production',
          tracesSampleRate: 0.1,
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error tracking enabled')
      );

      consoleSpy.mockRestore();
    });

    it('uses higher sample rate in development', async () => {
      process.env.SENTRY_DSN = 'https://abc@sentry.io/123';
      process.env.NODE_ENV = 'development';

      const Sentry = await import('@sentry/node');
      const { initSentry } = await import('./sentry.js');

      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 1.0,
        })
      );
    });

    it('scrubs sensitive headers in beforeSend', async () => {
      process.env.SENTRY_DSN = 'https://abc@sentry.io/123';

      const Sentry = await import('@sentry/node');
      const { initSentry } = await import('./sentry.js');

      initSentry();

      // Get the beforeSend function
      const initCall = vi.mocked(Sentry.init).mock.calls[0][0];
      const beforeSend = initCall?.beforeSend;

      const event = {
        request: {
          headers: {
            authorization: 'Bearer secret-token',
            cookie: 'session=abc123',
            'content-type': 'application/json',
          },
        },
      };

      const result = beforeSend?.(event as Event, {} as EventHint);

      expect(result?.request?.headers?.authorization).toBeUndefined();
      expect(result?.request?.headers?.cookie).toBeUndefined();
      expect(result?.request?.headers?.['content-type']).toBe('application/json');
    });
  });

  describe('setupSentryFastify', () => {
    it('does nothing when SENTRY_DSN is not set', async () => {
      delete process.env.SENTRY_DSN;

      const { setupSentryFastify } = await import('./sentry.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      setupSentryFastify(mockFastify);

      expect(addHook).not.toHaveBeenCalled();
    });

    it('registers hooks when SENTRY_DSN is set', async () => {
      process.env.SENTRY_DSN = 'https://abc@sentry.io/123';

      const { setupSentryFastify } = await import('./sentry.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      setupSentryFastify(mockFastify);

      expect(addHook).toHaveBeenCalledWith('onRequest', expect.any(Function));
      expect(addHook).toHaveBeenCalledWith('onError', expect.any(Function));
    });

    it('sets request context on onRequest hook', async () => {
      process.env.SENTRY_DSN = 'https://abc@sentry.io/123';

      const Sentry = await import('@sentry/node');
      const { setupSentryFastify } = await import('./sentry.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      setupSentryFastify(mockFastify);

      const onRequestHook = addHook.mock.calls.find(
        (call) => call[0] === 'onRequest'
      )?.[1];

      const done = vi.fn();
      const mockReq = {
        method: 'POST',
        url: '/api/test',
        id: 'req-123',
      } as unknown as FastifyRequest;

      onRequestHook(mockReq, {} as FastifyReply, done);

      expect(Sentry.setContext).toHaveBeenCalledWith('request', {
        method: 'POST',
        url: '/api/test',
        requestId: 'req-123',
      });
      expect(done).toHaveBeenCalled();
    });

    it('captures exceptions on onError hook', async () => {
      process.env.SENTRY_DSN = 'https://abc@sentry.io/123';

      const Sentry = await import('@sentry/node');
      const { setupSentryFastify } = await import('./sentry.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      setupSentryFastify(mockFastify);

      const onErrorHook = addHook.mock.calls.find(
        (call) => call[0] === 'onError'
      )?.[1];

      const done = vi.fn();
      const mockReq = {
        id: 'req-456',
        method: 'GET',
        url: '/api/broken',
        ip: '127.0.0.1',
      } as unknown as FastifyRequest;

      const error = new Error('Test error');

      onErrorHook(mockReq, {} as FastifyReply, error, done);

      expect(Sentry.withScope).toHaveBeenCalled();
      expect(mockScope.setTag).toHaveBeenCalledWith('requestId', 'req-456');
      expect(mockScope.setTag).toHaveBeenCalledWith('method', 'GET');
      expect(mockScope.setTag).toHaveBeenCalledWith('url', '/api/broken');
      expect(mockScope.setUser).toHaveBeenCalledWith({ ip_address: '127.0.0.1' });
      expect(Sentry.captureException).toHaveBeenCalledWith(error);
      expect(done).toHaveBeenCalled();
    });
  });

  describe('captureException', () => {
    it('does nothing when SENTRY_DSN is not set', async () => {
      delete process.env.SENTRY_DSN;

      const Sentry = await import('@sentry/node');
      const { captureException } = await import('./sentry.js');

      captureException(new Error('Test'));

      expect(Sentry.withScope).not.toHaveBeenCalled();
    });

    it('captures exception with context when DSN is set', async () => {
      process.env.SENTRY_DSN = 'https://abc@sentry.io/123';

      const Sentry = await import('@sentry/node');
      const { captureException } = await import('./sentry.js');

      const error = new Error('Captured error');
      const context = { userId: 'user-123', action: 'test' };

      captureException(error, context);

      expect(Sentry.withScope).toHaveBeenCalled();
      expect(mockScope.setContext).toHaveBeenCalledWith('additional', context);
      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('captures exception without context', async () => {
      process.env.SENTRY_DSN = 'https://abc@sentry.io/123';

      const Sentry = await import('@sentry/node');
      const { captureException } = await import('./sentry.js');

      const error = new Error('Simple error');

      captureException(error);

      expect(Sentry.withScope).toHaveBeenCalled();
      expect(mockScope.setContext).not.toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });
  });

  describe('captureMessage', () => {
    it('does nothing when SENTRY_DSN is not set', async () => {
      delete process.env.SENTRY_DSN;

      const Sentry = await import('@sentry/node');
      const { captureMessage } = await import('./sentry.js');

      captureMessage('Test message');

      expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });

    it('captures message with default level', async () => {
      process.env.SENTRY_DSN = 'https://abc@sentry.io/123';

      const Sentry = await import('@sentry/node');
      const { captureMessage } = await import('./sentry.js');

      captureMessage('Info message');

      expect(Sentry.captureMessage).toHaveBeenCalledWith('Info message', 'info');
    });

    it('captures message with custom level', async () => {
      process.env.SENTRY_DSN = 'https://abc@sentry.io/123';

      const Sentry = await import('@sentry/node');
      const { captureMessage } = await import('./sentry.js');

      captureMessage('Warning message', 'warning');

      expect(Sentry.captureMessage).toHaveBeenCalledWith('Warning message', 'warning');
    });
  });
});
